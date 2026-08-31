// Nav structure + UI vocabulary (role labels/colors) for the Admin/CSKH
// surfaces — these are display config, not seed data, so they stay static.
// The actual user/staff/chat mock arrays that used to live here were
// removed once every view moved to real Supabase data (see src/lib/db.ts
// and CLAUDE.md) — only the shared shapes remain, now populated from
// Supabase.

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

export const NAV_ADMIN: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "exercises", label: "Lộ trình", icon: "route" },
  { id: "products", label: "Sản Phẩm", icon: "box" },
  {
    id: "notifications",
    label: "Thông báo",
    icon: "bell",
    children: [
      { id: "notifications", label: "Mẫu hệ thống", icon: "bell" },
      { id: "notifications-upsale", label: "Upsale", icon: "megaphone" },
    ],
  },
  // content_reports RLS grants read/update to both admin and cskh — matches
  // NAV_CARE below.
  { id: "reports", label: "Báo cáo", icon: "flag" },
  { id: "users", label: "User", icon: "users" },
  // Admin-only — accounts here carry a password, unlike the app-user list
  // above, so it's deliberately not added to NAV_CARE.
  { id: "thera-accounts", label: "Tài khoản TheraHOME", icon: "lock" },
  { id: "ai", label: "AI Prompts", icon: "brain" },
];

export const NAV_CARE: NavItem[] = [
  { id: "chat", label: "Chat", icon: "message-circle" },
  { id: "community", label: "Cộng đồng", icon: "message-square" },
  { id: "reports", label: "Báo cáo", icon: "flag" },
  { id: "notifications", label: "Mẫu hệ thống", icon: "bell" },
  { id: "users", label: "User", icon: "users" },
];

export const USER_ROLE_OPTIONS: [string, string][] = [
  ["user", "Người dùng"],
  ["collaborator", "CTV chăm sóc"],
  ["restricted", "Hạn chế"],
];

export type SampleUserRole = "user" | "collaborator" | "restricted";
// "unactivated": signed in but hasn't claimed a contact yet (see
// TheraHOME-APP/CLAUDE.md's activation pass — activation is opt-in now,
// no longer required to use the app) — distinct from "inactive", which
// implies they once had an active program and lost it.
export type SampleUserStatus = "active" | "paused" | "inactive" | "unactivated";

export interface SampleUser {
  id: string | number;
  name: string;
  avatarColor?: string;
  contact: string;
  area: string;
  /** null when the user has no activated program yet — render as N/A. */
  day: number | null;
  adherence: number | null;
  status: SampleUserStatus;
  joined: string;
  role: SampleUserRole;
  locked: boolean;
  /** profiles.email/phone directly — editable by admin/cskh via
   * admin_update_user_contact, distinct from `contact` above (the claimed
   * user_access_contacts value, read-only, used for order matching). */
  email: string | null;
  phone: string | null;
}

export const ROLE_META: Record<SampleUserRole, [string, string, string]> = {
  user: ["Người dùng", "var(--text-secondary)", "var(--bg-card-alt)"],
  collaborator: ["CTV chăm sóc", "var(--color-primary)", "var(--color-primary-tint-10)"],
  restricted: ["Hạn chế", "#B9860B", "rgba(185,134,11,0.12)"],
};

// Tài khoản TheraHOME — accounts an Admin issues directly (email+password
// via Supabase Auth, no OAuth), extending profiles rather than a separate
// table. See TheraHOME-APP/supabase/migrations/202608181200_theraccount_columns_and_guard.sql.
// 'admin' and 'cskh' are the two web-staff types (see current_web_roles()'s
// account_type fallback branch, migration
// 202608230900_thera_accounts_web_roles_and_admin_seed.sql) — 'admin' is a
// single seeded account, not creatable through the UI (see
// TheraAccountsView.tsx's ACCOUNT_TYPE_OPTIONS).
export type TheraAccountType = "admin" | "admin_issued" | "review" | "staff" | "partner" | "tester" | "cskh";
export type TheraAccessLevel = "free" | "premium" | "admin_granted";

export interface TheraAccount {
  id: string;
  username: string;
  fullName: string;
  accountType: TheraAccountType;
  accessLevel: TheraAccessLevel;
  locked: boolean;
  expiresAt: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  notes: string | null;
}

export const ACCOUNT_TYPE_META: Record<TheraAccountType, string> = {
  admin: "Quản trị viên",
  admin_issued: "Người dùng được cấp",
  review: "App Review",
  staff: "Nhân viên",
  partner: "Đối tác",
  tester: "Tester",
  cskh: "Chăm sóc khách hàng",
};

// Matches TheraHOME-APP's ReportReason (src/hooks/useCommunity.ts).
export const REPORT_REASON_META: Record<string, string> = {
  spam: "Spam",
  inappropriate: "Nội dung không phù hợp",
  harassment: "Quấy rối",
  other: "Khác",
};

export const ACCESS_LEVEL_META: Record<TheraAccessLevel, string> = {
  free: "Free",
  premium: "Premium / Pro",
  admin_granted: "Toàn quyền",
};

export interface ChatMessage {
  id?: string;
  from: "user" | "admin";
  text: string;
  time: string;
  imageUrl?: string | null;
  attachmentKind?: "image" | "video" | null;
  readAt?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToMessageId?: string | null;
  reactions?: { id: string; userId: string; emoji: string }[];
}

export interface ChatThread {
  id: string;
  userId: string;
  user: string;
  avatarColor?: string;
  unread: boolean;
  time: string;
  messages: ChatMessage[];
}
