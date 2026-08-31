// Phase 4: real community feed backed by Supabase Realtime — posts, likes,
// saves, nested comment replies, image upload via Storage. Replaces
// the Phase 1 mock store's communityPosts/savedPostIds and their actions.
// See CLAUDE.md.
//
// `community_posts`/`post_comments` carry denormalized `author_name`/
// `author_avatar_url` columns (set by a DB trigger on insert) because
// `profiles` RLS only allows selecting your own row — there's no public
// directory of other users to join against client-side.
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore, type AppLanguage } from '@/store/useAppStore';
import { marketForLanguage, type StoreMarket } from '@/hooks/useStore';
import { translate, type TranslationKey } from '@/lib/i18n';

export type PostType = 'text' | 'image' | 'progress' | 'exercise';
export type PostReaction = 'heart' | 'like' | 'haha' | 'celebrate' | 'support';

// Emoji + key are language-independent — only the display label varies,
// resolved on demand via `reactionLabel()` below rather than baked into
// this array, so every reaction anywhere in the app (action bar, picker
// tray, accessibility text) reads in the viewer's own language.
export const POST_REACTIONS: { key: PostReaction; emoji: string }[] = [
  { key: 'like', emoji: '👍' },
  { key: 'heart', emoji: '❤️' },
  { key: 'support', emoji: '💪' },
  // Existing database keys are retained for compatibility; the display names
  // are tuned to the calmer, encouraging Community experience.
  { key: 'haha', emoji: '😊' },
  { key: 'celebrate', emoji: '👏' },
];

const REACTION_LABEL_KEY: Record<PostReaction, TranslationKey> = {
  like: 'reactionLike',
  heart: 'reactionHeart',
  support: 'reactionSupport',
  haha: 'reactionHaha',
  celebrate: 'reactionCelebrate',
};

export function reactionLabel(key: PostReaction, language: AppLanguage): string {
  return translate(language, REACTION_LABEL_KEY[key]);
}

const emptyReactionCounts = (): Record<PostReaction, number> => ({
  heart: 0,
  like: 0,
  haha: 0,
  celebrate: 0,
  support: 0,
});

/** Frozen at share time (see useCreatePost) — never recomputed from live
 * data, so a shared card always shows what the user actually saw. */
export interface ProgressSnapshot {
  productName: string;
  dayNumber: number;
  totalDays: number;
  daysCompleted: number;
  streak: number;
  painBefore: number | null;
  painAfter: number | null;
}

export interface CommunityPostRow {
  id: string;
  authorId: string | null;
  isOfficial: boolean;
  authorName: string;
  authorAvatarUrl: string | null;
  title: string | null;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[];
  tag: string | null;
  dayMilestone: number | null;
  phaseMilestone: string | null;
  likesCount: number;
  reactionCounts: Record<PostReaction, number>;
  commentsCount: number;
  savesCount: number;
  pinned: boolean;
  // Only meaningful while `pinned` — staff can curate a shorter/different
  // title, content, and thumbnail for the pinned-card placement (Home's
  // "Gợi ý cho bạn" and Community's pinned slot) than the post's own raw
  // fields. Null unless staff set one when pinning; see `pinnedDisplay()`
  // below for the fallback-to-raw-post-fields resolution.
  pinnedTitle: string | null;
  pinnedContent: string | null;
  pinnedThumbnailUrl: string | null;
  postType: PostType;
  progressSnapshot: ProgressSnapshot | null;
  createdAt: string;
  /** Moderation state. RLS only ever returns non-'approved' rows to their
   * own author (and staff) — used to render the author's own "Chờ duyệt" /
   * "Không được duyệt" badge in the feed. */
  status: 'pending' | 'approved' | 'rejected';
}

/** Resolves what an "article card" (Home's "Gợi ý cho bạn", Community's
 * pinned slot) should actually show for a pinned post — staff's curated
 * override when set, otherwise the post's own title/text/first image. */
export function pinnedDisplay(post: CommunityPostRow): { title: string; content: string; thumbnailUrl: string | null } {
  return {
    title: post.pinnedTitle || post.title || post.text,
    content: post.pinnedContent || post.text,
    thumbnailUrl: post.pinnedThumbnailUrl || post.imageUrl || post.mediaUrls[0] || null,
  };
}

interface RawPost {
  id: string;
  author_id: string | null;
  is_official: boolean;
  author_name: string | null;
  author_avatar_url: string | null;
  title: string | null;
  text: string;
  image_url: string | null;
  media_urls: string[] | null;
  tag: string | null;
  day_milestone: number | null;
  phase_milestone: string | null;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  pinned: boolean;
  pinned_title: string | null;
  pinned_content: string | null;
  pinned_thumbnail_url: string | null;
  post_type: string;
  progress_snapshot: ProgressSnapshot | null;
  created_at: string;
  status: string;
  target_markets: string[] | null;
  title_us: string | null;
  text_us: string | null;
  title_malay: string | null;
  text_malay: string | null;
}

/** Resolves an official post's market-specific title/text — falls back to
 * the base (VN/default) content whenever the viewer's own market has no
 * variant, which covers both an untargeted post (target_markets null,
 * shown everywhere with just its base content) and a targeted post whose
 * variant for this market simply isn't filled in. */
function resolvePostMarketContent(r: RawPost, market: StoreMarket): { title: string | null; text: string } {
  if (market === 'US' && r.title_us) return { title: r.title_us, text: r.text_us ?? r.text };
  if (market === 'MALAY' && r.title_malay) return { title: r.title_malay, text: r.text_malay ?? r.text };
  return { title: r.title, text: r.text };
}

function mapPost(r: RawPost, market: StoreMarket, reactionCounts = emptyReactionCounts()): CommunityPostRow {
  const { title, text } = resolvePostMarketContent(r, market);
  return {
    id: r.id,
    authorId: r.author_id,
    isOfficial: r.is_official,
    authorName: r.is_official ? 'TheraHOME' : (r.author_name ?? 'Ẩn danh'),
    authorAvatarUrl: r.is_official ? null : r.author_avatar_url,
    title,
    text,
    imageUrl: r.image_url,
    mediaUrls: r.media_urls ?? [],
    tag: r.tag,
    dayMilestone: r.day_milestone,
    phaseMilestone: r.phase_milestone,
    likesCount: r.likes_count,
    reactionCounts,
    commentsCount: r.comments_count,
    savesCount: r.saves_count,
    pinned: r.pinned,
    pinnedTitle: r.pinned_title,
    pinnedContent: r.pinned_content,
    pinnedThumbnailUrl: r.pinned_thumbnail_url,
    postType: (r.post_type as PostType) ?? 'text',
    progressSnapshot: r.progress_snapshot,
    createdAt: r.created_at,
    status: (r.status as CommunityPostRow['status']) ?? 'approved',
  };
}

const POSTS_KEY = ['community_posts'] as const;
const POST_COLUMNS =
  'id, author_id, is_official, author_name, author_avatar_url, title, text, image_url, media_urls, tag, day_milestone, phase_milestone, likes_count, comments_count, saves_count, pinned, pinned_title, pinned_content, pinned_thumbnail_url, post_type, progress_snapshot, created_at, status, target_markets, title_us, text_us, title_malay, text_malay';

/** Vietnamese-friendly message for the shared anti-spam trigger (see
 * enforce_content_rate_limit in the community_moderation_and_notifications
 * migration) — both post and comment mutations map to this. */
export function friendlyCommunityError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e ?? '');
  if (message.includes('rate_limited')) {
    return 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
  }
  if (message.includes('unsafe_community_content')) {
    return 'Nội dung có từ ngữ chưa phù hợp với Quy tắc cộng đồng. Vui lòng chỉnh sửa trước khi đăng.';
  }
  if (message.includes('authentication_required') || message.includes('JWT')) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử bình luận.';
  }
  if (message.includes('comment_text_required')) {
    return 'Nội dung bình luận không được để trống.';
  }
  if (message.includes('comment_content_required')) {
    return 'Hãy nhập nội dung hoặc chọn một ảnh để bình luận.';
  }
  if (message.includes('community_post_not_found')) {
    return 'Bài viết này không còn khả dụng để bình luận.';
  }
  if (message.includes('invalid_parent_comment') || message.includes('comment_depth_exceeded')) {
    return 'Bình luận bạn muốn trả lời không còn khả dụng.';
  }
  return 'Có lỗi xảy ra, vui lòng thử lại.';
}

export const DEFAULT_POSTS_PAGE_SIZE = 20;

/** `limit` grows via the feed's "Xem thêm" button rather than true cursor
 * pagination — keeps the cache a flat `CommunityPostRow[]` (queryKey still
 * prefix-matches POSTS_KEY for invalidation/optimistic updates elsewhere,
 * e.g. useTogglePostLike's setQueriesData) instead of switching to
 * useInfiniteQuery's paged shape, which would ripple through every mutation
 * that currently does a flat-array optimistic update. */
export function useCommunityPosts(limit: number = DEFAULT_POSTS_PAGE_SIZE) {
  const queryClient = useQueryClient();
  const channelId = useRef(`community_posts_${Math.random().toString(36).slice(2)}`);
  const language = useAppStore((state) => state.language);
  const market = marketForLanguage(language);

  useEffect(() => {
    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => {
        queryClient.invalidateQueries({ queryKey: POSTS_KEY });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: [...POSTS_KEY, limit, market],
    queryFn: async (): Promise<CommunityPostRow[]> => {
      const { data, error } = await supabase
        .from('community_posts')
        .select(POST_COLUMNS)
        // target_markets null = visible everywhere (every regular user
        // post, plus any official post staff didn't restrict); otherwise
        // only shown to markets it actually targets.
        .or(`target_markets.is.null,target_markets.cs.{${market}}`)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = data as RawPost[];
      const ids = rows.map((row) => row.id);
      const { data: reactions, error: reactionsError } = ids.length
        ? await supabase.from('post_likes').select('post_id, reaction').in('post_id', ids)
        : { data: [], error: null };
      if (reactionsError) throw reactionsError;
      const countsByPost = new Map<string, Record<PostReaction, number>>();
      for (const reaction of reactions ?? []) {
        const counts = countsByPost.get(reaction.post_id) ?? emptyReactionCounts();
        const key = reaction.reaction as PostReaction;
        if (key in counts) counts[key] += 1;
        countsByPost.set(reaction.post_id, counts);
      }
      return rows.map((row) => mapPost(row, market, countsByPost.get(row.id)));
    },
  });
}

/** Fetches one post directly by id — used by post detail so a deep link
 * (notification tap, "view post" from a report, etc.) still resolves even
 * when that post has scrolled past the feed's paginated `limit`. */
export function usePost(postId: string | undefined) {
  const language = useAppStore((state) => state.language);
  const market = marketForLanguage(language);
  return useQuery({
    queryKey: ['community_post', postId, market],
    queryFn: async (): Promise<CommunityPostRow | null> => {
      const { data, error } = await supabase.from('community_posts').select(POST_COLUMNS).eq('id', postId!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: reactions, error: reactionsError } = await supabase
        .from('post_likes')
        .select('reaction')
        .eq('post_id', postId!);
      if (reactionsError) throw reactionsError;
      const counts = emptyReactionCounts();
      for (const reaction of reactions ?? []) {
        const key = reaction.reaction as PostReaction;
        if (key in counts) counts[key] += 1;
      }
      return mapPost(data as RawPost, market, counts);
    },
    enabled: !!postId,
  });
}

/** Post ids the current user has liked/saved — `post_likes`/`post_saves` RLS
 * already scopes every row to `auth.uid()`, so an unfiltered select returns
 * exactly this user's rows. */
export function useMyPostLikes(userId: string | undefined) {
  return useQuery({
    queryKey: ['post_likes', userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('post_likes').select('post_id');
      if (error) throw error;
      return new Set(data.map((r) => r.post_id));
    },
    enabled: !!userId,
  });
}

export function useMyPostReactions(userId: string | undefined) {
  return useQuery({
    queryKey: ['post_reactions', userId],
    queryFn: async (): Promise<Map<string, PostReaction>> => {
      const { data, error } = await supabase.from('post_likes').select('post_id, reaction').eq('user_id', userId!);
      if (error) throw error;
      return new Map(data.map((row) => [row.post_id, row.reaction as PostReaction]));
    },
    enabled: !!userId,
  });
}

export function useSetPostReaction(userId: string | undefined) {
  const queryClient = useQueryClient();
  const reactionsKey = ['post_reactions', userId] as const;
  const queues = useRef(new Map<string, Promise<unknown>>());
  return useMutation({
    mutationFn: async (vars: { postId: string; current: PostReaction | null; reaction: PostReaction | null }) => {
      if (!userId) throw new Error('authentication_required');
      const preceding = queues.current.get(vars.postId) ?? Promise.resolve();
      const task = preceding.catch(() => undefined).then(async () => {
        if (!vars.reaction) {
          const { error } = await supabase.from('post_likes').delete().eq('post_id', vars.postId).eq('user_id', userId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('post_likes').upsert(
            { post_id: vars.postId, user_id: userId, reaction: vars.reaction },
            { onConflict: 'post_id,user_id' },
          );
          if (error) throw error;
        }
      });
      queues.current.set(vars.postId, task);
      try {
        await task;
      } finally {
        if (queues.current.get(vars.postId) === task) queues.current.delete(vars.postId);
      }
      if (!vars.current && vars.reaction) {
        void supabase.functions.invoke('dispatch-push', {
          body: { mode: 'social', event: 'reaction', postId: vars.postId },
        });
      }
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: reactionsKey });
      const previous = queryClient.getQueryData<Map<string, PostReaction>>(reactionsKey);
      const next = new Map(previous);
      if (vars.reaction) next.set(vars.postId, vars.reaction);
      else next.delete(vars.postId);
      queryClient.setQueryData(reactionsKey, next);
      const previousPosts = queryClient.getQueriesData<CommunityPostRow[]>({ queryKey: POSTS_KEY });
      const previousDetail = queryClient.getQueryData<CommunityPostRow | null>(['community_post', vars.postId]);
      const patchPost = (post: CommunityPostRow): CommunityPostRow => {
        if (post.id !== vars.postId) return post;
        const counts = { ...post.reactionCounts };
        if (vars.current) counts[vars.current] = Math.max(0, counts[vars.current] - 1);
        if (vars.reaction) counts[vars.reaction] += 1;
        return { ...post, likesCount: Math.max(0, post.likesCount + (vars.current ? -1 : 0) + (vars.reaction ? 1 : 0)), reactionCounts: counts };
      };
      queryClient.setQueriesData<CommunityPostRow[]>({ queryKey: POSTS_KEY }, (posts) => posts?.map(patchPost));
      queryClient.setQueriesData<CommunityPostRow | null>({ queryKey: ['community_post', vars.postId] }, (post) => post ? patchPost(post) : post);
      return { previous, previousPosts, previousDetail };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(reactionsKey, context.previous);
      context?.previousPosts.forEach(([key, data]) => queryClient.setQueryData(key, data));
      queryClient.setQueryData(['community_post', _vars.postId], context?.previousDetail);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reactionsKey });
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

export function useMyPostSaves(userId: string | undefined) {
  return useQuery({
    queryKey: ['post_saves', userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('post_saves').select('post_id');
      if (error) throw error;
      return new Set(data.map((r) => r.post_id));
    },
    enabled: !!userId,
  });
}

export function useTogglePostLike(userId: string | undefined) {
  const queryClient = useQueryClient();
  const likesKey = ['post_likes', userId] as const;

  return useMutation({
    mutationFn: async (vars: { postId: string; liked: boolean }) => {
      if (vars.liked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', vars.postId)
          .eq('user_id', userId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_likes').insert({ post_id: vars.postId, user_id: userId! });
        if (error) throw error;
      }
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: likesKey });
      const previous = queryClient.getQueryData<Set<string>>(likesKey);
      const next = new Set(previous);
      if (vars.liked) next.delete(vars.postId);
      else next.add(vars.postId);
      queryClient.setQueryData(likesKey, next);
      // setQueriesData (not setQueryData) so this reaches whatever
      // [...POSTS_KEY, limit] page is actually mounted — see
      // useCommunityPosts' DEFAULT_POSTS_PAGE_SIZE comment.
      queryClient.setQueriesData<CommunityPostRow[]>({ queryKey: POSTS_KEY }, (posts) =>
        posts?.map((p) => (p.id === vars.postId ? { ...p, likesCount: p.likesCount + (vars.liked ? -1 : 1) } : p)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(likesKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: likesKey });
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

export function useTogglePostSave(userId: string | undefined) {
  const queryClient = useQueryClient();
  const savesKey = ['post_saves', userId] as const;

  return useMutation({
    mutationFn: async (vars: { postId: string; saved: boolean }) => {
      if (vars.saved) {
        const { error } = await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', vars.postId)
          .eq('user_id', userId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_saves').insert({ post_id: vars.postId, user_id: userId! });
        if (error) throw error;
      }
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: savesKey });
      const previous = queryClient.getQueryData<Set<string>>(savesKey);
      const next = new Set(previous);
      if (vars.saved) next.delete(vars.postId);
      else next.add(vars.postId);
      queryClient.setQueryData(savesKey, next);
      // setQueriesData (not setQueryData) so this reaches whatever
      // [...POSTS_KEY, limit] page is actually mounted — see
      // useCommunityPosts' DEFAULT_POSTS_PAGE_SIZE comment.
      queryClient.setQueriesData<CommunityPostRow[]>({ queryKey: POSTS_KEY }, (posts) =>
        posts?.map((p) => (p.id === vars.postId ? { ...p, savesCount: Math.max(0, p.savesCount + (vars.saved ? -1 : 1)) } : p)),
      );
      queryClient.setQueriesData<CommunityPostRow | null>({ queryKey: ['community_post', vars.postId] }, (post) =>
        post ? { ...post, savesCount: Math.max(0, post.savesCount + (vars.saved ? -1 : 1)) } : post,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(savesKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: savesKey });
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('community_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

export function useUpdatePost(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { postId: string; text: string }) => {
      if (!userId) throw new Error('authentication_required');
      const { error } = await supabase
        .from('community_posts')
        .update({ text: vars.text })
        .eq('id', vars.postId)
        .eq('author_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['community_post', vars.postId] });
    },
  });
}

export interface PostMediaItem {
  uri: string;
  mimeType?: string | null;
}

export interface CreatePostVars {
  text: string;
  media?: PostMediaItem[];
  dayMilestone?: number | null;
  phaseMilestone?: string | null;
  postType?: PostType;
  progressSnapshot?: ProgressSnapshot | null;
}

export function useCreatePost(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: CreatePostVars) => {
      const items = vars.media ?? [];
      const mediaUrls = items.length
        ? await Promise.all(items.map((item) => uploadCommunityImage(userId!, item.uri, item.mimeType)))
        : [];
      const { error } = await supabase.from('community_posts').insert({
        author_id: userId!,
        text: vars.text,
        image_url: mediaUrls[0] ?? null,
        media_urls: mediaUrls,
        tag: 'story',
        day_milestone: vars.dayMilestone ?? null,
        phase_milestone: vars.phaseMilestone ?? null,
        post_type: vars.postType ?? 'text',
        progress_snapshot: vars.progressSnapshot ? JSON.parse(JSON.stringify(vars.progressSnapshot)) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

/** Despite the name (kept for existing callers), this also uploads videos —
 * `mimeType`/extension decide the storage content-type (see uploadChatAttachment,
 * the same pattern used for chat attachments). Render side detects video by
 * file extension too (see CommunityPostImage), so no separate DB column is
 * needed to tell image and video posts apart. */
export async function uploadCommunityImage(userId: string, localUri: string, mimeType?: string | null): Promise<string> {
  const ext = (localUri.split('.').pop() || (mimeType?.startsWith('video/') ? 'mp4' : 'jpg')).split('?')[0].toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();
  const contentType =
    mimeType ??
    (ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'mov'
          ? 'video/quicktime'
          : ext === 'mp4' || ext === 'm4v'
            ? 'video/mp4'
            : 'image/jpeg');
  const { error } = await supabase.storage.from('community-images').upload(path, arrayBuffer, { contentType });
  if (error) throw error;
  return supabase.storage.from('community-images').getPublicUrl(path).data.publicUrl;
}

// ---- Comments (nested replies) ----

export interface CommentReplyRow {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  text: string;
  imageUrl: string | null;
  createdAt: string;
  likesCount: number;
  reactionCounts: Record<PostReaction, number>;
  replies: CommentReplyRow[];
  parentCommentId: string | null;
}

export type CommentRow = CommentReplyRow;

interface RawComment {
  id: string;
  author_id: string;
  parent_comment_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  text: string;
  image_url: string | null;
  likes_count: number;
  created_at: string;
}

function mapComment(r: RawComment, reactionCounts = emptyReactionCounts()): CommentReplyRow {
  return {
    id: r.id,
    authorId: r.author_id,
    authorName: r.author_name ?? 'Ẩn danh',
    authorAvatarUrl: r.author_avatar_url,
    text: r.text,
    imageUrl: r.image_url,
    createdAt: r.created_at,
    likesCount: r.likes_count,
    reactionCounts,
    replies: [],
    parentCommentId: r.parent_comment_id,
  };
}

export const DEFAULT_COMMENTS_PAGE_SIZE = 30;

/** Same growing-limit approach as useCommunityPosts — see its comment. */
export function usePostComments(postId: string | undefined, limit: number = DEFAULT_COMMENTS_PAGE_SIZE) {
  const queryClient = useQueryClient();
  const key = ['post_comments', postId] as const;
  const channelId = useRef(`post_comments_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`${channelId.current}_${postId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: key });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);

  return useQuery({
    queryKey: [...key, limit],
    queryFn: async (): Promise<CommentRow[]> => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, author_id, parent_comment_id, author_name, author_avatar_url, text, image_url, likes_count, created_at')
        .eq('post_id', postId!)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      const rows = data as RawComment[];
      const commentIds = rows.map((row) => row.id);
      const countsByComment = new Map<string, Record<PostReaction, number>>();
      if (commentIds.length) {
        const { data: reactions, error: reactionsError } = await supabase
          .from('comment_likes')
          .select('comment_id, reaction')
          .in('comment_id', commentIds);
        if (reactionsError) throw reactionsError;
        for (const item of reactions ?? []) {
          const key = item.reaction as PostReaction;
          if (!(key in emptyReactionCounts())) continue;
          const counts = countsByComment.get(item.comment_id) ?? emptyReactionCounts();
          counts[key] += 1;
          countsByComment.set(item.comment_id, counts);
        }
      }
      const commentsById = new Map<string, CommentReplyRow>();
      for (const r of rows) {
        commentsById.set(r.id, mapComment(r, countsByComment.get(r.id)));
      }
      const roots: CommentRow[] = [];
      for (const r of rows) {
        const comment = commentsById.get(r.id)!;
        const parent = r.parent_comment_id ? commentsById.get(r.parent_comment_id) : undefined;
        if (parent && parent.id !== comment.id) parent.replies.push(comment);
        else roots.push(comment);
      }
      return roots;
    },
    enabled: !!postId,
  });
}

export function useAddComment(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { postId: string; text: string; parentCommentId?: string; imageUri?: string | null; imageMimeType?: string | null }) => {
      if (!userId) throw new Error('authentication_required');
      const imageUrl = vars.imageUri ? await uploadCommunityImage(userId, vars.imageUri, vars.imageMimeType) : null;
      const { data, error } = await supabase.rpc('create_community_comment', {
        p_post_id: vars.postId,
        p_text: vars.text,
        p_parent_comment_id: vars.parentCommentId ?? undefined,
        p_image_url: imageUrl ?? undefined,
      });
      if (error) throw error;
      void supabase.functions.invoke('dispatch-push', {
        body: {
          mode: 'social',
          event: vars.parentCommentId ? 'reply' : 'comment',
          postId: vars.postId,
          commentId: data,
          parentCommentId: vars.parentCommentId,
          preview: vars.text,
        },
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['post_comments', vars.postId] });
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

/** Current user's selected reaction for both root comments and replies. */
export function useMyCommentReactions(userId: string | undefined) {
  return useQuery({
    queryKey: ['comment_reactions', userId],
    queryFn: async (): Promise<Map<string, PostReaction>> => {
      const { data, error } = await supabase.from('comment_likes').select('comment_id, reaction').eq('user_id', userId!);
      if (error) throw error;
      return new Map(data.map((row) => [row.comment_id, row.reaction as PostReaction]));
    },
    enabled: !!userId,
  });
}

function patchCommentTree(comments: CommentRow[] | undefined, commentId: string, patch: (comment: CommentRow) => CommentRow): CommentRow[] | undefined {
  return comments?.map((comment) => ({
    ...comment,
    ...(comment.id === commentId ? patch(comment) : {}),
    replies: patchCommentTree(comment.replies, commentId, patch) ?? [],
  }));
}

/**
 * One optimistic mutation for comments and replies. Requests for the same
 * comment are serialized, so a quick ❤️ → 💪 sequence always reaches the
 * database in the same order the user chose it.
 */
export function useSetCommentReaction(userId: string | undefined) {
  const queryClient = useQueryClient();
  const reactionsKey = ['comment_reactions', userId] as const;
  const queues = useRef(new Map<string, Promise<unknown>>());
  return useMutation({
    mutationFn: async (vars: { commentId: string; postId: string; current: PostReaction | null; reaction: PostReaction | null }) => {
      if (!userId) throw new Error('authentication_required');
      const preceding = queues.current.get(vars.commentId) ?? Promise.resolve();
      const task = preceding.catch(() => undefined).then(async () => {
        if (!vars.reaction) {
          const { error } = await supabase.from('comment_likes').delete().eq('comment_id', vars.commentId).eq('user_id', userId);
          if (error) throw error;
          return;
        }
        const { error } = await supabase.from('comment_likes').upsert(
          { comment_id: vars.commentId, user_id: userId, reaction: vars.reaction },
          { onConflict: 'comment_id,user_id' },
        );
        if (error) throw error;
      });
      queues.current.set(vars.commentId, task);
      try {
        await task;
      } finally {
        if (queues.current.get(vars.commentId) === task) queues.current.delete(vars.commentId);
      }
      // The database trigger writes the durable Notification Center record.
      // A push is sent only for the first reaction, never for reaction swaps.
      if (!vars.current && vars.reaction) {
        void supabase.functions.invoke('dispatch-push', {
          body: { mode: 'social', event: 'reaction', targetType: 'comment', postId: vars.postId, commentId: vars.commentId },
        });
      }
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: reactionsKey });
      const previous = queryClient.getQueryData<Map<string, PostReaction>>(reactionsKey);
      const next = new Map(previous);
      if (vars.reaction) next.set(vars.commentId, vars.reaction);
      else next.delete(vars.commentId);
      queryClient.setQueryData(reactionsKey, next);
      const previousComments = queryClient.getQueriesData<CommentRow[]>({ queryKey: ['post_comments', vars.postId] });
      const countDelta = (vars.reaction ? 1 : 0) - (vars.current ? 1 : 0);
      const patch = (comment: CommentRow): CommentRow => {
        const counts = { ...comment.reactionCounts };
        if (vars.current) counts[vars.current] = Math.max(0, counts[vars.current] - 1);
        if (vars.reaction) counts[vars.reaction] += 1;
        return { ...comment, likesCount: Math.max(0, comment.likesCount + countDelta), reactionCounts: counts };
      };
      queryClient.setQueriesData<CommentRow[]>({ queryKey: ['post_comments', vars.postId] }, (comments) => patchCommentTree(comments, vars.commentId, patch));
      return { previous, previousComments };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(reactionsKey, context.previous);
      context?.previousComments.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: reactionsKey });
      queryClient.invalidateQueries({ queryKey: ['post_comments', vars.postId] });
    },
  });
}

export function useUpdateComment(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { commentId: string; postId: string; text: string }) => {
      if (!userId) throw new Error('authentication_required');
      const { error } = await supabase
        .from('post_comments')
        .update({ text: vars.text })
        .eq('id', vars.commentId)
        .eq('author_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: ['post_comments', vars.postId] }),
  });
}

export function useDeleteComment(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { commentId: string; postId: string }) => {
      if (!userId) throw new Error('authentication_required');
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', vars.commentId)
        .eq('author_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['post_comments', vars.postId] });
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

// ---- Reports (content_reports — shared by posts and comments) ----

export type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'other';

export function useReportContent(userId: string | undefined) {
  return useMutation({
    mutationFn: async (vars: { contentType: 'post' | 'comment'; contentId: string; reason: ReportReason }) => {
      const { error } = await supabase.from('content_reports').insert({
        content_type: vars.contentType,
        content_id: vars.contentId,
        reason: vars.reason,
        reporter_id: userId!,
      });
      if (error) throw error;
    },
  });
}

// CSKH's mobile "Cộng đồng" tab (see app/(staff)/community.tsx) — a Reports
// queue, not full moderation. content_reports RLS grants cskh SELECT +
// UPDATE (resolve/dismiss), but hide/delete on community_posts/post_comments
// and locking a user are admin-only, so those actions aren't offered here.
// Mirrors WEB's fetchContentReports/resolveContentReport (TheraHOME WEB's
// src/lib/db.ts) — same shape, ported for React Query instead of a plain
// async function.
export interface ContentReportRow {
  id: string;
  contentType: 'post' | 'comment';
  contentId: string;
  reason: ReportReason;
  note: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  contentText: string | null;
  contentAuthorName: string | null;
  postId: string | null;
}

export function useContentReports() {
  return useQuery({
    queryKey: ['content_reports'],
    queryFn: async (): Promise<ContentReportRow[]> => {
      const { data: reports, error } = await supabase
        .from('content_reports')
        .select('id, content_type, content_id, reason, note, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const postIds = (reports ?? []).filter((r) => r.content_type === 'post').map((r) => r.content_id);
      const commentIds = (reports ?? []).filter((r) => r.content_type === 'comment').map((r) => r.content_id);

      const [{ data: posts, error: postErr }, { data: comments, error: commentErr }] = await Promise.all([
        postIds.length ? supabase.from('community_posts').select('id, text, author_name').in('id', postIds) : Promise.resolve({ data: [], error: null }),
        commentIds.length ? supabase.from('post_comments').select('id, text, author_name, post_id').in('id', commentIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (postErr) throw postErr;
      if (commentErr) throw commentErr;

      const postById = new Map((posts ?? []).map((p) => [p.id, p]));
      const commentById = new Map((comments ?? []).map((c) => [c.id, c]));

      return (reports ?? []).map((r): ContentReportRow => {
        if (r.content_type === 'post') {
          const p = postById.get(r.content_id);
          return {
            id: r.id,
            contentType: 'post',
            contentId: r.content_id,
            reason: r.reason as ReportReason,
            note: r.note,
            status: r.status as ContentReportRow['status'],
            createdAt: r.created_at,
            contentText: p?.text ?? null,
            contentAuthorName: p?.author_name ?? null,
            postId: p?.id ?? null,
          };
        }
        const c = commentById.get(r.content_id);
        return {
          id: r.id,
          contentType: 'comment',
          contentId: r.content_id,
          reason: r.reason as ReportReason,
          note: r.note,
          status: r.status as ContentReportRow['status'],
          createdAt: r.created_at,
          contentText: c?.text ?? null,
          contentAuthorName: c?.author_name ?? null,
          postId: c?.post_id ?? null,
        };
      });
    },
  });
}

export function useResolveContentReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; status: 'resolved' | 'dismissed' }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('content_reports')
        .update({ status: vars.status, resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
        .eq('id', vars.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content_reports'] }),
  });
}

export function useHiddenCommunityPosts(userId: string | undefined) {
  return useQuery({
    queryKey: ['hidden_community_posts', userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('hidden_community_posts').select('post_id').eq('user_id', userId!);
      if (error) throw error;
      return new Set(data.map((row) => row.post_id));
    },
    enabled: !!userId,
  });
}

export function useHideCommunityPost(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('hidden_community_posts').insert({ user_id: userId!, post_id: postId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hidden_community_posts', userId] }),
  });
}

export function useHiddenCommunityComments(userId: string | undefined) {
  return useQuery({
    queryKey: ['hidden_community_comments', userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('hidden_community_comments').select('comment_id').eq('user_id', userId!);
      if (error) throw error;
      return new Set(data.map((row) => row.comment_id));
    },
    enabled: !!userId,
  });
}

export function useHideCommunityComment(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!userId) throw new Error('authentication_required');
      const { error } = await supabase.from('hidden_community_comments').insert({ user_id: userId, comment_id: commentId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hidden_community_comments', userId] }),
  });
}

export function useBlockedCommunityUsers(userId: string | undefined) {
  return useQuery({
    queryKey: ['blocked_community_users', userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('blocked_community_users').select('blocked_id').eq('blocker_id', userId!);
      if (error) throw error;
      return new Set(data.map((row) => row.blocked_id));
    },
    enabled: !!userId,
  });
}

export function useBlockCommunityUser(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await supabase.from('blocked_community_users').insert({ blocker_id: userId!, blocked_id: blockedId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocked_community_users', userId] }),
  });
}

export interface CommunityProfileRow {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  currentStreak: number;
  completedPrograms: number;
  postsCount: number;
  completedDays: number;
}

export function useCommunityProfile(profileUserId: string | undefined) {
  return useQuery({
    queryKey: ['community_profile', profileUserId],
    queryFn: async (): Promise<CommunityProfileRow | null> => {
      const { data, error } = await supabase.rpc('get_community_profile', { p_user_id: profileUserId! });
      if (error) throw error;
      const row = data[0];
      return row ? {
        userId: row.user_id,
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
        currentStreak: row.current_streak,
        completedPrograms: row.completed_programs,
        postsCount: row.posts_count,
        completedDays: row.completed_days,
      } : null;
    },
    enabled: !!profileUserId,
  });
}
