"use client";

// Tài khoản TheraHOME — accounts an Admin issues directly (email+password,
// no OAuth): App Review, staff, partners, testers. Real data via
// src/lib/db.ts (profiles.account_type <> 'normal'); account creation and
// password resets go through the admin-manage-account Edge Function (needs
// the service role to call auth.admin.* — see that function's source and
// TheraHOME-APP/CLAUDE.md). Everything else (edit fields, lock/unlock) goes
// straight through the authenticated client + RLS, same as UsersView.
import { Fragment, useEffect, useState } from "react";
import {
  ACCOUNT_TYPE_META,
  ACCESS_LEVEL_META,
  type TheraAccount,
  type TheraAccountType,
  type TheraAccountCountry,
  COUNTRY_META,
  COUNTRY_OPTIONS,
  type TheraAccessLevel,
} from "@/lib/adminMockData";
import {
  fetchTheraAccounts,
  updateTheraAccount,
  createTheraAccount,
  resetTheraAccountPassword,
  type CreateTheraAccountInput,
} from "@/lib/db";
import { Badge, PrimaryBtn, GhostBtn, FieldLabel, inputStyle } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { TableShell } from "@/components/ui/TableShell";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";
import { useWebAccess } from "@/components/AccessGate";

// 'admin' excluded — there is exactly one admin account (seeded directly by
// a migration, see current_web_roles()'s account_type fallback), not
// creatable here.
const ACCOUNT_TYPE_OPTIONS: TheraAccountType[] = ["admin_issued", "review", "staff", "partner", "tester", "cskh"];
const ACCESS_LEVEL_OPTIONS: TheraAccessLevel[] = ["free", "premium", "admin_granted"];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN");
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "Chưa đăng nhập";
  return new Date(iso).toLocaleString("vi-VN");
}
function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// Not a real inbox — TheraHOME-issued accounts log in with a plain
// username (see thera-login page); Supabase Auth still needs an
// email-shaped identifier under the hood, so the edge function derives
// `<username>@thera.local` itself. Validated here just enough to keep it a
// valid email local-part once that suffix is appended.
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

function PasswordField({ label, value, onChange, placeholder, style }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={style}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ position: "relative" }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          // Admin is CREATING someone else's credentials — without this,
          // Chrome autofills the admin's own saved login into the form.
          autoComplete="new-password"
          name="thera-new-account-password"
          style={{ ...inputStyle, paddingRight: 40 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", display: "flex", padding: 4 }}
        >
          <Icon name={visible ? "eye-off" : "eye"} size={17} color="var(--text-muted)" />
        </button>
      </div>
    </div>
  );
}

function CreateAccountModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: CreateTheraAccountInput) => Promise<void> }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState<TheraAccountType>("admin_issued");
  const [accessLevel, setAccessLevel] = useState<TheraAccessLevel>("free");
  const [country, setCountry] = useState<TheraAccountCountry>("VN");
  const [expiresAt, setExpiresAt] = useState("");
  const [onboardingRequired, setOnboardingRequired] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleAccountTypeChange(next: TheraAccountType) {
    setAccountType(next);
    if (next === "review") {
      // Preset for Apple App Review: highest access, straight into Home.
      setAccessLevel("admin_granted");
      setOnboardingRequired(false);
    }
  }

  const usernameValid = USERNAME_RE.test(username.trim());
  const passwordsMatch = password.length >= 8 && password === confirmPassword;
  const canSubmit = !!fullName.trim() && usernameValid && passwordsMatch && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate({
        username: username.trim(),
        password,
        full_name: fullName.trim(),
        account_type: accountType,
        access_level: accessLevel,
        country,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        onboarding_required: onboardingRequired,
        notes: notes.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Tạo tài khoản TheraHOME"
      onClose={onClose}
      width={480}
      footer={
        <Fragment>
          <GhostBtn onClick={onClose}>Hủy</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={!canSubmit}>
            {submitting ? "Đang tạo..." : "Tạo tài khoản"}
          </PrimaryBtn>
        </Fragment>
      }
    >
      <FieldLabel>Tên hiển thị</FieldLabel>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ví dụ: App Review iOS" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Username</FieldLabel>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ví dụ: cskh_lan" autoCapitalize="none" autoComplete="off" name="thera-new-account-username" style={{ ...inputStyle, marginBottom: 14 }} />
      <PasswordField label="Password" value={password} onChange={setPassword} placeholder="Tối thiểu 8 ký tự" style={{ marginBottom: 14 }} />
      <PasswordField label="Nhập lại Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Nhập lại để xác nhận" style={{ marginBottom: 14 }} />
      {confirmPassword && !passwordsMatch ? (
        <div style={{ fontSize: 12.5, color: "var(--error)", marginTop: -10, marginBottom: 14 }}>Mật khẩu nhập lại không khớp.</div>
      ) : null}
      <FieldLabel>Loại tài khoản</FieldLabel>
      <select value={accountType} onChange={(e) => handleAccountTypeChange(e.target.value as TheraAccountType)} style={{ ...inputStyle, marginBottom: 14 }}>
        {ACCOUNT_TYPE_OPTIONS.map((k) => (
          <option key={k} value={k}>{ACCOUNT_TYPE_META[k]}</option>
        ))}
      </select>
      <FieldLabel>Quyền truy cập</FieldLabel>
      <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as TheraAccessLevel)} style={{ ...inputStyle, marginBottom: 14 }}>
        {ACCESS_LEVEL_OPTIONS.map((k) => (
          <option key={k} value={k}>{ACCESS_LEVEL_META[k]}</option>
        ))}
      </select>
      <FieldLabel>Quốc gia / Thị trường</FieldLabel>
      <select value={country} onChange={(e) => setCountry(e.target.value as TheraAccountCountry)} style={{ ...inputStyle, marginBottom: 6 }}>
        {COUNTRY_OPTIONS.map((k) => (
          <option key={k} value={k}>{COUNTRY_META[k]}</option>
        ))}
      </select>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
        Quyết định giá bán, link sản phẩm, video lộ trình và bài ghim mà tài khoản này thấy trong app.
        Ngôn ngữ hiển thị vẫn theo máy của người dùng, không theo ô này.
      </div>
      <FieldLabel>Ngày hết hạn (tùy chọn)</FieldLabel>
      <input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} type="date" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Yêu cầu onboarding</FieldLabel>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {([[true, "Có"], [false, "Không"]] as const).map(([v, l]) => (
          <button
            key={l}
            onClick={() => setOnboardingRequired(v)}
            style={{
              flex: 1,
              border: onboardingRequired === v ? "none" : "1px solid var(--border-input)",
              background: onboardingRequired === v ? "var(--color-primary)" : "none",
              color: onboardingRequired === v ? "#fff" : "var(--text-primary)",
              borderRadius: 10,
              padding: "9px 0",
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
      <FieldLabel>Ghi chú</FieldLabel>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
    </Modal>
  );
}

function EditAccountModal({ account, onClose, onSave }: { account: TheraAccount; onClose: () => void; onSave: (patch: Parameters<typeof updateTheraAccount>[1]) => Promise<void> }) {
  const [fullName, setFullName] = useState(account.fullName);
  const [accountType, setAccountType] = useState(account.accountType);
  const [accessLevel, setAccessLevel] = useState(account.accessLevel);
  const [country, setCountry] = useState<TheraAccountCountry>(account.country);
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(account.expiresAt));
  const [notes, setNotes] = useState(account.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await onSave({
        full_name: fullName.trim(),
        account_type: accountType,
        access_level: accessLevel,
        country,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        notes: notes.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const isSingletonAdmin = account.accountType === "admin";

  return (
    <Modal
      title={"Chỉnh sửa · " + account.username}
      onClose={onClose}
      width={480}
      footer={
        <Fragment>
          <GhostBtn onClick={onClose}>Hủy</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={submitting}>{submitting ? "Đang lưu..." : "Lưu thay đổi"}</PrimaryBtn>
        </Fragment>
      }
    >
      <FieldLabel>Tên hiển thị</FieldLabel>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Loại tài khoản</FieldLabel>
      {isSingletonAdmin ? (
        <div style={{ ...inputStyle, marginBottom: 6, color: "var(--text-secondary)", background: "var(--bg-app)" }}>
          {ACCOUNT_TYPE_META.admin}
        </div>
      ) : (
        <select value={accountType} onChange={(e) => setAccountType(e.target.value as TheraAccountType)} style={{ ...inputStyle, marginBottom: 14 }}>
          {ACCOUNT_TYPE_OPTIONS.map((k) => (
            <option key={k} value={k}>{ACCOUNT_TYPE_META[k]}</option>
          ))}
        </select>
      )}
      {isSingletonAdmin ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
          Tài khoản quản trị duy nhất — không thể đổi loại tài khoản.
        </div>
      ) : null}
      <FieldLabel>Quyền truy cập</FieldLabel>
      <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as TheraAccessLevel)} style={{ ...inputStyle, marginBottom: 14 }}>
        {ACCESS_LEVEL_OPTIONS.map((k) => (
          <option key={k} value={k}>{ACCESS_LEVEL_META[k]}</option>
        ))}
      </select>
      <FieldLabel>Quốc gia / Thị trường</FieldLabel>
      <select value={country} onChange={(e) => setCountry(e.target.value as TheraAccountCountry)} style={{ ...inputStyle, marginBottom: 6 }}>
        {COUNTRY_OPTIONS.map((k) => (
          <option key={k} value={k}>{COUNTRY_META[k]}</option>
        ))}
      </select>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
        Quyết định giá bán, link sản phẩm, video lộ trình và bài ghim mà tài khoản này thấy trong app.
        Ngôn ngữ hiển thị vẫn theo máy của người dùng, không theo ô này.
      </div>
      <FieldLabel>Ngày hết hạn (gia hạn tại đây)</FieldLabel>
      <input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} type="date" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Ghi chú</FieldLabel>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
    </Modal>
  );
}

function ResetPasswordModal({ account, onClose, onReset }: { account: TheraAccount; onClose: () => void; onReset: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (password.length < 8 || submitting) return;
    setSubmitting(true);
    try {
      await onReset(password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={"Đặt lại mật khẩu · " + account.username}
      onClose={onClose}
      width={420}
      footer={
        <Fragment>
          <GhostBtn onClick={onClose}>Hủy</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={submitting || password.length < 8}>{submitting ? "Đang lưu..." : "Đặt lại mật khẩu"}</PrimaryBtn>
        </Fragment>
      }
    >
      <FieldLabel>Mật khẩu mới</FieldLabel>
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" name="thera-reset-password" style={inputStyle} />
      <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-muted)" }}>
        Admin không thể xem lại mật khẩu cũ — chỉ có thể đặt mật khẩu mới.
      </div>
    </Modal>
  );
}

export function TheraAccountsView() {
  const { signOut } = useWebAccess();
  const [accounts, setAccounts] = useState<TheraAccount[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TheraAccount | null>(null);
  const [resetting, setResetting] = useState<TheraAccount | null>(null);

  function reload() {
    fetchTheraAccounts().then(setAccounts).catch(() => setAccounts([]));
  }
  useEffect(reload, []);

  // `admin-manage-account`'s own "Missing Authorization header" response is
  // what a stale/expired admin session looks like from here (see db.ts's
  // `invokeAdminManageAccount` for why that specific string is now reachable
  // at all, and AccessGate's `onAuthStateChange` listener for the proactive
  // half of this fix) — surfaced with its own message + a sign-out instead
  // of the generic failure toast, since "try again" alone won't help.
  function handleAdminManageAccountError(e: unknown, genericMessage: string) {
    const message = e instanceof Error ? e.message : "";
    if (message === "Missing Authorization header") {
      pushToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      void signOut();
      return;
    }
    pushToast(message === "username_already_registered" ? "Tên đăng nhập này đã được sử dụng." : genericMessage);
  }

  async function handleCreate(input: CreateTheraAccountInput) {
    try {
      await createTheraAccount(input);
      setCreating(false);
      pushToast("Đã tạo tài khoản " + input.username);
      reload();
    } catch (e) {
      handleAdminManageAccountError(e, "Không thể tạo tài khoản.");
    }
  }

  async function handleSave(id: string, patch: Parameters<typeof updateTheraAccount>[1]) {
    try {
      await updateTheraAccount(id, patch);
      setEditing(null);
      pushToast("Đã lưu thay đổi");
      reload();
    } catch {
      pushToast("Không thể lưu thay đổi");
    }
  }

  async function handleReset(id: string, password: string) {
    try {
      await resetTheraAccountPassword(id, password);
      setResetting(null);
      pushToast("Đã đặt lại mật khẩu");
    } catch (e) {
      handleAdminManageAccountError(e, "Không thể đặt lại mật khẩu");
    }
  }

  async function toggleLocked(a: TheraAccount) {
    try {
      await updateTheraAccount(a.id, { locked: !a.locked });
      pushToast(a.locked ? "Đã mở khóa " + a.username : "Đã khóa " + a.username);
      reload();
    } catch {
      pushToast("Không thể cập nhật trạng thái");
    }
  }

  async function deleteAccount(a: TheraAccount) {
    if (!window.confirm("Xóa (khóa vĩnh viễn) tài khoản " + a.username + "?")) return;
    try {
      await updateTheraAccount(a.id, { locked: true });
      pushToast("Đã khoá vĩnh viễn tài khoản " + a.username);
      reload();
    } catch {
      pushToast("Không thể xóa tài khoản");
    }
  }

  if (!accounts) return <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>;

  return (
    <TableShell
      subtitle="Tài khoản do Admin cấp trực tiếp — App Review, nhân viên, đối tác, tester, chăm sóc khách hàng. Đăng nhập bằng Username/Password, không dùng Google/Apple."
      action={<PrimaryBtn icon="plus" onClick={() => setCreating(true)}>Tạo tài khoản</PrimaryBtn>}
      columns={["Tài khoản", "Tên người dùng", "Loại tài khoản", "Quyền truy cập", "Thị trường", "Trạng thái", "Ngày hết hạn", "Onboarding", "Ngày tạo", "Lần đăng nhập cuối", ""]}
      modals={
        <Fragment>
          {creating ? <CreateAccountModal onClose={() => setCreating(false)} onCreate={handleCreate} /> : null}
          {editing ? <EditAccountModal account={editing} onClose={() => setEditing(null)} onSave={(patch) => handleSave(editing.id, patch)} /> : null}
          {resetting ? <ResetPasswordModal account={resetting} onClose={() => setResetting(null)} onReset={(password) => handleReset(resetting.id, password)} /> : null}
        </Fragment>
      }
    >
      {accounts.map((a) => {
        const isSingletonAdmin = a.accountType === "admin";
        return (
        <tr key={a.id} style={{ borderTop: "1px solid var(--divider)" }}>
          <td style={{ padding: "12px 20px", color: "var(--text-primary)", fontWeight: 600 }}>{a.username}</td>
          <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{a.fullName || "—"}</td>
          <td style={{ padding: "12px 20px" }}>
            <Badge color="var(--color-primary)" bg="var(--color-primary-tint-10)">{ACCOUNT_TYPE_META[a.accountType]}</Badge>
          </td>
          <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{ACCESS_LEVEL_META[a.accessLevel]}</td>
          <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{COUNTRY_META[a.country].split("·")[0].trim()}</td>
          <td style={{ padding: "12px 20px" }}>
            {a.locked ? (
              <Badge color="var(--error)" bg="rgba(220,60,60,0.12)">Đã khóa</Badge>
            ) : (
              <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Hoạt động</Badge>
            )}
          </td>
          <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{fmtDate(a.expiresAt)}</td>
          <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{a.onboardingCompleted ? "Đã hoàn tất" : "Chưa hoàn tất"}</td>
          <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{fmtDate(a.createdAt)}</td>
          <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{fmtDateTime(a.lastLoginAt)}</td>
          <td style={{ padding: "12px 20px", textAlign: "right", whiteSpace: "nowrap" }}>
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <GhostBtn onClick={() => setEditing(a)}>Sửa</GhostBtn>
              <GhostBtn onClick={() => setResetting(a)}>Đổi mật khẩu</GhostBtn>
              {isSingletonAdmin ? (
                <span title="Tài khoản quản trị duy nhất — không thể khóa/xóa" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Tài khoản gốc
                </span>
              ) : (
                <Fragment>
                  <GhostBtn onClick={() => toggleLocked(a)}>{a.locked ? "Mở khóa" : "Khóa"}</GhostBtn>
                  <GhostBtn color="var(--error)" onClick={() => deleteAccount(a)}>Xóa</GhostBtn>
                </Fragment>
              )}
            </div>
          </td>
        </tr>
        );
      })}
    </TableShell>
  );
}
