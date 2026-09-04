import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const apply = process.argv.includes('--apply');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const VIDEO_EXTENSION = /\.(mp4|mov|m4v|webm)(?:$|\?)/i;

async function uploadVariant(postId, index, kind, bytes) {
  const path = `backfill/${postId}/${index}-${kind}-${Date.now()}.jpg`;
  if (!apply) return `dry-run://${path}`;
  const { error } = await supabase.storage.from('community-images').upload(path, bytes, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('community-images').getPublicUrl(path).data.publicUrl;
}

async function processPost(post) {
  const feedUrls = [...(post.media_feed_urls ?? [])];
  const thumbnailUrls = [...(post.media_thumbnail_urls ?? [])];
  const widths = [...(post.media_widths ?? [])];
  const heights = [...(post.media_heights ?? [])];
  let changed = false;

  for (let index = 0; index < post.media_urls.length; index += 1) {
    const originalUrl = post.media_urls[index];
    if (!originalUrl || VIDEO_EXTENSION.test(originalUrl)) continue;
    const alreadyOptimized = feedUrls[index] && thumbnailUrls[index]
      && feedUrls[index] !== originalUrl && thumbnailUrls[index] !== originalUrl;
    if (alreadyOptimized) continue;

    const response = await fetch(originalUrl);
    if (!response.ok) throw new Error(`Download failed (${response.status}) for ${originalUrl}`);
    const source = Buffer.from(await response.arrayBuffer());
    const image = sharp(source, { failOn: 'warning' }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) continue;

    const [feed, thumbnail] = await Promise.all([
      image.clone().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer(),
      image.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toBuffer(),
    ]);
    feedUrls[index] = await uploadVariant(post.id, index, 'feed', feed);
    thumbnailUrls[index] = await uploadVariant(post.id, index, 'thumb', thumbnail);
    widths[index] = metadata.width;
    heights[index] = metadata.height;
    changed = true;
  }

  if (changed && apply) {
    const { error } = await supabase.from('community_posts').update({
      media_feed_urls: feedUrls,
      media_thumbnail_urls: thumbnailUrls,
      media_widths: widths,
      media_heights: heights,
    }).eq('id', post.id);
    if (error) throw error;
  }
  return changed;
}

const { data: posts, error } = await supabase
  .from('community_posts')
  .select('id, media_urls, media_feed_urls, media_thumbnail_urls, media_widths, media_heights')
  .not('media_urls', 'eq', '{}');
if (error) throw error;

let changedCount = 0;
for (const post of posts ?? []) {
  try {
    if (await processPost(post)) changedCount += 1;
  } catch (cause) {
    console.error(`Failed post ${post.id}:`, cause instanceof Error ? cause.message : cause);
  }
}

console.log(`${apply ? 'Updated' : 'Would update'} ${changedCount} community posts.`);
if (!apply) console.log('Dry run only. Add --apply after checking the output.');
