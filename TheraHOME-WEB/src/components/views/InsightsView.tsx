"use client";

// Real data: user_quiz_attempts (phase surveys) + phase_purchases (IAP
// unlocks). Both tables have been collecting rows since the quiz/IAP work
// shipped, but nothing read them outside SQL — added 2026-09-04 so the
// answers people give and the unlocks they buy are actually visible.
import { Fragment, useEffect, useMemo, useState } from "react";
import { TableShell } from "@/components/ui/TableShell";
import { Modal } from "@/components/ui/Modal";
import { GhostBtn, Badge } from "@/components/ui/primitives";
import { pushToast } from "@/components/ui/Toast";
import { fetchSurveyAttempts, fetchPhasePurchases, type SurveyAttempt, type PurchaseRow } from "@/lib/db";

type Tab = "surveys" | "purchases";
const TABS: Array<[Tab, string]> = [
  ["surveys", "Kết quả khảo sát"],
  ["purchases", "Giao dịch mở khoá"],
];

const PLATFORM_LABEL: Record<string, string> = {
  apple: "Apple IAP",
  google: "Google Play",
  admin_granted: "Cấp tay (Admin)",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function InsightsView() {
  const [tab, setTab] = useState<Tab>("surveys");
  const [surveys, setSurveys] = useState<SurveyAttempt[] | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[] | null>(null);
  const [detail, setDetail] = useState<SurveyAttempt | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetchSurveyAttempts().then(setSurveys).catch(() => pushToast("Không thể tải kết quả khảo sát"));
    fetchPhasePurchases().then(setPurchases).catch(() => pushToast("Không thể tải giao dịch"));
  }, []);

  // Most-picked answer per question — the actual reason to look at surveys:
  // it shows which guidance people are getting wrong at scale.
  const answerStats = useMemo(() => {
    const byQuestion = new Map<string, Map<string, number>>();
    for (const attempt of surveys ?? []) {
      for (const a of attempt.answers) {
        if (!a.question) continue;
        const counts = byQuestion.get(a.question) ?? new Map<string, number>();
        counts.set(a.answer, (counts.get(a.answer) ?? 0) + 1);
        byQuestion.set(a.question, counts);
      }
    }
    return [...byQuestion.entries()].map(([question, counts]) => {
      const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      return { question, total, options: sorted };
    });
  }, [surveys]);

  const filteredSurveys = (surveys ?? []).filter((s) =>
    !q.trim() ||
    s.userName.toLowerCase().includes(q.toLowerCase()) ||
    s.phaseName.toLowerCase().includes(q.toLowerCase()) ||
    s.productName.toLowerCase().includes(q.toLowerCase()),
  );
  const filteredPurchases = (purchases ?? []).filter((p) =>
    !q.trim() ||
    p.userName.toLowerCase().includes(q.toLowerCase()) ||
    p.productName.toLowerCase().includes(q.toLowerCase()),
  );

  const tabSwitcher = (
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {TABS.map(([key, label]) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          style={{
            border: "1px solid " + (tab === key ? "var(--color-primary)" : "var(--border-input)"),
            background: tab === key ? "var(--color-primary-tint-10)" : "#fff",
            color: tab === key ? "var(--color-primary)" : "var(--text-secondary)",
            borderRadius: 8,
            padding: "7px 14px",
            fontFamily: "var(--font-family)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (tab === "purchases") {
    const active = filteredPurchases.filter((p) => !p.revokedAt).length;
    return (
      <div>
        {tabSwitcher}
        <TableShell
          subtitle={`Toàn bộ lượt mở khoá giai đoạn. Đang hiệu lực: ${active}/${filteredPurchases.length}. "Cấp tay" là quyền admin cấp trực tiếp, không phải giao dịch thật.`}
          searchPlaceholder="Tìm theo người dùng hoặc sản phẩm..."
          searchValue={q}
          onSearchChange={setQ}
          columns={["Người dùng", "Sản phẩm · Giai đoạn", "Nguồn", "Thời điểm", "Trạng thái"]}
        >
          {purchases === null ? null : filteredPurchases.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: "24px 20px", color: "var(--text-muted)" }}>Chưa có giao dịch nào.</td></tr>
          ) : (
            filteredPurchases.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--divider)" }}>
                <td style={{ padding: "14px 20px", fontWeight: 600, color: "var(--text-primary)" }}>{p.userName}</td>
                <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>
                  <div>{p.productName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.phaseName}</div>
                </td>
                <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{PLATFORM_LABEL[p.platform] ?? p.platform}</td>
                <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{formatDate(p.purchasedAt)}</td>
                <td style={{ padding: "14px 20px" }}>
                  {p.revokedAt ? (
                    <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">Đã thu hồi</Badge>
                  ) : (
                    <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Đang hiệu lực</Badge>
                  )}
                </td>
              </tr>
            ))
          )}
        </TableShell>
      </div>
    );
  }

  return (
    <div>
      {tabSwitcher}

      {answerStats.length ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-card)", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 4 }}>Tổng hợp câu trả lời</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 16 }}>
            Đáp án người dùng chọn nhiều nhất cho mỗi câu — dùng để biết nội dung nào đang bị hiểu sai và cần nhấn mạnh lại trong bài tập.
          </div>
          {answerStats.map((stat) => (
            <div key={stat.question} style={{ paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid var(--divider)" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                {stat.question} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· {stat.total} lượt</span>
              </div>
              {stat.options.map(([answer, count]) => {
                const pct = Math.round((count / stat.total) * 100);
                return (
                  <div key={answer} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>{answer}</div>
                    <div style={{ width: 160, height: 8, background: "var(--bg-card-alt)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-primary)" }} />
                    </div>
                    <div style={{ width: 58, textAlign: "right", fontSize: 12.5, color: "var(--text-muted)" }}>{count} · {pct}%</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      <TableShell
        subtitle="Từng lượt khảo sát người dùng đã nộp sau mỗi giai đoạn. Bấm Xem để đọc đầy đủ câu hỏi và đáp án họ chọn."
        searchPlaceholder="Tìm theo người dùng, sản phẩm hoặc giai đoạn..."
        searchValue={q}
        onSearchChange={setQ}
        columns={["Người dùng", "Sản phẩm · Giai đoạn", "Số câu", "Thời điểm", "Thao tác"]}
        modals={
          detail ? (
            <Modal
              title={"Khảo sát · " + detail.userName}
              onClose={() => setDetail(null)}
              width={560}
              footer={<GhostBtn onClick={() => setDetail(null)}>Đóng</GhostBtn>}
            >
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 16 }}>
                {detail.productName} · {detail.phaseName} · {formatDate(detail.completedAt)}
              </div>
              {detail.answers.map((a, i) => (
                <div key={i} style={{ background: "var(--bg-card-alt)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{a.question}</div>
                  <div style={{ fontSize: 13, color: "var(--color-primary)" }}>→ {a.answer}</div>
                </div>
              ))}
            </Modal>
          ) : null
        }
      >
        {surveys === null ? null : filteredSurveys.length === 0 ? (
          <tr><td colSpan={5} style={{ padding: "24px 20px", color: "var(--text-muted)" }}>Chưa có khảo sát nào được nộp.</td></tr>
        ) : (
          filteredSurveys.map((s) => (
            <tr key={s.id} style={{ borderTop: "1px solid var(--divider)" }}>
              <td style={{ padding: "14px 20px", fontWeight: 600, color: "var(--text-primary)" }}>{s.userName}</td>
              <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>
                <div>{s.productName}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.phaseName}</div>
              </td>
              <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{s.answers.length}</td>
              <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{formatDate(s.completedAt)}</td>
              <td style={{ padding: "14px 20px" }}>
                <GhostBtn onClick={() => setDetail(s)}>Xem</GhostBtn>
              </td>
            </tr>
          ))
        )}
      </TableShell>
    </div>
  );
}
