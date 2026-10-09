// The Agent console's vocabulary: who the agents are, what they can be asked
// to do, and the thresholds their work is judged against.
//
// No business figures live here any more. Orders, revenue and ad spend moved
// into the database on 2026-10-09 and are read at runtime — see
// src/lib/agentMetrics.ts — because a snapshot written into this file also
// wrote it into git history, where deleting it later does not remove it.
//
// What stays is the part that belongs in source control: it changes when the
// product changes, not when yesterday's orders come in.

export const AD_ACCOUNT = { id: "2259241291085932", name: "TheraHOME VietNam" } as const;

/** Targets the owner set. CPA is a band, not a number: under the floor usually
 * means an ad set is starved, over the ceiling means it is burning. */
export const CPA_TARGET = { min: 150_000, max: 250_000 } as const;
export const CANCEL_RETURN_CEILING_PCT = 10;

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export type AgentId = "ceo" | "growth" | "content" | "creative" | "research" | "care" | "video";

export interface AgentDef {
  id: AgentId;
  name: string;
  initials: string;
  role: string;
  summary: string;
  skills: string[];
  sources: string[];
  enabled: boolean;
}

export const AGENTS: AgentDef[] = [
  { id: "ceo", name: "CEO", initials: "CEO", role: "Điều phối", summary: "Nhận việc lớn, chia cho cả đội, gộp lại thành một câu trả lời. Việc cần từ hai agent trở lên thì vào đây.", skills: ["brand-knowledge"], sources: [], enabled: true },
  { id: "growth", name: "Growth Analyst", initials: "GA", role: "Tăng trưởng", summary: "Đọc chi quảng cáo Meta và đơn Pancake, tính CPA blended, chẩn đoán phễu, soạn đề xuất ngân sách.", skills: ["phan-tich-ads", "de-xuat-budget"], sources: ["Meta Ads", "Pancake", "Shopify"], enabled: true },
  { id: "content", name: "Content Writer", initials: "CW", role: "Nội dung", summary: "Hook, caption, bài fanpage, carousel, mô tả TikTok và YouTube, copy landing, lịch content cho 4 kênh.", skills: ["viet-content", "compliance-check"], sources: [], enabled: true },
  { id: "creative", name: "Creative Director", initials: "CD", role: "Creative", summary: "Concept quảng cáo, storyboard, brief cho editor, prompt ảnh và video AI, làm mới creative đang mỏi.", skills: ["brief-creative"], sources: ["Meta Ads"], enabled: true },
  { id: "research", name: "Research Analyst", initials: "RA", role: "Nghiên cứu", summary: "Đối thủ, giá, xu hướng TikTok, KOL và KOC, benchmark Hinge Health, ai đang copy thiết kế TheraNECK.", skills: ["nghien-cuu-doi-thu"], sources: ["Meta Ad Library", "Web"], enabled: true },
  { id: "care", name: "Customer Care", initials: "CC", role: "Chăm sóc khách hàng", summary: "FAQ, kịch bản tư vấn và chốt đơn inbox, xử lý từ chối, chăm sóc sau mua, kiến thức cho hai bot.", skills: ["kich-ban-cskh", "van-hanh-bot-cskh"], sources: ["Pancake"], enabled: true },
  { id: "video", name: "Video Editor", initials: "VE", role: "Dựng video", summary: "Dựng từ video thô trên máy: chọn bản quay tốt, phụ đề, cắt 9:16 và 4:5, bản ngắn để test hook.", skills: ["dung-video"], sources: [], enabled: false },
];

export const agentById = (id: AgentId): AgentDef => AGENTS.find((a) => a.id === id) ?? AGENTS[0];

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type TaskStatus = "running" | "done";

export interface AgentTask {
  id: string;
  agent: AgentId;
  command: string;
  status: TaskStatus;
  at: string;
  requestedBy: string;
  result?: string;
}

/** The chips under the command box. `ownerOnly` ones spend money, so they are
 * gated on the same role that decides an approval. */
export const QUICK_COMMANDS: Array<{ command: string; agent: AgentId; ownerOnly?: boolean }> = [
  { command: "/daily-brief", agent: "growth" },
  { command: "/phan-tich-ads", agent: "growth" },
  { command: "/viet-hook", agent: "content" },
  { command: "/lich-content", agent: "content" },
  { command: "/brief-creative", agent: "creative" },
  { command: "/doi-thu", agent: "research" },
  { command: "/de-xuat-budget", agent: "growth", ownerOnly: true },
];
