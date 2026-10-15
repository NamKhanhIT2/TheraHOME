/* global __dirname */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const caller = '11111111-1111-4111-8111-111111111111';
const callee = '22222222-2222-4222-8222-222222222222';
const stranger = '33333333-3333-4333-8333-333333333333';
let callId;
async function asUser(id, staff = false) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('test.roles', $2, false)", [id ?? '', staff ? '{cskh}' : '{}']);
}
async function rpc(name, args) {
  return (await db.query(`select * from public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')})`, args)).rows[0];
}
async function traceCount() { return (await db.query('select count(*)::integer as count from traces')).rows[0].count; }
before(async () => {
  // Stub only dependencies; execute the actual migration on PostgreSQL.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema cron;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function public.current_web_roles() returns text[] language sql stable as
      $$ select coalesce(nullif(current_setting('test.roles', true), ''), '{}')::text[] $$;
    create table calls (
      id uuid primary key default gen_random_uuid(), room_name text default 'test', caller_id uuid not null,
      callee_id uuid, answered_by uuid, thread_id uuid, media text default 'audio', holds_line boolean default false,
      status text default 'ringing' check (status in ('ringing','accepted','declined','missed','busy','ended')),
      end_reason text, created_at timestamptz default now(), answered_at timestamptz, ended_at timestamptz, duration_seconds integer
    );
    create table traces (call_id uuid, status text);
    create function public.log_call_to_thread(p_call public.calls) returns void language sql as
      $$ insert into traces values (p_call.id, p_call.status) $$;
    create table cron.jobs (name text, schedule text, command text);
    create function cron.schedule(text, text, text) returns bigint language sql as
      $$ insert into cron.jobs values ($1, $2, $3); select 1::bigint $$;
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/202610142100_call_transitions_are_serialized.sql'), 'utf8'));
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec('truncate calls, traces'); await asUser(caller);
  callId = (await db.query('insert into calls (caller_id, callee_id) values ($1, $2) returning id', [caller, callee])).rows[0].id;
});
test('duplicate answers preserve answered_at', async () => {
  await asUser(callee);
  const first = await rpc('answer_call', [callId]);
  const second = await rpc('answer_call', [callId]);
  assert.equal(first.status, 'accepted'); assert.equal(first.answered_at.getTime(), second.answered_at.getTime());
});
test('stale ring timeout cannot end an answered call', async () => {
  await asUser(callee); await rpc('answer_call', [callId]); await asUser(caller);
  assert.equal((await rpc('end_call', [callId, 'missed', 'timeout'])).status, 'accepted');
  assert.equal(await traceCount(), 0);
});
test('late answer cannot reopen a cancelled call', async () => {
  await rpc('end_call', [callId, 'ended', 'hangup']); await asUser(callee);
  await assert.rejects(rpc('answer_call', [callId]), /call_not_ringing/);
  assert.equal(await traceCount(), 1);
});
test('duplicate hangups write one chat trace', async () => {
  await asUser(callee); await rpc('answer_call', [callId]);
  const first = await rpc('end_call', [callId, 'ended', 'hangup']); await asUser(caller);
  const second = await rpc('end_call', [callId, 'ended', 'hangup']);
  assert.equal(first.ended_at.getTime(), second.ended_at.getTime()); assert.equal(await traceCount(), 1);
});
test('native decline after answer records a completed call', async () => {
  await asUser(callee); await rpc('answer_call', [callId]);
  const result = await rpc('end_call', [callId, 'declined', 'declined']);
  assert.equal(result.status, 'ended'); assert.equal(result.end_reason, 'hangup');
});
test('expired lock-screen answer returns missed without connecting', async () => {
  await db.query("update calls set created_at = now() - interval '46 seconds' where id = $1", [callId]);
  await asUser(callee);
  const result = await rpc('answer_call', [callId]);
  assert.equal(result.status, 'missed'); assert.equal(result.answered_at, null); assert.equal(await traceCount(), 1);
});
test('caller cancellation is missed for the recipient', async () => {
  const result = await rpc('end_call', [callId, 'ended', 'hangup']);
  assert.equal(result.status, 'missed'); assert.equal(result.end_reason, 'cancelled');
});
test('nullable participant columns do not authorize a stranger', async () => {
  await asUser(stranger);
  await assert.rejects(rpc('end_call', [callId, 'ended', 'hangup']), /not_a_participant/);
  await db.query('update calls set callee_id = null where id = $1', [callId]);
  await assert.rejects(rpc('answer_call', [callId]), /not_the_callee/);
  await assert.rejects(rpc('end_call', [callId, 'ended', 'hangup']), /not_a_participant/);
});
test('staff can answer the support line but not their own call', async () => {
  await db.query('update calls set callee_id = null where id = $1', [callId]);
  await asUser(caller, true); await assert.rejects(rpc('answer_call', [callId]), /not_the_callee/);
  await asUser(callee, true); assert.equal((await rpc('answer_call', [callId])).status, 'accepted');
});
test('other staff cannot end an answered support call', async () => {
  await db.query('update calls set callee_id = null where id = $1', [callId]);
  await asUser(callee, true); await rpc('answer_call', [callId]); await asUser(stranger, true);
  await assert.rejects(rpc('end_call', [callId, 'declined', 'declined']), /not_a_participant/);
});
test('unauthenticated actions are rejected', async () => {
  await asUser(null);
  await assert.rejects(rpc('answer_call', [callId]), /auth_required/);
  await assert.rejects(rpc('end_call', [callId, 'ended', 'hangup']), /auth_required/);
});
test('janitor expires old rings once and is scheduled', async () => {
  await db.query("update calls set created_at = now() - interval '46 seconds' where id = $1", [callId]);
  await db.query('select expire_stale_calls()'); await db.query('select expire_stale_calls()');
  assert.equal((await db.query('select status from calls where id = $1', [callId])).rows[0].status, 'missed');
  assert.equal(await traceCount(), 1);
  assert.equal((await db.query('select count(*)::integer as count from cron.jobs')).rows[0].count, 1);
});
test('function grants keep janitor private and call RPCs authenticated', async () => {
  const result = (await db.query(`select
    has_function_privilege('authenticated', 'public.expire_stale_calls()', 'execute') as janitor,
    has_function_privilege('authenticated', 'public.answer_call(uuid)', 'execute') as answer,
    has_function_privilege('anon', 'public.end_call(uuid,text,text)', 'execute') as anonymous_end`)).rows[0];
  assert.equal(result.janitor, false); assert.equal(result.answer, true); assert.equal(result.anonymous_end, false);
});
