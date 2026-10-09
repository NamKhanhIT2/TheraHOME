"use client";

import { Icon } from "@/components/ui/Icon";
import { Avatar, Pill, Tag } from "@/components/agent/parts";
import { useConsole } from "@/components/agent/state";
import { AGENTS } from "@/lib/agentConsole";

export function TeamView({ setActive }: { setActive: (id: string) => void }) {
  const { setDraftAgent } = useConsole();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ac-ink-2)", maxWidth: 680 }}>
        Mỗi agent là một subagent trong plugin <strong style={{ color: "var(--ac-ink)" }}>therahome-ai-team</strong>. Hai skill dùng chung cho cả đội:{" "}
        <strong style={{ color: "var(--ac-ink)" }}>brand-knowledge</strong> đọc đúng thông tin thương hiệu, <strong style={{ color: "var(--ac-ink)" }}>compliance-check</strong> chặn các cụm từ không chạy được quảng cáo.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {AGENTS.map((a, i) => (
          <div key={a.id} className="ac-card ac-card-hover ac-in ac-card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, "--d": `${i * 60}ms` } as React.CSSProperties}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Avatar initials={a.initials} size={36} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ac-ink)" }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "var(--ac-ink-3)" }}>{a.role}</div>
              </div>
              <Pill tone={a.enabled ? "good" : "neutral"}>{a.enabled ? "Đang bật" : "Đang tắt"}</Pill>
            </div>

            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--ac-ink-2)" }}>{a.summary}</p>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {a.skills.map((s) => <Tag key={s}>{s}</Tag>)}
            </div>

            {a.sources.length ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ac-ink-3)" }}>
                <Icon name="link-2" size={13} color="var(--ac-ink-3)" />
                Đọc từ: {a.sources.join(", ")}
              </div>
            ) : null}

            <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--ac-line)" }}>
              <button
                type="button"
                className="ac-btn"
                disabled={!a.enabled}
                onClick={() => {
                  setDraftAgent(a.id);
                  setActive("dispatch");
                }}
                style={{ padding: "7px 14px", fontSize: 12.5 }}
              >
                Giao việc
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
