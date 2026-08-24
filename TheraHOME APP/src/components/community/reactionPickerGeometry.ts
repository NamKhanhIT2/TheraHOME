// Single source of truth for the reaction tray's size/position math, shared
// by ReactionPicker's own styles and every screen's long-press-drag hit
// test. Previously each of the three call sites (feed, post detail, comment)
// hardcoded its own copy of these numbers — they drifted from what
// ReactionPicker actually rendered, and the hit-test's tight vertical band
// meant a naturally wavering finger would drop out of the drag zone before
// reaching every icon.
import { POST_REACTIONS, type PostReaction } from '@/hooks/useCommunity';

export const REACTION_ITEM_SIZE = 40;
export const REACTION_GAP = 8;
export const REACTION_PAD_H = 12;
export const REACTION_PAD_V = 9;
export const REACTION_EMOJI_SIZE = 32;

const REACTION_COUNT = POST_REACTIONS.length;
export const REACTION_TRAY_WIDTH = REACTION_COUNT * REACTION_ITEM_SIZE + (REACTION_COUNT - 1) * REACTION_GAP + REACTION_PAD_H * 2;
export const REACTION_TRAY_HEIGHT = REACTION_ITEM_SIZE + REACTION_PAD_V * 2;

// Generous — a real finger wavers vertically while dragging sideways, and
// losing the hover mid-drag reads as "can't reach that icon".
const VERTICAL_SLOP = 44;

// Clear space between the pressed fingertip and the tray's bottom edge.
const ANCHOR_GAP = 28;

export interface ReactionTrayAnchor {
  pageX: number;
  pageY: number;
}

export interface ReactionTrayFrame {
  left: number;
  top: number;
}

/** Centers the tray on the press point (clamped to stay on-screen) so it
 * always appears exactly where the finger went down. */
export function getReactionTrayFrame(anchor: ReactionTrayAnchor, windowWidth: number): ReactionTrayFrame {
  const left = Math.max(10, Math.min(anchor.pageX - REACTION_TRAY_WIDTH / 2, windowWidth - REACTION_TRAY_WIDTH - 10));
  const top = Math.max(58, anchor.pageY - REACTION_TRAY_HEIGHT - ANCHOR_GAP);
  return { left, top };
}

/** X is clamped rather than bounds-checked, so overshooting past the first/
 * last icon still resolves to that edge icon instead of losing the hover —
 * matches how a native reaction tray lets you drag past the end and still
 * land on it. Only Y (with slop) can cancel the hover, e.g. dragging down
 * onto the feed to back out without selecting. */
export function pickerReactionAt(touch: ReactionTrayAnchor, frame: ReactionTrayFrame): PostReaction | null {
  if (touch.pageY < frame.top - VERTICAL_SLOP || touch.pageY > frame.top + REACTION_TRAY_HEIGHT + VERTICAL_SLOP) return null;
  const innerWidth = REACTION_TRAY_WIDTH - REACTION_PAD_H * 2;
  const relativeX = Math.max(0, Math.min(innerWidth - 1, touch.pageX - frame.left - REACTION_PAD_H));
  const index = Math.max(0, Math.min(REACTION_COUNT - 1, Math.floor(relativeX / (REACTION_ITEM_SIZE + REACTION_GAP))));
  return POST_REACTIONS[index]?.key ?? null;
}
