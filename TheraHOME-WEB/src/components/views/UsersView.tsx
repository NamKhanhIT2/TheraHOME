"use client";

// Real data: profiles + user_programs (app users) and web_access_contacts
// (staff/internal accounts) — see src/lib/db.ts. Two mock-only features
// were dropped rather than faked against real tables: "Thêm người dùng"
// (app users only ever get created by real Google sign-up in the mobile
// app, not by an admin form) and the earlier StaffAccountsView-fills-a-gap
// note still applies — see that section below.
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ROLE_META,
  STAFF_ROLE_META,
  USER_ROLE_OPTIONS,
  type SampleUser,
  type SampleUserRole,
  type StaffMember,
  type StaffRole,
} from "@/lib/adminMockData";
import { fetchAppUsers, updateAppUser, fetchUserPainTrend, fetchStaff, createStaffContact, toggleStaffDisabled } from "@/lib/db";
import { Avatar, StatusPill, Badge, PrimaryBtn, GhostBtn, FieldLabel, inputStyle } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { TableShell } from "@/components/ui/TableShell";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";

function UsersTable({ rows, compact, onOpenUser }: { rows: SampleUser[]; compact?: boolean; onOpenUser: (u: SampleUser) => void }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
      <thead>
        <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: ".03em" }}>
          <th style={{ padding: "0 8px 10px", fontWeight: 600 }}>Người dùng</th>
          <th style={{ padding: "0 8px 10px", fontWeight: 600 }}>Vùng tập</th>
          <th style={{ padding: "0 8px 10px", fontWeight: 600 }}>Ngày</th>
          <th style={{ padding: "0 8px 10px", fontWeight: 600 }}>Tuân thủ</th>
          <th style={{ padding: "0 8px 10px", fontWeight: 600 }}>Phân quyền</th>
          <th style={{ padding: "0 8px 10px", fontWeight: 600 }}>Trạng thái</th>
          {!compact ? <th style={{ padding: "0 8px 10px", fontWeight: 600 }}></th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((u) => {
          const [rl, rc, rb] = ROLE_META[u.role] || ROLE_META.user;
          return (
            <tr key={u.id} style={{ borderTop: "1px solid var(--divider)" }}>
              <td style={{ padding: "12px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={u.name} color={u.avatarColor} />
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.contact}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{u.area}</td>
              <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{u.day}/14</td>
              <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{u.adherence}%</td>
              <td style={{ padding: "12px 8px" }}><Badge color={rc} bg={rb}>{rl}</Badge></td>
              <td style={{ padding: "12px 8px" }}><StatusPill status={u.locked ? "inactive" : u.status} /></td>
              {!compact ? (
                <td style={{ padding: "12px 8px", textAlign: "right" }}>
                  <button
                    onClick={() => onOpenUser(u)}
                    style={{ border: "1px solid var(--border-input)", background: "none", borderRadius: 8, padding: "6px 12px", fontFamily: "var(--font-family)", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}
                  >
                    Xem hồ sơ
                  </button>
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function UserDrawer({ user, onClose, readOnly, onSave }: { user: SampleUser; onClose: () => void; readOnly: boolean; onSave: (patch: Partial<SampleUser>) => void }) {
  const [permRole, setPermRole] = useState<SampleUserRole>(user.role);
  const [trend, setTrend] = useState<number[]>([]);
  const roleDirty = permRole !== user.role;
  // Same backdrop-click fix as `Modal.tsx` (this drawer predates that shared
  // component and hand-rolls the same backdrop pattern): a plain
  // `onClick={onClose}` closes on any click whose target resolves to the
  // backdrop, which also happens for a click/drag that *starts* inside the
  // drawer and releases outside it — only close when the press itself
  // (mousedown), not just the click, began on the backdrop.
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    fetchUserPainTrend(String(user.id)).then(setTrend).catch(() => setTrend([]));
  }, [user.id]);

  function toggleLock() {
    onSave({ locked: !user.locked });
    pushToast(user.locked ? "Đã mở khóa tài khoản " + user.name : "Đã khóa tài khoản " + user.name);
  }
  function saveRole() {
    onSave({ role: permRole });
    pushToast("Đã cập nhật phân quyền cho " + user.name + ": " + (ROLE_META[permRole] || ROLE_META.user)[0]);
  }

  return (
    <div
      onMouseDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressStartedOnBackdrop.current) onClose();
      }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,20,30,0.4)", zIndex: 90, display: "flex", justifyContent: "flex-end" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: "92vw", height: "100%", background: "var(--bg-app)", boxShadow: "-8px 0 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px", borderBottom: "1px solid var(--divider)", background: "#fff" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
            Hồ sơ người dùng
            {readOnly ? (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-card-alt)", padding: "3px 8px", borderRadius: 999 }}>Chỉ xem</span>
            ) : null}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
            <Icon name="x" size={18} color="var(--text-secondary)" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Avatar name={user.name} color={user.avatarColor} size={64} />
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)" }}>{user.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{user.contact} · Tham gia {user.joined}</div>
            <StatusPill status={user.locked ? "inactive" : user.status} />
            <Badge color={(ROLE_META[user.role] || ROLE_META.user)[1]} bg={(ROLE_META[user.role] || ROLE_META.user)[2]}>
              {(ROLE_META[user.role] || ROLE_META.user)[0]}
            </Badge>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, background: "#fff", borderRadius: 12, padding: 14, textAlign: "center", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{user.day}/14</div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>ngày lộ trình</div>
            </div>
            <div style={{ flex: 1, background: "#fff", borderRadius: 12, padding: 14, textAlign: "center", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{user.adherence}%</div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>tuân thủ</div>
            </div>
            <div style={{ flex: 1, background: "#fff", borderRadius: 12, padding: 14, textAlign: "center", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{user.area}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>vùng tập</div>
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-card)", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Xu hướng mức đau (7 lần ghi gần nhất)</div>
            {trend.length ? (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 70 }}>
                {trend.map((v, i) => (
                  <div key={i} style={{ flex: 1, height: (v / 10) * 60 + 4, borderRadius: 4, background: "var(--color-primary)" }} />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Chưa có dữ liệu mức đau.</div>
            )}
          </div>
          {!readOnly ? (
            <Fragment>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-card)", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Phân quyền tài khoản</div>
                <select value={permRole} onChange={(e) => setPermRole(e.target.value as SampleUserRole)} style={{ ...inputStyle, marginBottom: 10 }}>
                  {USER_ROLE_OPTIONS.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
                <button
                  onClick={saveRole}
                  disabled={!roleDirty}
                  style={{
                    width: "100%",
                    border: "none",
                    background: roleDirty ? "var(--color-primary)" : "var(--color-primary-tint-10)",
                    color: roleDirty ? "#fff" : "var(--color-primary)",
                    borderRadius: 10,
                    padding: "9px 0",
                    fontFamily: "var(--font-family)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: roleDirty ? "pointer" : "default",
                  }}
                >
                  {roleDirty ? "Lưu phân quyền" : "Đang áp dụng"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <button
                  onClick={toggleLock}
                  style={{ flex: 1, border: "1px solid var(--border-input)", background: "none", color: "var(--error)", borderRadius: 10, padding: "11px 0", fontFamily: "var(--font-family)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
                >
                  {user.locked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                </button>
              </div>
            </Fragment>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StaffModal({ onClose, onSave }: { onClose: () => void; onSave: (patch: { name: string; email: string; role: StaffRole }) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("care");

  function submit() {
    if (!name.trim() || !email.trim()) return;
    onSave({ name: name.trim(), email: email.trim(), role });
  }

  return (
    <Modal
      title="Thêm tài khoản nội bộ"
      onClose={onClose}
      width={420}
      footer={
        <Fragment>
          <GhostBtn onClick={onClose}>Hủy</GhostBtn>
          <PrimaryBtn onClick={submit}>Thêm tài khoản</PrimaryBtn>
        </Fragment>
      }
    >
      <FieldLabel>Họ tên</FieldLabel>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Nguyễn Văn A" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Email</FieldLabel>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ten@therahome.vn" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Vai trò</FieldLabel>
      <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} style={inputStyle}>
        {(Object.keys(STAFF_ROLE_META) as StaffRole[]).map((k) => (
          <option key={k} value={k}>{STAFF_ROLE_META[k][0]}</option>
        ))}
      </select>
      <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-muted)" }}>
        Tài khoản này không cần mua hàng. Người dùng đăng nhập Google, sau đó nhập lại đúng email trên ở màn xác nhận truy cập.
      </div>
    </Modal>
  );
}

// Fills the gap left by admin-shared.jsx's missing StaffAccountsView (see
// the original design-gap note from earlier) — reads/writes the real
// web_access_contacts table, which is a natural fit since that table
// already models exactly this (contact + roles + disabled).
function StaffAccountsView() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    fetchStaff().then(setStaff).catch(() => setStaff([]));
  }
  useEffect(reload, []);

  async function toggleStatus(id: string | number, current: StaffMember["status"]) {
    try {
      await toggleStaffDisabled(String(id), current === "active");
      reload();
    } catch {
      pushToast("Không thể cập nhật trạng thái tài khoản");
    }
  }
  async function addStaff(patch: { name: string; email: string; role: StaffRole }) {
    try {
      await createStaffContact(patch);
      setCreating(false);
      pushToast("Đã thêm tài khoản " + patch.name);
      reload();
    } catch {
      pushToast("Không thể thêm tài khoản (có thể email đã tồn tại)");
    }
  }

  if (!staff) return <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>;

  return (
    <TableShell
      subtitle="Quản lý tài khoản admin và chăm sóc khách hàng có quyền truy cập trang này."
      action={<PrimaryBtn icon="plus" onClick={() => setCreating(true)}>Thêm tài khoản</PrimaryBtn>}
      columns={["Tài khoản", "Vai trò", "Trạng thái", "Ngày tham gia", ""]}
      modals={creating ? <StaffModal onClose={() => setCreating(false)} onSave={addStaff} /> : null}
    >
      {staff.map((m) => {
        const [label, color, bg] = STAFF_ROLE_META[m.role];
        return (
          <tr key={m.id} style={{ borderTop: "1px solid var(--divider)" }}>
            <td style={{ padding: "12px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={m.name} />
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.email}</div>
                </div>
              </div>
            </td>
            <td style={{ padding: "12px 20px" }}><Badge color={color} bg={bg}>{label}</Badge></td>
            <td style={{ padding: "12px 20px" }}>
              {m.status === "active" ? (
                <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Hoạt động</Badge>
              ) : (
                <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">Đã tắt</Badge>
              )}
            </td>
            <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{m.joined}</td>
            <td style={{ padding: "12px 20px", textAlign: "right" }}>
              <GhostBtn color={m.status === "active" ? "var(--error)" : undefined} onClick={() => toggleStatus(m.id, m.status)}>
                {m.status === "active" ? "Tắt quyền" : "Bật lại"}
              </GhostBtn>
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

export function UsersView({ role }: { role: "admin" | "care" }) {
  const readOnly = role === "care";
  const [subTab, setSubTab] = useState<"users" | "staff">("users");
  const [users, setUsers] = useState<SampleUser[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | SampleUser["status"]>("all");
  const [openId, setOpenId] = useState<SampleUser["id"] | null>(null);

  useEffect(() => {
    fetchAppUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const rows = (users ?? []).filter((u) => (status === "all" || u.status === status) && u.name.toLowerCase().includes(q.toLowerCase()));
  const openUser = (users ?? []).find((u) => u.id === openId);

  async function updateUser(id: SampleUser["id"], patch: Partial<SampleUser>) {
    try {
      await updateAppUser(String(id), { app_role: patch.role, locked: patch.locked });
      setUsers((us) => (us ? us.map((u) => (u.id === id ? { ...u, ...patch } : u)) : us));
    } catch {
      pushToast("Không thể lưu thay đổi");
    }
  }

  return (
    <div>
      {!readOnly ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {([["users", "Người dùng app"], ["staff", "Tài khoản nội bộ"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setSubTab(k)}
              style={{
                border: subTab === k ? "none" : "1px solid var(--border-input)",
                background: subTab === k ? "var(--color-primary)" : "#fff",
                color: subTab === k ? "#fff" : "var(--text-primary)",
                borderRadius: 999,
                padding: "9px 18px",
                fontFamily: "var(--font-family)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      ) : null}
      {subTab === "staff" && !readOnly ? (
        <StaffAccountsView />
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-card)" }}>
          {readOnly ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card-alt)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "var(--text-secondary)" }}>
              <Icon name="eye" size={14} color="var(--text-secondary)" />
              Chế độ chỉ xem — thông tin cơ bản người dùng
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220, display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border-input)", borderRadius: 10, padding: "9px 12px" }}>
              <Icon name="search" size={16} color="var(--text-muted)" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên..." style={{ border: "none", outline: "none", flex: 1, fontFamily: "var(--font-family)", fontSize: 13.5 }} />
            </div>
            {([["all", "Tất cả"], ["active", "Hoạt động"], ["paused", "Tạm dừng"], ["inactive", "Ngừng"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setStatus(k)}
                style={{
                  border: status === k ? "none" : "1px solid var(--border-input)",
                  background: status === k ? "var(--color-primary)" : "none",
                  color: status === k ? "#fff" : "var(--text-primary)",
                  borderRadius: 999,
                  padding: "9px 16px",
                  fontFamily: "var(--font-family)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {users === null ? (
            <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>
          ) : (
            <UsersTable rows={rows} onOpenUser={(u) => setOpenId(u.id)} />
          )}
          {openUser ? (
            <UserDrawer user={openUser} readOnly={readOnly} onSave={(patch) => updateUser(openUser.id, patch)} onClose={() => setOpenId(null)} />
          ) : null}
        </div>
      )}
    </div>
  );
}
