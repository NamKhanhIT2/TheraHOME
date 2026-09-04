import type { CommunityPostRow, PostReaction } from '@/hooks/useCommunity';

const HOUR_MS = 60 * 60 * 1000;

export interface RankedCommunityPost {
  post: CommunityPostRow;
  score: number;
}

/**
 * Small, explainable feed ranker inspired by the inventory → signals → score
 * → diversity pipeline used by large social feeds. It deliberately uses only
 * explicit activity and public post metadata; health/profile answers are not
 * ranking inputs.
 */
export function rankCommunityPosts(
  posts: CommunityPostRow[],
  myReactions: Map<string, PostReaction>,
  savedPostIds: Set<string>,
  now = Date.now(),
): CommunityPostRow[] {
  const affinityByAuthor = new Map<string, number>();

  for (const post of posts) {
    if (!post.authorId) continue;
    const explicitInterest = (myReactions.has(post.id) ? 2 : 0) + (savedPostIds.has(post.id) ? 3 : 0);
    if (explicitInterest) affinityByAuthor.set(post.authorId, (affinityByAuthor.get(post.authorId) ?? 0) + explicitInterest);
  }

  const scored: RankedCommunityPost[] = posts.map((post) => {
    const ageHours = Math.max(0, (now - new Date(post.createdAt).getTime()) / HOUR_MS);
    const freshness = 28 * Math.exp(-ageHours / 72);
    // Replies/saves represent more intent than a lightweight reaction. Caps
    // keep one viral post from permanently crowding new contributions out.
    const meaningfulEngagement =
      Math.min(post.commentsCount * 3, 24) +
      Math.min(post.savesCount * 2, 14) +
      Math.min(post.likesCount * 0.55, 12);
    const authorAffinity = post.authorId ? Math.min(affinityByAuthor.get(post.authorId) ?? 0, 12) : 0;
    const mediaQuality = post.mediaUrls.length ? 2 : 0;
    const editorial = post.pinned ? 100 : post.isOfficial ? 4 : 0;

    return {
      post,
      score: editorial + freshness + meaningfulEngagement + authorAffinity + mediaQuality,
    };
  });

  scored.sort((a, b) => b.score - a.score || new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime());

  // Avoid long runs from one author. Pick the best alternative from the next
  // few candidates, without destroying relevance ordering globally.
  for (let index = 2; index < scored.length; index += 1) {
    const authorId = scored[index].post.authorId;
    if (!authorId || scored[index - 1].post.authorId !== authorId || scored[index - 2].post.authorId !== authorId) continue;
    const alternativeIndex = scored.findIndex((candidate, candidateIndex) => candidateIndex > index && candidateIndex <= index + 6 && candidate.post.authorId !== authorId);
    if (alternativeIndex > index) {
      const [alternative] = scored.splice(alternativeIndex, 1);
      scored.splice(index, 0, alternative);
    }
  }

  return scored.map(({ post }) => post);
}
