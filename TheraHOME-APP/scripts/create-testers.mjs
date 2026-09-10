#!/usr/bin/env node
// Create 12 closed-testing tester accounts (Google Play / TestFlight).
//
// WHY A SCRIPT YOU RUN (not done for you): creating auth accounts and handling
// passwords is something the assistant must not do — you run this so the
// passwords only ever exist in your own environment and the output file.
//
// What it does, per account tester01..tester12:
//   • POST {SUPABASE_URL}/functions/v1/admin-manage-account  action=create
//     account_type='tester', access_level='free', country=COUNTRY,
//     onboarding_required=false, with a locally-generated strong password.
//   • account_type='tester' means the app behaves EXACTLY as for a real
//     customer (day-locks apply, no reviewer bypass). Each tester's synthetic
//     email  testerNN@thera.local  is already on the TheraNECK+ activation
//     allow-list, so in-app they Activate with that email to get the program.
//   • Writes scripts/testers-credentials.csv (git-ignored) with the app login
//     (username + password) and the activation email for each tester.
//
// Requirements: Node 18+ (built-in fetch/crypto). No npm install needed.
//
// Env (read at YOUR runtime; nothing is hard-coded):
//   SUPABASE_URL           default https://nyjvtvmllwbyfokldgtj.supabase.co
//   SUPABASE_ANON_KEY      or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (required)
//   ADMIN_ACCESS_TOKEN     an admin JWT — OR provide the two below to fetch one:
//   ADMIN_USERNAME         the admin account username
//   ADMIN_PASSWORD         the admin account password
//   COUNT                  default 12
//   COUNTRY                VN | US | MALAY   default VN
//
// Run:
//   cd TheraHOME-APP
//   SUPABASE_ANON_KEY=... ADMIN_USERNAME=... ADMIN_PASSWORD=... node scripts/create-testers.mjs

import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://nyjvtvmllwbyfokldgtj.supabase.co').replace(/\/$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const COUNT = Number(process.env.COUNT || 12);
const COUNTRY = process.env.COUNTRY || 'VN';

if (!ANON_KEY) {
  console.error('Missing SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY).');
  process.exit(1);
}

// A strong password with no ambiguous characters, comfortably over the
// server's 8-char minimum.
function makePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(20);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `Th!${out}`; // guarantees an upper, a symbol and a digit class
}

async function getAdminToken() {
  if (process.env.ADMIN_ACCESS_TOKEN) return process.env.ADMIN_ACCESS_TOKEN;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.error('Provide ADMIN_ACCESS_TOKEN, or ADMIN_USERNAME + ADMIN_PASSWORD.');
    process.exit(1);
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ identifier: username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    console.error('Admin sign-in failed:', body.error || res.status);
    process.exit(1);
  }
  return body.access_token;
}

async function createTester(token, n) {
  const nn = String(n).padStart(2, '0');
  const username = `tester${nn}`;
  const password = makePassword();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      action: 'create',
      username,
      password,
      full_name: `Tester ${nn} (closed testing)`,
      account_type: 'tester',
      access_level: 'free',
      country: COUNTRY,
      onboarding_required: false,
      notes: 'Closed-testing tester (2026-09) — created by scripts/create-testers.mjs',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { username, ok: false, error: body.error || `http_${res.status}` };
  }
  return { username, ok: true, password, activationEmail: `${username}@thera.local`, userId: body.user_id };
}

const token = await getAdminToken();
const rows = [];
for (let n = 1; n <= COUNT; n++) {
  const r = await createTester(token, n);
  if (r.ok) {
    console.log(`✓ ${r.username}  (activation email: ${r.activationEmail})`);
    rows.push(r);
  } else if (r.error === 'username_already_registered') {
    console.log(`• ${r.username}  already exists — skipped (use reset_password if you need a new password)`);
  } else {
    console.error(`✗ ${r.username}  ${r.error}`);
  }
}

if (rows.length) {
  const csv =
    'app_username,app_password,activation_email,product,country\n' +
    rows.map((r) => `${r.username},${r.password},${r.activationEmail},neck-plus,${COUNTRY}`).join('\n') + '\n';
  const out = new URL('./testers-credentials.csv', import.meta.url).pathname;
  writeFileSync(out, csv, { mode: 0o600 });
  console.log(`\nWrote ${rows.length} credentials to ${out}`);
  console.log('Give each tester: (1) app login = username + password, (2) on the Activate screen enter the activation_email.');
}
