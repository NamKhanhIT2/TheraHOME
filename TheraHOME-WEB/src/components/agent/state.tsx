"use client";

// State shared by the console's tabs. The shell keeps one tab mounted at a
// time, so anything held inside a view is lost on the way to another one; this
// sits outside the shell and outlives the switch.
//
// Memory only — a reload starts over. Persisting dispatched jobs and approval
// decisions needs a table in the shared Supabase project (admin-only RLS); see
// the note on approvals in src/lib/agentConsole.ts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { agentById, type AgentId, type AgentTask } from "@/lib/agentConsole";
import { fetchMetrics, type MetricsSnapshot, type WindowDef } from "@/lib/agentMetrics";
import { decideApproval, fetchApprovals, type Approval, type ApprovalDecision } from "@/lib/agentApprovals";
import { errorMessage } from "@/lib/errorMessage";
import { pushToast } from "@/components/ui/Toast";

interface Value {
  /** Which span of days every number on the screen is for. Lives here rather
   * than in a view because the shell's picker sets it and two views read it. */
  windowId: string;
  setWindowId: (id: string) => void;
  /** null until the figures have been read, or if the read failed. */
  window: WindowDef | null;
  /** The figures themselves, read from the database rather than compiled in. */
  metrics: MetricsSnapshot | null;
  metricsError: string | null;
  reloadMetrics: () => void;
  tasks: AgentTask[];
  /** null while the first read is in flight — the views distinguish "loading"
   * from "nothing waiting", which look identical if both are an empty list. */
  approvals: Approval[] | null;
  approvalsError: string | null;
  reloadApprovals: () => void;
  openApprovals: Approval[];
  /** Whether the signed-in person may release a change. Read from their web
   * role, never from a control on the page — the console already knows who
   * signed in, and a switch that pretends otherwise is theatre. */
  canApprove: boolean;
  /** Name to credit a dispatched job to. */
  actor: string;
  draftAgent: AgentId;
  setDraftAgent: (id: AgentId) => void;
  draftCommand: string;
  setDraftCommand: (s: string) => void;
  dispatch: (agent: AgentId, command: string, by: string) => void;
  decide: (id: string, d: ApprovalDecision) => void;
}

const Ctx = createContext<Value | null>(null);

export function useConsole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConsole() must be called within ConsoleProvider");
  return ctx;
}

/** Session facts arrive as props rather than being read from context here, so
 * everything below this point is presentational: one place in the console
 * touches the signed-in person (app/agent/page.tsx), and the rest can be
 * rendered anywhere. */
export function ConsoleProvider({
  canApprove,
  actor,
  children,
}: {
  canApprove: boolean;
  actor: string;
  children: ReactNode;
}) {
  const [windowId, setWindowId] = useState<string>("7");
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [draftAgent, setDraftAgent] = useState<AgentId>("growth");
  const [draftCommand, setDraftCommand] = useState("");

  // `load` touches state only from the promise's callbacks, which is what
  // lets the mount effect call it: a setState run synchronously inside an
  // effect body is the thing react-hooks/set-state-in-effect exists to stop.
  // The retry button needs the screen to go back to its loading state at the
  // moment of the click, so that pair of synchronous writes lives in
  // `reloadApprovals`, which only ever runs from an event handler.
  const load = useCallback(
    () =>
      fetchApprovals()
        .then((rows) => {
          setApprovals(rows);
          setApprovalsError(null);
        })
        .catch((e) => setApprovalsError(errorMessage(e) || "Không đọc được danh sách chờ duyệt.")),
    [],
  );

  const loadMetrics = useCallback(
    () =>
      fetchMetrics()
        .then((m) => {
          setMetrics(m);
          setMetricsError(null);
        })
        .catch((e) => setMetricsError(errorMessage(e) || "Không đọc được số liệu.")),
    [],
  );

  useEffect(() => {
    void load();
    void loadMetrics();
  }, [load, loadMetrics]);

  const reloadMetrics = useCallback(() => {
    setMetrics(null);
    setMetricsError(null);
    void loadMetrics();
  }, [loadMetrics]);

  const reloadApprovals = useCallback(() => {
    setApprovals(null);
    setApprovalsError(null);
    void load();
  }, [load]);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const dispatch = useCallback((agent: AgentId, command: string, by: string) => {
    const id = `t-${Date.now()}`;
    const now = new Date();
    const at = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setTasks((cur) => [{ id, agent, command, status: "running", at, requestedBy: by, result: "Đang nhận việc…" }, ...cur]);

    // This app holds no Claude API key, so the run is staged. The card says so
    // itself rather than quietly looking finished.
    const timer = setTimeout(() => {
      setTasks((cur) =>
        cur.map((t) =>
          t.id === id
            ? {
                ...t,
                status: "done",
                result: `Console chưa nối Claude API nên ${agentById(agent).name} chưa thật sự chạy. Khi nối xong, kết quả hiện đúng ở chỗ này, kèm nút duyệt nếu việc cần Hoan quyết.`,
              }
            : t,
        ),
      );
    }, 1400);
    timers.current.push(timer);
  }, []);

  /** Writes the decision, then replaces the row with what the database
   * actually holds — never with what this browser assumed it would hold. A
   * refusal (someone else decided it first, or RLS said no) leaves the card
   * untouched and says so. */
  const decide = useCallback(async (id: string, d: ApprovalDecision) => {
    try {
      const saved = await decideApproval(id, d);
      setApprovals((cur) => (cur ? cur.map((a) => (a.id === id ? saved : a)) : cur));
      pushToast(d === "approved" ? "Đã duyệt." : "Đã từ chối.");
    } catch (e) {
      const msg = errorMessage(e);
      pushToast(
        msg === "blocked_or_already_decided"
          ? "Đề xuất này đã được quyết định ở nơi khác. Tải lại để xem trạng thái mới."
          : "Không lưu được quyết định. Vui lòng thử lại.",
      );
    }
  }, []);

  const openApprovals = useMemo(() => (approvals ?? []).filter((a) => a.status === "pending"), [approvals]);

  const value = useMemo<Value>(
    () => ({
      windowId,
      setWindowId,
      // Falls back to the first window rather than to nothing: a saved id that
      // no longer exists should not blank the dashboard.
      window: metrics ? (metrics.windows.find((w) => w.id === windowId) ?? metrics.windows[0] ?? null) : null,
      metrics,
      metricsError,
      reloadMetrics,
      tasks,
      approvals,
      approvalsError,
      reloadApprovals,
      openApprovals,
      canApprove,
      actor,
      draftAgent,
      setDraftAgent,
      draftCommand,
      setDraftCommand,
      dispatch,
      decide,
    }),
    [windowId, metrics, metricsError, reloadMetrics, tasks, approvals, approvalsError, reloadApprovals, openApprovals, canApprove, actor, draftAgent, draftCommand, dispatch, decide],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
