// Chờ duyệt — reads and writes the Agent console's approval gate.
//
// This is the console's first real table: everything else it shows is still a
// dated snapshot in agentConsole.ts, but a decision has to outlive a reload or
// the gate is a demonstration rather than a control. Schema and RLS live in
// TheraHOME-APP/supabase/migrations/202610091400_agent_console_approvals.sql
// (admin only — deliberately narrower than the admin-or-cskh policies most
// tables here carry, because cskh has no business releasing an advertising
// change).
//
// Kept out of db.ts on purpose: that file says at the top that it serves the
// Admin and CSKH surfaces, and the console is a third one.
import { supabase } from "./supabase";
import type { AgentId } from "./agentConsole";

export type ApprovalKind = "budget" | "content";
export type ApprovalDecision = "approved" | "rejected";
export type ApprovalStatus = "pending" | ApprovalDecision;

export interface Approval {
  id: string;
  kind: ApprovalKind;
  title: string;
  agent: AgentId;
  reason: string;
  /** Current value and proposed value, shown side by side. */
  from: string;
  to: string;
  /** What the change lands on — an ad account, a knowledge base, a page. */
  target: string;
  /** The figures the proposal rests on, so the decision is made on evidence. */
  evidence: Array<[string, string]>;
  status: ApprovalStatus;
  /** Already formatted for display, in the console's own language. */
  at: string;
  decidedAt: string | null;
}

const COLUMNS = "id, kind, title, agent, reason, from_value, to_value, target, evidence, status, decided_at, created_at";

interface Row {
  id: string;
  kind: string;
  title: string;
  agent: string;
  reason: string;
  from_value: string;
  to_value: string;
  target: string;
  evidence: unknown;
  status: string;
  decided_at: string | null;
  created_at: string;
}

/** Vietnamese short form, in the business's own timezone rather than the
 * browser's: a proposal raised at 07:02 in Hanoi should not read 00:02
 * because someone opened the console on a laptop still set to UTC. */
function when(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return parts.replace(", ", " · ");
}

/** `evidence` is jsonb, so what comes back is whatever was written. Anything
 * that is not a pair of strings is dropped rather than rendered as
 * "undefined" on a card somebody is about to approve. */
function evidenceOf(value: unknown): Array<[string, string]> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) =>
    Array.isArray(row) && typeof row[0] === "string" && typeof row[1] === "string"
      ? [[row[0], row[1]] as [string, string]]
      : [],
  );
}

function toApproval(row: Row): Approval {
  return {
    id: row.id,
    kind: row.kind === "content" ? "content" : "budget",
    title: row.title,
    agent: row.agent as AgentId,
    reason: row.reason,
    from: row.from_value,
    to: row.to_value,
    target: row.target,
    evidence: evidenceOf(row.evidence),
    status: row.status === "approved" || row.status === "rejected" ? row.status : "pending",
    at: when(row.created_at),
    decidedAt: row.decided_at ? when(row.decided_at) : null,
  };
}

export async function fetchApprovals(): Promise<Approval[]> {
  const { data, error } = await supabase
    .from("agent_approvals")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[] | null ?? []).map(toApproval);
}

/** Records a decision and hands back the row as the database now holds it.
 *
 * The `status = pending` filter is the point: two people with the console open
 * cannot overwrite each other's call, and a second click on a stale card fails
 * loudly instead of silently flipping an approval into a rejection. PostgREST
 * answers an update that matched nothing with `error: null`, so a zero-row
 * result has to be turned into an error by hand — same trap, and same fix, as
 * `runUpdate` in db.ts. Who decided and when is stamped by a trigger, not
 * sent from here: an audit trail the client fills in is not an audit trail. */
export async function decideApproval(id: string, decision: ApprovalDecision): Promise<Approval> {
  const { data, error } = await supabase
    .from("agent_approvals")
    .update({ status: decision })
    .eq("id", id)
    .eq("status", "pending")
    .select(COLUMNS);
  if (error) throw error;
  const rows = data as Row[] | null;
  if (!rows || rows.length === 0) throw new Error("blocked_or_already_decided");
  return toApproval(rows[0]);
}
