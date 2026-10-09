"use client";

// Trung tâm điều hành Agent — a third console surface beside /admin and /care,
// for running the TheraHOME AI team from the browser.
//
// Open to admin and cskh — the customer-care accounts are the staff this
// business has, so "nhân viên" and `cskh` are the same people. What differs
// inside is what you may release: only admin decides an approval or runs a
// command that changes advertising spend. That rule is enforced in the
// database too (admin-only write policy on `agent_approvals`), not just here.
// Reached from the account menu on the public site; it deliberately does not
// cross-link to Admin, which is a different job.
//
// Its figures come from src/lib/agentConsole.ts — real, dated, and a snapshot
// rather than a feed. Read the note at the top of that file before wiring any
// connector.
import { AccessGate, useWebAccess } from "@/components/AccessGate";
import { AgentShell, type ConsoleNavGroup } from "@/components/agent/AgentShell";
import { ConsoleProvider } from "@/components/agent/state";
import { OverviewView } from "@/components/agent/OverviewView";
import { CampaignsView } from "@/components/agent/CampaignsView";
import { DispatchView } from "@/components/agent/DispatchView";
import { TeamView } from "@/components/agent/TeamView";
import { ApprovalsView } from "@/components/agent/ApprovalsView";
import { BotsView } from "@/components/agent/BotsView";
import { LogView } from "@/components/agent/LogView";

const GROUPS: ConsoleNavGroup[] = [
  {
    label: "Số liệu",
    items: [
      { id: "overview", label: "Tổng quan", icon: "grid", blurb: "Đơn, doanh thu, chi quảng cáo và CPA của khoảng đang chọn" },
      { id: "campaigns", label: "Chiến dịch", icon: "megaphone", blurb: "Chi Meta ghép với đơn Pancake qua utm_campaign, theo khoảng đang chọn" },
    ],
  },
  {
    label: "Đội agent",
    items: [
      { id: "dispatch", label: "Giao việc", icon: "send", blurb: "Một ô lệnh, bảy agent, một dòng việc" },
      { id: "team", label: "Đội agent", icon: "sparkles", blurb: "Ai làm gì, đọc dữ liệu từ đâu" },
      { id: "approvals", label: "Chờ duyệt", icon: "check-square", blurb: "Agent chuẩn bị, Hoan quyết" },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { id: "bots", label: "Bot CSKH", icon: "message-circle", blurb: "Hai bot trả lời khách trước khi tới người" },
      { id: "log", label: "Nhật ký", icon: "clock", blurb: "Ai giao gì, agent nào chạy, ai duyệt" },
    ],
  },
];

export default function AgentPage() {
  return (
    <AccessGate requiredRole={["admin", "cskh"]}>
      <ConsoleBody />
    </AccessGate>
  );
}

/** The only component in the console that touches the signed-in person.
 * Everything below it takes what it needs as props, which is what lets the
 * shell and its views be rendered outside an authenticated session. */
function ConsoleBody() {
  const { roles, email, signOut } = useWebAccess();
  const isAdmin = roles.includes("admin");
  return (
    <ConsoleProvider canApprove={isAdmin} actor={email.split("@")[0] || "Bạn"}>
      <AgentShell
        groups={GROUPS}
        initialActive="overview"
        account={email}
        roleLabel={isAdmin ? "Chủ doanh nghiệp" : "Chăm sóc khách hàng"}
        onSignOut={signOut}
      >
          {(active, setActive) => (
            <>
              {active === "overview" && <OverviewView />}
              {active === "campaigns" && <CampaignsView />}
              {active === "dispatch" && <DispatchView />}
              {active === "team" && <TeamView setActive={setActive} />}
              {active === "approvals" && <ApprovalsView />}
              {active === "bots" && <BotsView />}
              {active === "log" && <LogView />}
            </>
          )}
      </AgentShell>
    </ConsoleProvider>
  );
}
