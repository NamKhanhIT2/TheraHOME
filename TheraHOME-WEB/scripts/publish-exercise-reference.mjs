#!/usr/bin/env node
// Attach a demonstration to a day: upload the clip, store the keypoint
// track, publish it.
//
// The WEB console's day editor does exactly this through a UI, and that is
// the way the team should do it. This script exists for the cases a UI is
// the wrong shape for: seeding the first day while the feature is being
// built, re-publishing a corrected track for several days at once, and
// anything an engineer needs to do twenty times while tuning thresholds.
//
// It needs the SERVICE ROLE key because the bucket is private and its
// policies answer to `current_web_roles()`, which a script has no way to
// be. Same arrangement, and the same env file, as
// backfill-community-media.mjs.
//
// Usage, from TheraHOME-WEB:
//   node --env-file=.env.local scripts/publish-exercise-reference.mjs \
//     --day <program_day_id>[,<id>…] --clip path/to/clip.mp4 --track path/to/track.json [--draft]
//
// Several days can share one demonstration, and in this programme many do:
// the 28-day roadmap is built from 14 videos, days 15-28 repeating days
// 1-14. Passing them together uploads the clip ONCE and points both rows at
// it, rather than storing the same three megabytes twice.
//
// The track is the output of TheraHOME-APP/scripts/pose-track.py, which
// also writes a QC video with the skeleton drawn on it. WATCH THAT VIDEO
// before publishing: a track that is quietly wrong for two seconds in the
// middle will tell a customer their perfectly good form is bad, which is
// worse for them than having no feature at all. `--draft` stores everything
// without showing it to anyone, for exactly that review.
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'exercise-reference';
/** Two minutes (owner, 2026-10-17).
 *
 * It was twenty-five seconds, on the assumption that a demonstration is a
 * short loop of one movement. A session video demonstrates several, and a
 * reference that shows one of them looping is a worse teacher than the
 * video it came from — so day 1 now carries five movements cut from its
 * own video.
 *
 * The ceiling still exists because the track travels with the row: day 1's
 * 114 seconds is 788 KB of JSON, which gzip sends as 136 KB. Affordable,
 * and roughly the most a phone should fetch to open one screen. */
const MAX_SECONDS = 120;

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const dayIds = (arg('day') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
const clipPath = arg('clip');
const trackPath = arg('track');
const publish = !process.argv.includes('--draft');

if (dayIds.length === 0 || !clipPath || !trackPath) {
  console.error('Usage: --day <program_day_id>[,<id>…] --clip <file.mp4> --track <file.json> [--draft]');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (node --env-file=.env.local …).');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// The same checks the app makes before it will draw anything, made here
// instead — in front of the person who can fix the file.
const track = JSON.parse(await readFile(trackPath, 'utf8'));
if (!Array.isArray(track.samples) || track.samples.length < 2) throw new Error('track has no samples');
if (track.view !== 'front' && track.view !== 'side') throw new Error('track.view must be front or side');
if (!(track.frameWidth > 0) || !(track.frameHeight > 0)) throw new Error('track has no frame size');
if (!(track.duration > 0)) throw new Error('track has no duration');
if (track.duration > MAX_SECONDS) throw new Error(`track is ${track.duration}s, longer than ${MAX_SECONDS}s`);

const { data: days, error: dayError } = await supabase
  .from('program_days')
  .select('id, product_id, day_number')
  .in('id', dayIds);
if (dayError) throw dayError;
const missing = dayIds.filter((id) => !days?.some((day) => day.id === id));
if (missing.length) throw new Error(`no program_days row with id ${missing.join(', ')}`);
days.sort((a, b) => a.day_number - b.day_number);

const extension = extname(clipPath).toLowerCase() === '.mov' ? 'mov' : 'mp4';
// Named after the FIRST day sharing it, so the object is uploaded once
// however many rows point at it.
const storagePath = `${days[0].id}/clip.${extension}`;
const clip = await readFile(clipPath);

const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, clip, {
  contentType: extension === 'mov' ? 'video/quicktime' : 'video/mp4',
  cacheControl: '31536000',
  upsert: true,
});
if (uploadError) throw uploadError;

const { error: rowError } = await supabase.from('exercise_references').upsert(
  days.map((day) => ({
    program_day_id: day.id,
    clip_path: storagePath,
    track,
    published: publish,
    updated_at: new Date().toISOString(),
  })),
  { onConflict: 'program_day_id' },
);
if (rowError) throw rowError;

console.log(
  `${publish ? 'Published' : 'Stored as draft'}: ${days[0].product_id} day ` +
    `${days.map((day) => day.day_number).join(', ')}\n` +
    `  clip   ${basename(clipPath)} → ${BUCKET}/${storagePath} (${(clip.length / 1048576).toFixed(1)} MB)\n` +
    `  track  ${track.samples.length} samples over ${track.duration}s, ${track.view} view, ` +
    `${(JSON.stringify(track).length / 1024).toFixed(0)} KB`,
);
