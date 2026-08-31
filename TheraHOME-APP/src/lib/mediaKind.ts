// Same extension check used to tell chat/community image and video
// attachments apart (see attachmentKind in useChat.ts) — kept consistent
// so a single url column can hold either without a dedicated DB flag.
const VIDEO_EXTENSION = /\.(mp4|mov|m4v|webm)(?:$|\?)/i;

export function isVideoUri(uri: string): boolean {
  return VIDEO_EXTENSION.test(uri);
}
