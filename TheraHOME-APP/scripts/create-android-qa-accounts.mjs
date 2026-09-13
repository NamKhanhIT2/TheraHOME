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
// Everything optional is read at YOUR runtime; nothing is hard-coded. The URL
// and publishable key come from TheraHOME-APP/.env automatically.
//   ADMIN_EMAIL / ADMIN_PASSWORD   skip the prompts (mind zsh quoting)
//   ADMIN_ACCESS_TOKEN             use an admin JWT instead of signing in
//   COUNTRY                        VN | US | MALAY   default VN
//
// Run (it asks for the admin email + password; the password is not echoed and
// never reaches your shell history):
//   cd TheraHOME-APP
//   node scripts/create-android-qa-accounts.mjs

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

// Read TheraHOME-APP/.env so the URL and the publishable key need not be typed.
// Both are client-safe by design (RLS is what protects data, not key secrecy).
function fromEnvFile(key) {
  try {
    const text = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : undefined;
  } catch {
    return undefined;
  }
}

const SUPABASE_URL = (
  process.env.SUPABASE_URL || fromEnvFile('EXPO_PUBLIC_SUPABASE_URL') || 'https://nyjvtvmllwbyfokldgtj.supabase.co'
).replace(/\/$/, '');
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  fromEnvFile('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const COUNTRY = process.env.COUNTRY || 'VN';

if (!ANON_KEY) {
  console.error('Khong tim thay khoa publishable. Chay script tu trong thu muc TheraHOME-APP (noi co .env).');
  process.exit(1);
}

// Asking at the prompt instead of taking ADMIN_PASSWORD from the environment:
// an interactive zsh expands ! and $ inside an unquoted value, so a password
// that obeys the letter+digit+symbol policy often reaches the server mangled —
// which is exactly what "invalid_credentials" looked like on 2026-09-13. Typed
// here it is never mangled, never lands in shell history, and is never echoed.
function ask(question, hidden) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let masked = false;
    if (hidden) {
      masked = true;
      const onData = () => {
        if (masked) process.stdout.write(`\x1B[2K\x1B[200D${question}`);
      };
      process.stdin.on('data', onData);
      rl.once('close', () => process.stdin.removeListener('data', onData));
    }
    rl.question(question, (answer) => {
      masked = false;
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
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
  const identifier =
    process.env.ADMIN_EMAIL ||
    process.env.ADMIN_USERNAME ||
    (await ask('Email admin (vi du therahome@thera.local): ', false));
  const password = process.env.ADMIN_PASSWORD || (await ask('Mat khau admin (khong hien ra): ', true));
  if (!identifier || !password) {
    console.error('Thieu email hoac mat khau admin.');
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
