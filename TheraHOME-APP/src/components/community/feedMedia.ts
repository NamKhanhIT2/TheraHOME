/**
 * One shape for every media block in the feed.
 *
 * The preview used to take its height from the photo: a 9:16 phone shot was
 * clamped to 4:5, a landscape one to 1.91:1, and everything between kept its
 * own ratio — so no two posts were the same height and the feed had no
 * rhythm at all. The owner asked for a fixed preview (2026-10-26), so every
 * post's media occupies exactly this box, whatever is inside it:
 *
 *   1 item   → the box
 *   2 items  → two columns inside the box
 *   3 items  → one tall left, two stacked right
 *   4+       → 2×2, with "+N" over the last cell
 *
 * Photos fill it (`cover`) — cropping is what every feed does, and the
 * uncropped frame is one tap away in the viewer. A landscape VIDEO is
 * letterboxed inside it instead (`contain`), because cropping a video to
 * portrait throws away most of the picture rather than its margins.
 */
export const FEED_MEDIA_RATIO = 4 / 5;
