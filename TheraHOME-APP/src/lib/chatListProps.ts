/**
 * Shared scroll behaviour for the three inverted message lists (patient chat
 * with a specialist, the AI assistant, and the staff side of a thread).
 *
 * `minIndexForVisible: 0` alone — which is what two of the lists had, and the
 * third had nothing at all — tells the list to HOLD ITS POSITION when rows are
 * added at index 0. On an inverted list index 0 is the newest message, so an
 * arriving message was deliberately kept out of view: the sender saw it
 * (their screen scrolls itself in submit()), while the receiver got a message
 * that landed below the fold, half of it behind the composer (owner report,
 * 2026-09-07: "ở bên nhận ko thấy hết nội dung tin nhắn mà phần dưới bị che
 * bởi ô nhập tin").
 *
 * `autoscrollToTopThreshold` is the missing half. "Top" is the inverted
 * list's own axis, so it means the newest end: while the reader is within
 * this many points of the newest message, the list follows new arrivals; once
 * they have scrolled up into history it leaves them alone. That is exactly
 * how Messages, Telegram and WhatsApp behave — you stay pinned to the bottom
 * unless you deliberately scrolled away, and nothing ever yanks you mid-read.
 *
 * 120 is a little over two lines of a bubble, so a reader who is essentially
 * at the bottom follows along, and one who has scrolled up even slightly to
 * re-read something does not get pulled back.
 */
export const CHAT_FOLLOW_NEW_MESSAGES = {
  minIndexForVisible: 0,
  autoscrollToTopThreshold: 120,
} as const;
