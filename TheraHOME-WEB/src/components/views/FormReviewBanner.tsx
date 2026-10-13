"use client";

// Tells the specialist what they are looking at, and lets them close it off.
//
// Ported from the app's src/components/chat/FormReviewBanner.tsx, which was
// the ONLY place a clip could be marked graded. A CSKH working in the browser
// could watch the video and type an answer, and the review row stayed
// 'pending' for ever — so the customer kept reading "đang chờ chuyên viên"
// after being answered, the work-queue alert never closed, and the prune cron
// (which only touches `reviewed` and `cancelled`) never deleted the clip.
// Owner 2026-10-13.
//
// Deliberately in the thread rather than on a queue screen of its own. The
// work happens here — watch the clip, type the answer in this conversation —
// so the button that says "done" belongs here too, where it cannot be ticked
// by someone who has not actually replied.
import { useCallback, useEffect, useState } from "react";
import { completeFormReview, fetchPendingFormReview, type PendingFormReview } from "@/lib/db";
import { errorMessage } from "@/lib/errorMessage";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";

function waited(createdAt: string): string {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  if (hours < 1) return "vừa gửi";
  if (hours < 24) return `đã chờ ${hours} giờ`;
  return `đã chờ ${Math.floor(hours / 24)} ngày`;
}

export function FormReviewBanner({ threadId, messageCount }: {
  threadId: string | undefined;
  /** Re-reads when the conversation changes, so sending a clip from the app
   * makes the banner appear without a page reload, and a second specialist
   * marking it graded makes it go away. */
  messageCount: number;
}) {
  const [pending, setPending] = useState<PendingFormReview | null>(null);
  const [busy, setBusy] = useState(false);

  // Every setPending happens in a promise callback, never in the effect
  // body: a synchronous setState there is a cascading render, and React's
  // lint rule rejects it.
  const load = useCallback(() => {
    const read = threadId ? fetchPendingFormReview(threadId) : Promise.resolve(null);
    read.then(setPending).catch(() => setPending(null));
  }, [threadId]);

  useEffect(() => {
    let cancelled = false;
    const read = threadId ? fetchPendingFormReview(threadId) : Promise.resolve(null);
    read
      .then((row) => { if (!cancelled) setPending(row); })
      .catch(() => { if (!cancelled) setPending(null); });
    // Switching threads mid-request must not let the old thread's answer
    // land on the new one's banner.
    return () => { cancelled = true; };
  }, [threadId, messageCount]);

  if (!pending) return null;

  async function markDone() {
    setBusy(true);
    try {
      await completeFormReview(pending!.id);
      pushToast("Đã đánh dấu chấm xong");
      setPending(null);
    } catch (e) {
      const message = errorMessage(e);
      // Somebody else ticked it while this was open. Not an error worth
      // alarming anyone about — the work is done either way.
      pushToast(message.includes("review_not_pending") ? "Clip này đã được chấm rồi" : "Không đánh dấu được, thử lại nhé");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      background: "var(--color-primary-tint-10)", borderBottom: "1px solid var(--divider)",
    }}>
      <Icon name="film" size={18} color="var(--color-primary)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-primary)" }}>
          Khách gửi video bài tập{pending.dayNumber ? ` · Ngày ${pending.dayNumber}` : ""}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {pending.dayLabel ? `${pending.dayLabel} · ` : ""}
          {waited(pending.createdAt)}
          {pending.videoBytes ? ` · ${(pending.videoBytes / 1048576).toFixed(1)} MB` : ""}
          {" · xem video trong khung chat rồi nhận xét ngay tại đây"}
        </div>
      </div>
      <button
        onClick={() => void markDone()}
        disabled={busy}
        title="Đánh dấu là đã nhận xét video này. Hãy chắc chắn bạn đã trả lời khách trong khung chat."
        style={{
          border: "none", background: "var(--color-primary)", color: "#fff", borderRadius: 999,
          padding: "8px 16px", fontFamily: "var(--font-family)", fontSize: 13, fontWeight: 700,
          cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, flexShrink: 0,
        }}
      >
        {busy ? "Đang lưu..." : "Đã chấm"}
      </button>
    </div>
  );
}
