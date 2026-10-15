const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule, deferred, flush } = require('./call-test-helpers.cjs');
function fixture(response) {
  const cache = new Map(), effects = [], dismissed = new Set(); let active = null;
  const queryClient = {
    getQueryData: (key) => cache.get(key.join(':')),
    setQueryData: (key, data) => cache.set(key.join(':'), data),
    invalidateQueries: async () => {}, cancelQueries: async () => {},
  };
  const api = loadModule('src/hooks/useCalls.ts', {
    react: { useCallback: (fn) => fn, useRef: (value) => ({ current: value }), useEffect() {}, useState: (v) => [v, () => {}] },
    '@tanstack/react-query': {
      useQueryClient: () => queryClient, useQuery: (options) => options,
      useMutation: (options) => ({ mutateAsync: async (input) => {
        await options.onMutate?.(input);
        try { const data = await options.mutationFn(input); await options.onSuccess?.(data); return data; }
        catch (error) { await options.onError?.(error); throw error; }
      } }),
    },
    '@/lib/supabase': { supabase: { rpc: async () => ({ data: await response() }),
      functions: { invoke: async (name) => { effects.push(name); return {}; } } } },
    '@/hooks/useRealtimeSync': { useRealtimeSync() {} },
    '@/lib/callkeep': {
      dismissCall: (id) => { effects.push('dismiss'); dismissed.add(id); },
      isCallDismissed: (id) => dismissed.has(id), markCallActive: () => effects.push('active'),
    },
    '@/lib/callSession': {
      getCallSession: () => active,
      trackCallSession: (id) => { active = { callId: id }; },
      openCallSession: async () => effects.push('open'), closeCallSession: async () => effects.push('close'),
      endCallSession: () => effects.push('end-local'),
    },
  });
  return { api, cache, effects, dismissed };
}
const accepted = { id: 'a', room_name: 'a', caller_id: 'caller', callee_id: 'callee',
  media: 'audio', status: 'accepted', answered_by: 'callee', answered_at: new Date().toISOString() };
test('answer opens media without requiring the call screen to mount and cancels other rings', async () => {
  const { api, effects } = fixture(async () => accepted);
  await api.useAnswerCall().mutateAsync('a');
  assert.ok(effects.includes('open')); assert.ok(effects.includes('active'));
  assert.ok(effects.includes('dispatch-call-cancel')); assert.ok(effects.includes('dispatch-voip-push'));
});
test('late answer response cannot overwrite an already ended call', async () => {
  const pending = deferred(); const { api, cache, effects, dismissed } = fixture(() => pending.promise);
  const answering = api.useAnswerCall().mutateAsync('a'); await flush();
  dismissed.add('a'); cache.set('call:a', { status: 'ended' });
  pending.resolve(accepted); await answering;
  assert.equal(cache.get('call:a').status, 'ended'); assert.equal(effects.includes('open'), false);
});
test('timeout losing to answer leaves local media untouched', async () => {
  const { api, effects } = fixture(async () => accepted);
  await api.useEndCall().mutateAsync({ callId: 'a', status: 'missed', reason: 'timeout' });
  assert.equal(effects.includes('end-local'), false); assert.equal(effects.includes('dismiss'), false);
  assert.equal(effects.includes('close'), false);
});
test('explicit hangup stops local media before waiting for the server', async () => {
  const pending = deferred(); const { api, effects } = fixture(() => pending.promise);
  const ending = api.useEndCall().mutateAsync({ callId: 'a', status: 'ended', reason: 'hangup' });
  assert.ok(effects.includes('end-local')); assert.ok(effects.includes('dismiss'));
  pending.resolve({ ...accepted, status: 'ended' }); await ending;
  assert.ok(effects.includes('close'));
});
test('expired native answer dismisses its system screen and does not join', async () => {
  const { api, effects } = fixture(async () => ({ ...accepted, status: 'missed', answered_at: null }));
  await api.useAnswerCall().mutateAsync('a');
  assert.ok(effects.includes('dismiss')); assert.equal(effects.includes('open'), false);
});

test('late timeout response cannot replace an already completed hangup', async () => {
  const pending = deferred(); const { api, cache } = fixture(() => pending.promise);
  const timeout = api.useEndCall().mutateAsync({ callId: 'a', status: 'missed', reason: 'timeout' });
  await flush(); cache.set('call:a', { status: 'ended' }); pending.resolve(accepted); await timeout;
  assert.equal(cache.get('call:a').status, 'ended');
});
