"use client";

// Giao việc — the one place a job starts from.
import { Avatar, NotConnected, Pill, SectionTitle } from "@/components/agent/parts";
import { useConsole } from "@/components/agent/state";
import { AGENTS, QUICK_COMMANDS, agentById, type AgentId } from "@/lib/agentConsole";

export function DispatchView() {
  const { tasks, dispatch, canApprove, actor, draftAgent, setDraftAgent, draftCommand, setDraftCommand } = useConsole();

  function submit() {
    const text = draftCommand.trim();
    if (!text) return;
    dispatch(draftAgent, text, actor);
    setDraftCommand("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="ac-card ac-in ac-card-pad">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 340px", minWidth: 0 }}>
            <label htmlFor="ac-cmd" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ac-ink-2)", marginBottom: 6 }}>
              Việc cần giao
            </label>
            <textarea
              id="ac-cmd"
              className="ac-input"
              value={draftCommand}
              onChange={(e) => setDraftCommand(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line — this box takes one
                // short instruction at a time, not essays.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ví dụ: CPA blended đang vượt trần — chỉ ra nhóm quảng cáo nào đang kéo nó lên."
              style={{ minHeight: 72, resize: "vertical" }}
            />
          </div>
          <div style={{ flex: "0 0 auto" }}>
            <label htmlFor="ac-agent" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ac-ink-2)", marginBottom: 6 }}>
              Agent
            </label>
            <select id="ac-agent" className="ac-input" value={draftAgent} onChange={(e) => setDraftAgent(e.target.value as AgentId)} style={{ width: "auto", minWidth: 192 }}>
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id} disabled={!a.enabled}>
                  {a.name}
                  {a.enabled ? "" : " (đang tắt)"}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="ac-btn ac-btn-primary" onClick={submit}>Giao việc</button>
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--ac-line)" }}>
          {QUICK_COMMANDS.map((q) => {
            const blocked = q.ownerOnly && !canApprove;
            return (
              <button
                key={q.command}
                type="button"
                className="ac-chip"
                disabled={blocked}
                title={blocked ? "Lệnh này đổi ngân sách — chỉ Hoan chạy được" : undefined}
                onClick={() => {
                  setDraftCommand(`${q.command} `);
                  setDraftAgent(q.agent);
                }}
              >
                {q.command}
                {blocked ? " · chỉ Hoan" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <SectionTitle>Dòng việc phiên này</SectionTitle>

      {tasks.length === 0 ? (
        <NotConnected icon="send" title="Chưa giao việc nào">
          Việc bạn giao sẽ hiện ở đây. Console chưa nối Claude API nên agent chưa thật sự chạy — thẻ việc sẽ nói rõ điều đó thay vì giả vờ xong.
        </NotConnected>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tasks.map((t) => {
            const def = agentById(t.agent);
            return (
              <div key={t.id} className="ac-card ac-in ac-card-pad" style={{ borderLeft: `3px solid ${t.status === "done" ? "var(--ac-good)" : "var(--ac-accent)"}`, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <Avatar initials={def.initials} />
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ac-ink)" }}>{def.name}</span>
                  <Pill tone={t.status === "done" ? "good" : "neutral"}>{t.status === "done" ? "Xong" : "Đang chạy"}</Pill>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ac-ink-3)" }}>{t.at} · {t.requestedBy}</span>
                </div>
                <div style={{ background: "var(--ac-bg)", border: "1px solid var(--ac-line)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: "var(--ac-ink)", overflowWrap: "anywhere" }}>
                  {t.command}
                </div>
                {t.result ? <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ac-ink-2)" }}>{t.result}</div> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
