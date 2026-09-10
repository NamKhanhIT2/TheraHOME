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
  deleteTheraAccount,
  theraAccountDeleteMessage,
  type CreateTheraAccountInput,
} from "@/lib/db";
import { Badge, PrimaryBtn, GhostBtn, FieldLabel, MarketSelect, inputStyle } from "@/components/ui/primitives";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Modal } from "@/components/ui/Modal";
import { TableShell } from "@/components/ui/TableShell";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";
import { useWebAccess } from "@/components/AccessGate";

// 'admin' excluded — there is exactly one admin account (seeded directly by
// a migration, see current_web_roles()'s account_type fallback), not
// creatable here. Ordered by how this tab is actually used: full-access /
// no-lock accounts first (its main purpose — customers self-register in the
// app, so this tab exists for the privileged accounts self-service can't
// make), then staff, then the "behaves like a real customer" types.
const ACCOUNT_TYPE_OPTIONS: TheraAccountType[] = ["review", "cskh", "tester", "partner", "staff", "admin_issued"];
const ACCESS_LEVEL_OPTIONS: TheraAccessLevel[] = ["free", "premium", "admin_granted"];

// What each type actually DOES in the app, so the person creating one sees the
// consequence rather than a bare enum. Only `review` bypasses the customer
// gates (see the app's `accountType === 'review'` checks: day-locks, block/
// expiry, full catalog); every other type walks the real activation flow.
const CAPABILITY_META: Record<TheraAccountType, { tag: string; locked: boolean; desc: string }> = {
  review: {
    tag: "Toàn quyền · không khoá",
    locked: false,
    desc: "Thấy mọi tính năng ngay, KHÔNG cần mua/kích hoạt, KHÔNG bao giờ bị khoá hay hết hạn, vào thẳng Home. Dùng cho Apple/Google App Review và QA/test nội bộ toàn diện.",
  },
  cskh: {
    tag: "Nhân viên hỗ trợ",
    locked: false,
    desc: "Vào console CSKH + kiểm duyệt cộng đồng. Là nhân viên, không có lộ trình bệnh nhân.",
  },
  tester: {
    tag: "Như khách thật",
    locked: false,
    desc: "Đi qua đúng luồng khách: phải kích hoạt sản phẩm mới mở lộ trình, có khoá ngày — để test trải nghiệm thực tế.",
  },
  partner: { tag: "Như khách thật", locked: false, desc: "Đối tác. Trải nghiệm như khách: phải kích hoạt sản phẩm." },
  staff: { tag: "Như khách thật", locked: false, desc: "Nhân viên (không phải CSKH). Trải nghiệm như khách: phải kích hoạt." },
  admin_issued: { tag: "Như khách thật", locked: false, desc: "Người dùng được cấp thủ công. Trải nghiệm như khách: phải kích hoạt." },
  admin: { tag: "", locked: false, desc: "" },
};

// Market filter. The DB code for the UK/EU/US market is "US" while the label
// everywhere in the UI is "UK" — same mapping RoutineView/ProductsView use.
type MarketFilter = "ALL" | TheraAccountCountry;
const MARKET_FILTER_TABS: Array<[MarketFilter, string]> = [
  ["ALL", "Tất cả"],
  ["VN", "VN"],
  ["US", "UK"],
  ["MALAY", "ML"],
];

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

// Every issued account has a username (login by username always works). A
// real email is now optional: when omitted, the edge function derives a
// synthetic `<username>@thera.local` under the hood (Supabase Auth needs an
// email-shaped identifier); when given, the account also logs in and resets
// its password by that real address. This regex validates the username enough
// to stay a valid email local-part once the `.local` suffix is appended.
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

// Password policy (owner, 2026-09-10) — kept in sync with the app
// (authAccount.ts) and the admin-manage-account Edge Function: at least 8
// characters mixing a letter, a digit and a special character.
function isPasswordStrongEnough(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}
const PASSWORD_HINT = "Tối thiểu 8 ký tự, gồm chữ, số và ký tự đặc biệt.";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Defaults to the tab's main purpose: a full-access, never-locked account.
  const [accountType, setAccountType] = useState<TheraAccountType>("review");
  const [accessLevel, setAccessLevel] = useState<TheraAccessLevel>("admin_granted");
  const [country, setCountry] = useState<TheraAccountCountry>("VN");
  const [expiresAt, setExpiresAt] = useState("");
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Apple App Review accounts must always see everything and never be locked
  // out mid-review (App Store Guideline 2.1). Selecting "App Review" locks the
  // access/onboarding/expiry choices to the safe preset so they can't be set
  // to anything that would gate a reviewer.
  const isReview = accountType === "review";

  function handleAccountTypeChange(next: TheraAccountType) {
    const wasReview = accountType === "review";
    setAccountType(next);
    if (next === "review") {
      setAccessLevel("admin_granted"); // full access
      setOnboardingRequired(false); // straight into Home
      setExpiresAt(""); // never expires
    } else if (wasReview) {
      // Leaving the full-access preset: back to customer-like defaults.
      setAccessLevel("free");
      setOnboardingRequired(true);
    }
  }

  const usernameValid = USERNAME_RE.test(username.trim());
  // Email is OPTIONAL (owner, 2026-09-10): admins reset passwords directly in
  // this tab, so an issued account doesn't need a real inbox. When left blank
  // the Edge Function derives <username>@thera.local, which is what the person
  // types to sign in. When given, it must be a real, valid address.
  const emailValid = email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordStrong = isPasswordStrongEnough(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit = !!fullName.trim() && usernameValid && emailValid && passwordStrong && passwordsMatch && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate({
        username: username.trim(),
        email: email.trim() || null,
        password,
        full_name: fullName.trim(),
        account_type: accountType,
        access_level: isReview ? "admin_granted" : accessLevel,
        country,
        // App Review never expires, regardless of any stale value in the field.
        expires_at: isReview ? null : expiresAt ? new Date(expiresAt).toISOString() : null,
        onboarding_required: isReview ? false : onboardingRequired,
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
      {/* Customers self-register in the app now, so this tab is purpose-first:
          it exists for the privileged accounts self-service can't make. */}
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        Khách hàng tự đăng ký trong app. Tab này chỉ để tạo <b>tài khoản đặc biệt</b>: App Review / QA
        toàn quyền không khoá, nhân viên, và tester — những quyền self-service không có.
      </div>

      <FieldLabel>Mục đích / Loại tài khoản</FieldLabel>
      <select value={accountType} onChange={(e) => handleAccountTypeChange(e.target.value as TheraAccountType)} style={{ ...inputStyle, marginBottom: 10 }}>
        {ACCOUNT_TYPE_OPTIONS.map((k) => (
          <option key={k} value={k}>
            {ACCOUNT_TYPE_META[k]}{CAPABILITY_META[k].tag ? ` — ${CAPABILITY_META[k].tag}` : ""}
          </option>
        ))}
      </select>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
          padding: "10px 12px",
          borderRadius: 10,
          background: isReview ? "rgba(30,158,94,0.10)" : "rgba(0,0,0,0.03)",
          border: isReview ? "1px solid rgba(30,158,94,0.35)" : "1px solid var(--border-input)",
        }}
      >
        {isReview ? (
          <Icon name="shield" size={16} color="#1E9E5E" />
        ) : (
          <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--text-muted)", marginTop: 5, flexShrink: 0 }} />
        )}
        <div style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.5 }}>
          <b>{CAPABILITY_META[accountType].tag}</b> — {CAPABILITY_META[accountType].desc}
          {isReview ? (
            <div style={{ marginTop: 4, color: "var(--text-muted)" }}>
              Quyền truy cập, Onboarding và Ngày hết hạn đã được đặt sẵn &amp; ẩn để không cấu hình nhầm (Apple 2.1).
            </div>
          ) : null}
        </div>
      </div>

      <FieldLabel>Tên hiển thị</FieldLabel>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ví dụ: App Review iOS" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Username</FieldLabel>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ví dụ: cskh_lan" autoCapitalize="none" autoComplete="off" name="thera-new-account-username" style={{ ...inputStyle, marginBottom: 6 }} />
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
        Tên hiển thị trong app / cộng đồng — <b>có thể trùng</b> với tài khoản khác. Không dùng để đăng nhập.
      </div>
      <FieldLabel>Email (tùy chọn)</FieldLabel>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        autoCapitalize="none"
        autoComplete="off"
        name="thera-new-account-email"
        placeholder="Ví dụ: review@therahomeai.com"
        style={{ ...inputStyle, marginBottom: 6 }}
      />
      {email.trim() && !emailValid ? (
        <div style={{ fontSize: 12.5, color: "var(--error)", marginBottom: 14 }}>Email không hợp lệ.</div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
          Có email → đăng nhập bằng email đó. Bỏ trống → đăng nhập bằng <code>username@thera.local</code>.
          Không cần email để đổi mật khẩu — Admin đặt lại trực tiếp ở tab này.
        </div>
      )}
      <PasswordField label="Password" value={password} onChange={setPassword} placeholder="Tối thiểu 8 ký tự" style={{ marginBottom: 6 }} />
      <div style={{ fontSize: 12, color: password.length > 0 && !passwordStrong ? "var(--error)" : "var(--text-muted)", marginBottom: 14 }}>{PASSWORD_HINT}</div>
      <PasswordField label="Nhập lại Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Nhập lại để xác nhận" style={{ marginBottom: 14 }} />
      {confirmPassword && !passwordsMatch ? (
        <div style={{ fontSize: 12.5, color: "var(--error)", marginTop: -10, marginBottom: 14 }}>Mật khẩu nhập lại không khớp.</div>
      ) : null}

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

      {/* Access / expiry / onboarding only matter for the customer-like types.
          App Review is forced to its full-access, never-locked preset, so these
          are hidden entirely for it. */}
      {!isReview ? (
        <Fragment>
          <FieldLabel>Quyền truy cập</FieldLabel>
          <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as TheraAccessLevel)} style={{ ...inputStyle, marginBottom: 14 }}>
            {ACCESS_LEVEL_OPTIONS.map((k) => (
              <option key={k} value={k}>{ACCESS_LEVEL_META[k]}</option>
            ))}
          </select>
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
        </Fragment>
      ) : null}
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
    if (submitting) return;
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

  const passwordStrong = isPasswordStrongEnough(password);

  async function submit() {
    if (!passwordStrong || submitting) return;
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
          <PrimaryBtn onClick={submit} disabled={submitting || !passwordStrong}>{submitting ? "Đang lưu..." : "Đặt lại mật khẩu"}</PrimaryBtn>
        </Fragment>
      }
    >
      <FieldLabel>Mật khẩu mới</FieldLabel>
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" name="thera-reset-password" style={{ ...inputStyle, marginBottom: 6 }} />
      <div style={{ fontSize: 12, color: password.length > 0 && !passwordStrong ? "var(--error)" : "var(--text-muted)" }}>{PASSWORD_HINT}</div>
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
  const [deleting, setDeleting] = useState<TheraAccount | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("ALL");

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
    const known: Record<string, string> = {
      // Only reachable when two NO-email accounts would share the synthetic
      // <username>@thera.local auth email — the username itself may repeat.
      username_already_registered: "Đã có tài khoản không-email dùng tên này (trùng địa chỉ username@thera.local). Thêm Email hoặc chọn tên khác.",
      email_already_registered: "Email này đã được dùng cho một tài khoản khác.",
      invalid_email: "Email không hợp lệ.",
      password_too_weak: "Mật khẩu chưa đủ mạnh — cần tối thiểu 8 ký tự, gồm chữ, số và ký tự đặc biệt.",
      password_too_short: "Mật khẩu chưa đủ mạnh — cần tối thiểu 8 ký tự, gồm chữ, số và ký tự đặc biệt.",
    };
    pushToast(known[message] ?? genericMessage);
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

  // Real delete (2026-09-06). This used to set `locked` and nothing else, so
  // the row stayed in the table marked "Đã khóa" — "Khóa" already does that,
  // reversibly, right next to it. Confirmed through ConfirmModal rather than
  // window.confirm so the consequences are spelled out.
  async function confirmDeleteAccount() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteTheraAccount(deleting.id);
      pushToast("Đã xoá tài khoản " + deleting.username);
      setDeleting(null);
      reload();
    } catch (e) {
      pushToast(theraAccountDeleteMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!accounts) return <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>;

  const visibleAccounts = accounts.filter((a) => marketFilter === "ALL" || a.country === marketFilter);

  return (
    <TableShell
      subtitle="Tài khoản đặc biệt do Admin cấp — App Review / QA toàn quyền không khoá, nhân viên (CSKH), tester. Khách hàng thường tự đăng ký trong app; tab này chỉ dành cho những quyền self-service không có. Đăng nhập bằng Email + mật khẩu — Email tùy chọn (Admin đặt lại mật khẩu trực tiếp, không cần email)."
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MarketSelect options={MARKET_FILTER_TABS} value={marketFilter} onChange={setMarketFilter} />
          <PrimaryBtn icon="plus" onClick={() => setCreating(true)}>Tạo tài khoản</PrimaryBtn>
        </div>
      }
      columns={["Tài khoản", "Tên người dùng", "Loại tài khoản", "Quyền truy cập", "Thị trường", "Trạng thái", "Ngày hết hạn", "Onboarding", "Ngày tạo", "Lần đăng nhập cuối", ""]}
      modals={
        <Fragment>
          {creating ? <CreateAccountModal onClose={() => setCreating(false)} onCreate={handleCreate} /> : null}
          {editing ? <EditAccountModal account={editing} onClose={() => setEditing(null)} onSave={(patch) => handleSave(editing.id, patch)} /> : null}
          {resetting ? <ResetPasswordModal account={resetting} onClose={() => setResetting(null)} onReset={(password) => handleReset(resetting.id, password)} /> : null}
          {deleting ? (
            <ConfirmModal
              title="Xoá tài khoản"
              message={
                `Xoá vĩnh viễn tài khoản "${deleting.username}"? Tài khoản sẽ không đăng nhập được nữa và toàn bộ lộ trình, tiến độ, nhật ký đau/nước, hội thoại và thông báo của tài khoản này bị xoá theo. ` +
                "Bài viết đã đăng trong Cộng đồng vẫn còn nhưng không còn tên tác giả. Không thể hoàn tác — nếu chỉ muốn tạm chặn đăng nhập, hãy dùng \"Khóa\"."
              }
              confirmLabel="Xoá vĩnh viễn"
              busy={deleteBusy}
              onConfirm={confirmDeleteAccount}
              onCancel={() => setDeleting(null)}
            />
          ) : null}
        </Fragment>
      }
    >
      {visibleAccounts.length === 0 ? (
        <tr>
          <td colSpan={11} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            Không có tài khoản nào ở thị trường này.
          </td>
        </tr>
      ) : null}
      {visibleAccounts.map((a) => {
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
                  <GhostBtn color="var(--error)" onClick={() => setDeleting(a)}>Xóa</GhostBtn>
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
