#!/usr/bin/env node
// Create the TWO Android QA accounts (2026-09-13):
//
//   1) uitester  — account_type 'review'  → GIAO DIỆN (UI)
//      Highest-privilege type: no day-locks, no phase-locks, the whole catalog
//      of every product is provisioned on creation. Onboarding is skipped.
//      Purpose: walk EVERY screen in light + dark without waiting 14 days or
//      activating a device. This account can reach screens a normal account
//      physically cannot.
//
//   2) qatester  — account_type 'tester'  → CHỨC NĂNG (functionality)
//      Behaves EXACTLY like a real customer: intake questionnaire, device
//      activation, day-locks, community moderation queue, rate limits.
//      Its activation email qatester@thera.local is already on the TheraNECK+
//      allow-list (seeded 2026-09-13), so the real Activate flow succeeds.
//      Purpose: prove the real user journey works end to end.
//
// WHY A SCRIPT YOU RUN (not done for you): the assistant must never generate,
// see, or handle account passwords. This script generates them locally in YOUR
// environment and writes them to a git-ignored CSV that never leaves your Mac.
//
// Requirements: Node 18+ (built-in fetch/crypto). No npm install needed.
//
// Env (read at YOUR runtime; nothing is hard-coded):
//   SUPABASE_URL        default https://nyjvtvmllwbyfokldgtj.supabase.co
//   SUPABASE_ANON_KEY   or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (required)
//   ADMIN_ACCESS_TOKEN  an admin JWT — OR provide login details below:
//   ADMIN_EMAIL         the admin account email   (preferred)
//   ADMIN_USERNAME      the admin account username (fallback)
//   ADMIN_PASSWORD      the admin account password
//   COUNTRY             VN | US | MALAY   default VN
//
// Run:
//   cd TheraHOME-APP
//   SUPABASE_ANON_KEY=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/create-android-qa-accounts.mjs

import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://nyjvtvmllwbyfokldgtj.supabase.co').replace(/\/$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const COUNTRY = process.env.COUNTRY || 'VN';

if (!ANON_KEY) {
  console.error('Missing SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY). It is in TheraHOME-APP/.env');
  process.exit(1);
}

// The two accounts. Keep these in sync with docs/qa-android-test-plan.md.
const ACCOUNTS = [
  {
    username: 'uitester',
    full_name: 'QA Giao diện (Android)',
    account_type: 'review',
    access_level: 'admin_granted',
    // Skip the questionnaire: this account exists to inspect screens, and the
    // intake answers would only get in the way.
    onboarding_required: false,
    role: 'giao dien (UI)',
    notes: 'Android QA - giao dien, sang/toi (2026-09-13)',
  },
  {
    username: 'qatester',
    full_name: 'QA Chức năng (Android)',
    account_type: 'tester',
    access_level: 'free',
    // Start at the very beginning: the questionnaire is itself under test.
    onboarding_required: true,
    role: 'chuc nang (functionality)',
    notes: 'Android QA - chuc nang, luong that nhu khach (2026-09-13)',
  },
];

// A strong password with no ambiguous characters, comfortably over the
// server's 8-char minimum and satisfying letter+digit+symbol.
function makePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(20);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `Th!${out}9`; // guarantees an upper, a symbol and a digit class
}

async function getAdminToken() {
  if (process.env.ADMIN_ACCESS_TOKEN) return process.env.ADMIN_ACCESS_TOKEN;
  const identifier = process.env.ADMIN_EMAIL || process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!identifier || !password) {
    console.error('Provide ADMIN_ACCESS_TOKEN, or ADMIN_EMAIL (or ADMIN_USERNAME) + ADMIN_PASSWORD.');
    process.exit(1);
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ identifier, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    console.error('Admin sign-in failed:', body.error || res.status);
    process.exit(1);
  }
  return body.access_token;
}

async function createAccount(token, spec) {
  const password = makePassword();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      action: 'create',
      username: spec.username,
      password,
      full_name: spec.full_name,
      account_type: spec.account_type,
      access_level: spec.access_level,
      country: COUNTRY,
      onboarding_required: spec.onboarding_required,
      notes: spec.notes,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ...spec, ok: false, error: body.error || `http_${res.status}` };
  // No real email was sent, so the account's login email is the synthetic one.
  return { ...spec, ok: true, password, loginEmail: `${spec.username}@thera.local`, userId: body.user_id };
}

const token = await getAdminToken();
const rows = [];
for (const spec of ACCOUNTS) {
  const r = await createAccount(token, spec);
  if (r.ok) {
    console.log(`✓ ${r.username}  [${r.role}]  đăng nhập bằng: ${r.loginEmail}`);
    rows.push(r);
  } else if (r.error === 'username_already_registered') {
    console.log(`• ${r.username}  đã tồn tại — bỏ qua (đổi mật khẩu trong tab Tài khoản TheraHOME trên web)`);
  } else {
    console.error(`✗ ${r.username}  ${r.error}`);
  }
}

if (rows.length) {
  const csv =
    'role,login_email,password,account_type,activation_email,country\n' +
    rows
      .map((r) => {
        // 'review' is auto-provisioned with every product; only the functional
        // tester goes through the Activate screen.
        const activation = r.account_type === 'review' ? '(không cần kích hoạt)' : r.loginEmail;
        return `${r.role},${r.loginEmail},${r.password},${r.account_type},${activation},${COUNTRY}`;
      })
      .join('\n') + '\n';
  const out = new URL('./android-qa-credentials.csv', import.meta.url).pathname;
  writeFileSync(out, csv, { mode: 0o600 });
  console.log(`\nĐã ghi ${rows.length} tài khoản vào ${out}`);
  console.log('Đăng nhập trong app bằng EMAIL (không đăng nhập bằng username).');
}
