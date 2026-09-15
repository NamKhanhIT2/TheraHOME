// Cửa hàng + Cộng đồng for the web training area — the same rows the mobile
// app reads and writes, same moderation, same rate limits.
//
// Nothing here reimplements a rule. Posting is a plain insert into
// `community_posts`, and five database triggers do the rest: set_author_info
// denormalises the name/avatar, enforce_content_rate_limit throttles,
// filter_unsafe_community_content screens the text, and
// set_post_moderation_status decides the starting `status` (default 'pending').
// That is why a post made here behaves exactly like one made on the phone —
// including being held for CSKH review, and including the App Review account's
// exemption, which lives in the trigger rather than in any client.
import { supabase } from "./supabase";

/* -------------------------------------------------------------- cửa hàng */

export interface StoreItem {
  id: string;
  name: string;
  description: string | null;
  priceText: string | null;
  imageUrl: string | null;
  externalLink: string | null;
  previewUrl: string | null;
}

export interface StoreCategory {
  id: string;
  title: string;
  isPrimary: boolean;
  hasTrial: boolean;
  items: StoreItem[];
}

/** The catalog is market-scoped and world-readable (public read policy, no
 * auth needed), so the store renders for a signed-out visitor too. */
export async function fetchStore(market: string | null): Promise<StoreCategory[]> {
  const m = market === "US" || market === "MALAY" ? market : "VN";
  const [{ data: cats, error: cErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from("store_categories").select("id, title, is_primary, has_trial, sort_order").eq("market", m).order("sort_order"),
    supabase.from("store_items").select("id, category_id, name, description, price_text, image_url, external_link, preview_url, sort_order").eq("market", m).order("sort_order"),
  ]);
  if (cErr) throw cErr;
  if (iErr) throw iErr;

  const byCat = new Map<string, StoreItem[]>();
  for (const i of items ?? []) {
    const list = byCat.get(i.category_id) ?? [];
    list.push({
      id: i.id,
      name: i.name,
      description: i.description,
      priceText: i.price_text,
      imageUrl: i.image_url,
      externalLink: i.external_link,
      previewUrl: i.preview_url,
    });
    byCat.set(i.category_id, list);
  }
  return (cats ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    isPrimary: c.is_primary === true,
    hasTrial: c.has_trial === true,
    items: byCat.get(c.id) ?? [],
  }));
}

/* ------------------------------------------------------------ cộng đồng */

export interface CommunityPost {
  id: string;
  authorId: string | null;
  authorName: string;
  isOfficial: boolean;
  title: string | null;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  status: string;
  likedByMe: boolean;
  mine: boolean;
}

export type FeedFilter = "all" | "official";

/** The read policy already hides unapproved posts from everyone but their own
 * author and staff, so no status filter is needed here — asking for one would
 * only hide a customer's own pending post from them, which is the opposite of
 * what they need to see. */
export async function fetchFeed(filter: FeedFilter, userId: string | null): Promise<CommunityPost[]> {
  let query = supabase
    .from("community_posts")
    .select("id, author_id, author_name, is_official, title, text, image_url, media_urls, likes_count, comments_count, created_at, status")
    .eq("hidden", false)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (filter === "official") query = query.eq("is_official", true);

  const { data, error } = await query;
  if (error) throw error;
  const posts = data ?? [];

  // Which of these the viewer has already reacted to. One query for the page
  // rather than one per card.
  let liked = new Set<string>();
  if (userId && posts.length) {
    const { data: likes } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", posts.map((p) => p.id));
    liked = new Set((likes ?? []).map((l) => l.post_id));
  }

  return posts.map((p) => ({
    id: p.id,
    authorId: p.author_id,
    authorName: p.author_name || "Thành viên",
    isOfficial: p.is_official === true,
    title: p.title,
    text: p.text,
    imageUrl: p.image_url,
    mediaUrls: p.media_urls ?? [],
    likesCount: p.likes_count ?? 0,
    commentsCount: p.comments_count ?? 0,
    createdAt: p.created_at,
    status: p.status,
    likedByMe: liked.has(p.id),
    mine: !!userId && p.author_id === userId,
  }));
}

/** Insert only `author_id` and `text`. Everything else — author name, status,
 * rate limit, content filter — is the database's job (see the header note). */
export async function createPost(userId: string, text: string): Promise<void> {
  const { error } = await supabase.from("community_posts").insert({ author_id: userId, text: text.trim() });
  if (error) throw error;
}

export async function toggleLike(postId: string, userId: string, liked: boolean): Promise<void> {
  if (liked) {
    const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export interface PostComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export async function fetchComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from("post_comments")
    .select("id, author_name, text, created_at")
    .eq("post_id", postId)
    .eq("hidden", false)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, authorName: c.author_name || "Thành viên", text: c.text, createdAt: c.created_at }));
}

/** Via the RPC, not a direct insert — the app uses it and it owns the comment
 * counter and the same moderation the post path gets. */
export async function addComment(postId: string, text: string): Promise<void> {
  const { error } = await supabase.rpc("create_community_comment", {
    p_post_id: postId,
    p_text: text.trim(),
  });
  if (error) throw error;
}

/** "2 giờ trước". Vietnamese relative time, matching the app's timeAgo. */
export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} tuần trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}
