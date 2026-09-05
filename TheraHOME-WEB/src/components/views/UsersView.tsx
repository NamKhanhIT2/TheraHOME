"use client";

// Real data: profiles + user_programs (app users) — see src/lib/db.ts. One
// mock-only feature was dropped rather than faked against real tables:
// "Thêm người dùng" (app users only ever get created by real Google sign-up
// in the mobile app, not by an admin form). The "Tài khoản nội bộ" sub-tab
// that used to live here (reading/writing web_access_contacts) was removed
// (2026-08-26) — TheraAccountsView's `profiles.account_type`-based accounts
// cover the same need now; see CLAUDE.md. The table itself and
// current_web_roles()'s check on it are untouched, just no UI to manage it.
import { Fragment, useEffect, useRef, useState } from "react";
import { ROLE_META, USER_ROLE_OPTIONS, COUNTRY_META, COUNTRY_OPTIONS, type SampleUser, type SampleUserRole, type TheraAccountCountry } from "@/lib/adminMockData";
import {
  fetchAppUsers,
  updateAppUser,
  updateUserContact,
  fetchUserPainTrend,
  fetchUserPrograms,
  fetchUserOrders,
  deleteUserProgram,
  setUserProgramPhase,
  type UserProgramRow,
  type UserOrderRow,
} from "@/lib/db";
import { Avatar, StatusPill, Badge, PrimaryBtn, GhostBtn, FieldLabel, inputStyle } from "@/components/ui/primitives";
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
              <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{u.day != null ? `Ngày ${u.day}` : "N/A"}</td>
              <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{u.adherence != null ? `${u.adherence}%` : "N/A"}</td>
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

function UserDrawer({ user, onClose, readOnly, onSave }: { user: SampleUser; onClose: () => void; readOnly: boolean; onSave: (patch: Partial<SampleUser>) => Promise<boolean> }) {
  const [permRole, setPermRole] = useState<SampleUserRole>(user.role);
  const [permCountry, setPermCountry] = useState<TheraAccountCountry>(user.country ?? "VN");
  const [trend, setTrend] = useState<number[]>([]);
  const [programs, setPrograms] = useState<UserProgramRow[] | null>(null);
  const [orders, setOrders] = useState<UserOrderRow[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [savingContact, setSavingContact] = useState(false);
  const [phaseSelections, setPhaseSelections] = useState<Record<string, string>>({});
  const [savingPhaseFor, setSavingPhaseFor] = useState<string | null>(null);
  const roleDirty = permRole !== user.role;
  const countryDirty = permCountry !== (user.country ?? "VN");
  const contactDirty = email !== (user.email ?? "") || phone !== (user.phone ?? "");
  // Same backdrop-click fix as `Modal.tsx` (this drawer predates that shared
  // component and hand-rolls the same backdrop pattern): a plain
  // `onClick={onClose}` closes on any click whose target resolves to the
  // backdrop, which also happens for a click/drag that *starts* inside the
  // drawer and releases outside it — only close when the press itself
  // (mousedown), not just the click, began on the backdrop.
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    fetchUserPainTrend(String(user.id)).then(setTrend).catch(() => setTrend([]));
    fetchUserPrograms(String(user.id)).then(setPrograms).catch(() => setPrograms([]));
    fetchUserOrders(String(user.id)).then(setOrders).catch(() => setOrders([]));
  }, [user.id]);

  async function removeProgram(row: UserProgramRow) {
    if (!window.confirm(`Gỡ sản phẩm "${row.productName}" khỏi tài khoản ${user.name}? Toàn bộ tiến độ lộ trình của sản phẩm này sẽ bị xoá.`)) return;
    setRemovingId(row.userProgramId);
    try {
      await deleteUserProgram(row.userProgramId);
      setPrograms((cur) => (cur ? cur.filter((p) => p.userProgramId !== row.userProgramId) : cur));
      pushToast(`Đã gỡ sản phẩm ${row.productName}`);
    } catch {
      pushToast("Không thể gỡ sản phẩm");
    } finally {
      setRemovingId(null);
    }
  }

  async function saveContact() {
    setSavingContact(true);
    try {
      await updateUserContact(String(user.id), { email: email.trim() || null, phone: phone.trim() || null });
      onSave({ email: email.trim() || null, phone: phone.trim() || null });
      pushToast("Đã cập nhật thông tin liên hệ");
    } catch {
      pushToast("Không thể lưu thông tin liên hệ");
    } finally {
      setSavingContact(false);
    }
  }

  async function savePhase(row: UserProgramRow) {
    const targetPhaseId = phaseSelections[row.userProgramId];
    if (!targetPhaseId || targetPhaseId === row.currentPhaseId) return;
    setSavingPhaseFor(row.userProgramId);
    try {
      await setUserProgramPhase(row.userProgramId, targetPhaseId);
      const targetPhase = row.phases.find((ph) => ph.id === targetPhaseId);
      setPrograms((cur) =>
        cur
          ? cur.map((p) =>
              p.userProgramId === row.userProgramId
                ? { ...p, currentPhaseId: targetPhaseId, currentPhaseName: targetPhase?.name ?? null, currentDay: targetPhase?.dayStart ?? p.currentDay }
                : p,
            )
          : cur,
      );
      pushToast(`Đã chuyển ${row.productName} sang ${targetPhase?.name ?? "giai đoạn mới"}`);
    } catch {
      pushToast("Không thể đổi giai đoạn");
    } finally {
      setSavingPhaseFor(null);
    }
  }

  async function toggleLock() {
    // Wait for the write — success toast used to fire before (and alongside)
    // the failure toast from updateUser.
    if (await onSave({ locked: !user.locked })) pushToast(user.locked ? "Đã mở khóa tài khoản " + user.name : "Đã khóa tài khoản " + user.name);
  }
  async function saveRole() {
    if (await onSave({ role: permRole })) pushToast("Đã cập nhật phân quyền cho " + user.name + ": " + (ROLE_META[permRole] || ROLE_META.user)[0]);
  }

  async function saveCountry() {
    if (await onSave({ country: permCountry })) {
      pushToast("Đã đổi thị trường của " + user.name + " sang " + COUNTRY_META[permCountry] + " — app cập nhật trong ít phút");
    }
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
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{user.day != null ? `Ngày ${user.day}` : "N/A"}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>ngày lộ trình</div>
            </div>
            <div style={{ flex: 1, background: "#fff", borderRadius: 12, padding: 14, textAlign: "center", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{user.adherence != null ? `${user.adherence}%` : "N/A"}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>tuân thủ</div>
            </div>
            <div style={{ flex: 1, background: "#fff", borderRadius: 12, padding: 14, textAlign: "center", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{user.area}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>vùng tập</div>
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-card)", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Thông tin liên hệ</div>
            <FieldLabel>Email</FieldLabel>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@vidu.com" style={{ ...inputStyle, marginBottom: 10 }} />
            <FieldLabel>Số điện thoại</FieldLabel>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" style={{ ...inputStyle, marginBottom: 10 }} />
            <PrimaryBtn onClick={saveContact} disabled={!contactDirty || savingContact}>
              {savingContact ? "Đang lưu..." : "Lưu thông tin liên hệ"}
            </PrimaryBtn>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-card)", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Đơn hàng đã đặt</div>
            {orders === null ? (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Đang tải...</div>
            ) : orders.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>N/A — chưa có đơn hàng nào khớp thông tin liên hệ.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".03em" }}>
                      <th style={{ padding: "0 6px 8px", fontWeight: 600 }}>Sản phẩm</th>
                      <th style={{ padding: "0 6px 8px", fontWeight: 600 }}>Trạng thái</th>
                      <th style={{ padding: "0 6px 8px", fontWeight: 600 }}>Ngày đặt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.orderId} style={{ borderTop: "1px solid var(--divider)" }}>
                        <td style={{ padding: "8px 6px", fontWeight: 600, color: "var(--text-primary)" }}>{o.productName}</td>
                        <td style={{ padding: "8px 6px", color: "var(--text-secondary)" }}>{o.status}</td>
                        <td style={{ padding: "8px 6px", color: "var(--text-secondary)" }}>{new Date(o.orderDate).toLocaleDateString("vi-VN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-card)", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Sản phẩm sở hữu &amp; lộ trình hiện tại</div>
            {programs === null ? (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Đang tải...</div>
            ) : programs.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>N/A — chưa kích hoạt sản phẩm nào.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {programs.map((p) => {
                  const currentPhase = p.phases.find((ph) => ph.id === p.currentPhaseId);
                  const selectedPhaseId = phaseSelections[p.userProgramId] ?? p.currentPhaseId ?? "";
                  const selectedPhase = p.phases.find((ph) => ph.id === selectedPhaseId);
                  const willGrantPayment = !!selectedPhase && selectedPhase.requiresPayment && !selectedPhase.purchased;
                  return (
                  <div key={p.userProgramId} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-card-alt)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{p.productName}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          Ngày {p.currentDay}/{p.totalDays} · Streak {p.streak} · Tuân thủ {p.adherencePct}%
                          {p.currentPhaseName ? ` · ${p.currentPhaseName}` : ""}
                          {currentPhase?.requiresPayment ? (
                            <Badge color={currentPhase.purchased ? "#1E9E5E" : "#B9860B"} bg={currentPhase.purchased ? "rgba(30,158,94,0.12)" : "rgba(185,134,11,0.12)"}>
                              {currentPhase.purchased ? "Đã kích hoạt trả phí" : "Chờ mở khoá"}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {!readOnly ? (
                        <GhostBtn
                          color="var(--error)"
                          onClick={() => removeProgram(p)}
                          disabled={removingId === p.userProgramId}
                        >
                          {removingId === p.userProgramId ? "Đang gỡ..." : "Gỡ"}
                        </GhostBtn>
                      ) : null}
                    </div>
                    {p.phases.length > 0 ? (
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <select
                          value={selectedPhaseId}
                          onChange={(e) => setPhaseSelections((cur) => ({ ...cur, [p.userProgramId]: e.target.value }))}
                          style={{ ...inputStyle, flex: 1 }}
                        >
                          {p.phases.map((ph) => (
                            <option key={ph.id} value={ph.id}>
                              {ph.name}
                              {ph.requiresPayment ? (ph.purchased ? " (đã kích hoạt trả phí)" : " (cần kích hoạt trả phí)") : ""}
                            </option>
                          ))}
                        </select>
                        <GhostBtn
                          onClick={() => savePhase(p)}
                          disabled={
                            savingPhaseFor === p.userProgramId ||
                            selectedPhaseId === p.currentPhaseId
                          }
                        >
                          {savingPhaseFor === p.userProgramId ? "Đang lưu..." : willGrantPayment ? "Chuyển & kích hoạt giai đoạn" : "Chuyển giai đoạn"}
                        </GhostBtn>
                      </div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
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
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-card)", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Quốc gia / Thị trường</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                  Quyết định giá bán, link sản phẩm, video lộ trình và bài ghim khách này thấy. Sửa ở đây khi khách chọn nhầm lúc onboarding.
                </div>
                <select value={permCountry} onChange={(e) => setPermCountry(e.target.value as TheraAccountCountry)} style={{ ...inputStyle, marginBottom: 10 }}>
                  {COUNTRY_OPTIONS.map((k) => (
                    <option key={k} value={k}>{COUNTRY_META[k]}</option>
                  ))}
                </select>
                <button
                  onClick={saveCountry}
                  disabled={!countryDirty}
                  style={{
                    width: "100%",
                    border: "none",
                    background: countryDirty ? "var(--color-primary)" : "var(--color-primary-tint-10)",
                    color: countryDirty ? "#fff" : "var(--color-primary)",
                    borderRadius: 10,
                    padding: "9px 0",
                    fontFamily: "var(--font-family)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: countryDirty ? "pointer" : "default",
                  }}
                >
                  {countryDirty ? "Lưu thị trường" : "Đang áp dụng"}
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

export function UsersView({ role }: { role: "admin" | "care" }) {
  const readOnly = role === "care";
  const [users, setUsers] = useState<SampleUser[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | SampleUser["status"]>("all");
  const [openId, setOpenId] = useState<SampleUser["id"] | null>(null);

  useEffect(() => {
    fetchAppUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const rows = (users ?? []).filter((u) => (status === "all" || u.status === status) && u.name.toLowerCase().includes(q.toLowerCase()));
  const openUser = (users ?? []).find((u) => u.id === openId);

  async function updateUser(id: SampleUser["id"], patch: Partial<SampleUser>): Promise<boolean> {
    try {
      await updateAppUser(String(id), { app_role: patch.role, locked: patch.locked, country: patch.country ?? undefined });
      setUsers((us) => (us ? us.map((u) => (u.id === id ? { ...u, ...patch } : u)) : us));
      return true;
    } catch {
      pushToast("Không thể lưu thay đổi");
      return false;
    }
  }

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-card)" }}>
        {readOnly ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card-alt)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "var(--text-secondary)" }}>
            <Icon name="eye" size={14} color="var(--text-secondary)" />
            Bạn có thể xem, cập nhật thông tin liên hệ và giai đoạn lộ trình. Phân quyền chỉ Admin thực hiện được; khoá tài khoản vi phạm làm ở tab Báo cáo.
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220, display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border-input)", borderRadius: 10, padding: "9px 12px" }}>
            <Icon name="search" size={16} color="var(--text-muted)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên..." style={{ border: "none", outline: "none", flex: 1, fontFamily: "var(--font-family)", fontSize: 13.5 }} />
          </div>
          {([["all", "Tất cả"], ["active", "Hoạt động"], ["unactivated", "Chưa kích hoạt"], ["inactive", "Ngừng"]] as const).map(([k, l]) => (
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
    </div>
  );
}
