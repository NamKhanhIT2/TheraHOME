"use client";

// Real data: ai_prompts (singleton system prompt row) / ai_suggested_replies.
// chat-ai-reply reads the system prompt from ai_prompts at request time, and
// the mobile AI chat's suggestion chips read ai_suggested_replies — so
// changes made here take effect immediately, unlike the earlier local-only
// mock (see TheraHOME WEB/CLAUDE.md).
import { useEffect, useState } from "react";
import { SectionCard, PrimaryBtn, GhostBtn } from "@/components/ui/primitives";
import { pushToast } from "@/components/ui/Toast";
import { addAISuggestedReply, deleteAISuggestedReply, fetchAIPrompt, fetchAISuggestedReplies, updateAIPrompt, type AISuggestedReply } from "@/lib/db";

export function AIPromptsView() {
  const [prompt, setPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [replies, setReplies] = useState<AISuggestedReply[] | null>(null);
  const [newReply, setNewReply] = useState("");
  const [addingReply, setAddingReply] = useState(false);

  function reload() {
    fetchAIPrompt().then(setPrompt).catch(() => pushToast("Không thể tải system prompt"));
    fetchAISuggestedReplies().then(setReplies).catch(() => pushToast("Không thể tải phản hồi mẫu"));
  }

  useEffect(reload, []);

  async function savePrompt() {
    if (savingPrompt) return;
    setSavingPrompt(true);
    try {
      await updateAIPrompt(prompt);
      pushToast("Đã lưu system prompt");
    } catch {
      pushToast("Không thể lưu system prompt");
    } finally {
      setSavingPrompt(false);
    }
  }

  async function addReply() {
    const text = newReply.trim();
    if (!text || addingReply) return;
    setAddingReply(true);
    try {
      await addAISuggestedReply(text, replies?.length ?? 0);
      setNewReply("");
      fetchAISuggestedReplies().then(setReplies).catch(() => pushToast("Không thể tải phản hồi mẫu"));
    } catch {
      pushToast("Không thể thêm phản hồi mẫu");
    } finally {
      setAddingReply(false);
    }
  }

  async function removeReply(id: string) {
    const prev = replies;
    setReplies((rs) => (rs ?? []).filter((r) => r.id !== id));
    try {
      await deleteAISuggestedReply(id);
    } catch {
      pushToast("Không thể xóa phản hồi mẫu");
      setReplies(prev ?? null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionCard title="System prompt — Trợ lý AI" action={<PrimaryBtn onClick={savePrompt}>{savingPrompt ? "Đang lưu..." : "Lưu thay đổi"}</PrimaryBtn>}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ width: "100%", minHeight: 110, border: "1px solid var(--border-input)", borderRadius: 10, padding: 14, fontFamily: "var(--font-family)", fontSize: 13.5, lineHeight: 1.6, resize: "vertical", boxSizing: "border-box" }}
        />
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Prompt này được Edge Function chat-ai-reply đọc trực tiếp mỗi khi Trợ lý AI trả lời — thay đổi có hiệu lực ngay, không cần deploy lại.
        </div>
      </SectionCard>
      <SectionCard
        title="Phản hồi mẫu"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newReply}
              onChange={(e) => setNewReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addReply()}
              placeholder="Câu gợi ý mới..."
              style={{ border: "1px solid var(--border-input)", borderRadius: 8, padding: "7px 10px", fontFamily: "var(--font-family)", fontSize: 13 }}
            />
            <PrimaryBtn icon="plus" onClick={addReply}>{addingReply ? "Đang thêm..." : "Thêm mẫu"}</PrimaryBtn>
          </div>
        }
      >
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
          Hiển thị dưới dạng chip gợi ý trong màn chat AI trên app khi chưa có tin nhắn nào.
        </div>
        {replies === null ? (
          <div style={{ color: "var(--text-secondary)", padding: "12px 0" }}>Đang tải...</div>
        ) : replies.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", padding: "12px 0" }}>Chưa có phản hồi mẫu nào.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {replies.map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                <div style={{ flex: 1, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{r.text}</div>
                <GhostBtn color="var(--error)" onClick={() => removeReply(r.id)}>Xóa</GhostBtn>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
