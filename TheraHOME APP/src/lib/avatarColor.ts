// Community posts/comments show a colored-initial avatar (matching the
// design), not the author's real photo — deterministic per author so the
// same person's color stays stable across the feed without storing it.
const AVATAR_PALETTE = ['#FFD9A0', '#BFEAD0', '#C9BEFF', '#FFC2C2', '#A8DBFF', '#E3C9FF'];

export function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
