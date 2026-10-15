const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule, deferred, flush, room, timers } = require('./call-test-helpers.cjs');

function fixture(overrides = {}) {
  const clock = timers();
  const connected = room();
  const calls = { connect: 0, disconnect: [], mic: 0, camera: 0, flip: 0 };
  class CallUnavailableError extends Error {}
  const media = {
    CallUnavailableError,
    connectCall: async () => { calls.connect++; return { room: connected, cameraOn: false }; },
    disconnectCall: async (value) => { if (value) calls.disconnect.push(value); },
    readConnectionQuality: () => 'good', subscribeConnectionQuality: () => () => {},
    setCallMicrophone: async (_, on) => { calls.mic++; return on; },
    setCallCamera: async (_, on) => { calls.camera++; return on; },
    switchCallCamera: async () => { calls.flip++; }, setCallSpeaker: async () => {},
    ...overrides,
  };
  const api = loadModule('src/lib/callSession.ts', {
    react: { useSyncExternalStore: (_, get) => get() }, '@/lib/livekit': media,
  }, clock);
  return { api, calls, connected, clock, media };
}

test('ringing survives navigation and repeated open events establish one room', async () => {
  const { api, calls } = fixture();
  api.trackCallSession('a', 'audio');
  assert.equal(api.getCallSession().state, 'ringing');
  assert.equal(calls.connect, 0);
  await Promise.all([api.openCallSession('a', 'audio'), api.openCallSession('a', 'audio')]);
  assert.equal(calls.connect, 1);
  assert.equal(api.getCallSession().state, 'live');
  await api.openCallSession('a', 'audio');
  assert.equal(calls.connect, 1);
});
test('another call cannot replace the current conversation', async () => {
  const { api, calls } = fixture();
  await api.openCallSession('a', 'audio');
  await api.openCallSession('b', 'video');
  assert.equal(api.getCallSession().callId, 'a');
  assert.equal(calls.connect, 1);
});
test('hangup during token/media setup cannot resurrect a room', async () => {
  const token = deferred(), lateRoom = room();
  const { api, calls } = fixture({ connectCall: () => token.promise });
  const pending = api.openCallSession('a', 'video');
  api.endCallSession('a');
  token.resolve({ room: lateRoom, cameraOn: true });
  await pending;
  assert.equal(api.getCallSession().state, 'ending');
  assert.equal(api.getCallSession().room, null);
  assert.ok(calls.disconnect.includes(lateRoom));
});
test('late setup of an old call does not overwrite a new call', async () => {
  const first = deferred(), nextRoom = room(), oldRoom = room();
  const { api } = fixture({ connectCall: (id) => id === 'a' ? first.promise : Promise.resolve({ room: nextRoom, cameraOn: false }) });
  const pending = api.openCallSession('a', 'audio');
  await api.closeCallSession('a');
  await api.openCallSession('b', 'audio');
  first.resolve({ room: oldRoom, cameraOn: true });
  await pending;
  assert.equal(api.getCallSession().room, nextRoom);
  await api.closeCallSession('a');
  assert.equal(api.getCallSession().callId, 'b');
});
test('connection setup has a deadline and keeps a visible failure', async () => {
  const token = deferred();
  const { api, clock } = fixture({ connectCall: () => token.promise });
  const pending = api.openCallSession('a', 'audio');
  clock.fire();
  assert.equal(api.getCallSession().state, 'failed');
  assert.equal(api.getCallSession().failureReason, 'connection_timeout');
  token.resolve({ room: room(), cameraOn: false });
  await pending;
  assert.equal(api.getCallSession().state, 'failed');
});
test('brief peer disconnect recovers without ending the conversation', async () => {
  const { api, connected, clock } = fixture();
  await api.openCallSession('a', 'audio');
  connected.remoteParticipants.clear(); connected.emit('participantDisconnected');
  assert.equal(api.getCallSession().state, 'reconnecting');
  assert.equal(clock.pending.size, 1);
  connected.remoteParticipants.set('peer', {}); connected.emit('participantConnected');
  assert.equal(api.getCallSession().state, 'live');
  assert.equal(clock.pending.size, 0);
});
test('a peer who never joins releases media after the deadline', async () => {
  const alone = room(false);
  const { api, clock, calls } = fixture({ connectCall: async () => ({ room: alone, cameraOn: false }) });
  await api.openCallSession('a', 'audio');
  clock.fire();
  assert.equal(api.getCallSession().failureReason, 'peer_timeout');
  assert.ok(calls.disconnect.includes(alone));
});
test('terminal disconnect remains observable instead of becoming idle', async () => {
  const { api, connected } = fixture();
  await api.openCallSession('a', 'audio');
  connected.emit('disconnected');
  assert.equal(api.getCallSession().state, 'failed');
  assert.equal(api.getCallSession().room, null);
  assert.equal(connected.listenerCount('disconnected'), 0);
});
test('signal reconnects are visible and bounded', async () => {
  const { api, connected, clock } = fixture();
  await api.openCallSession('a', 'audio');
  connected.emit('signalReconnecting');
  assert.equal(api.getCallSession().state, 'reconnecting');
  clock.fire();
  assert.equal(api.getCallSession().state, 'failed');
});
test('missing native support produces an actionable terminal state', async () => {
  const f = fixture();
  f.media.connectCall = async () => { throw new f.media.CallUnavailableError(); };
  await f.api.openCallSession('a', 'audio');
  assert.equal(f.api.getCallSession().state, 'unsupported');
});
test('rapid microphone taps serialize native writes and reflect actual state', async () => {
  const mute = deferred(); let writes = 0;
  const { api } = fixture({ setCallMicrophone: () => { writes++; return mute.promise; } });
  await api.openCallSession('a', 'audio');
  api.toggleSessionMic(); api.toggleSessionMic();
  assert.equal(writes, 1);
  assert.equal(api.getCallSession().micPending, true);
  mute.resolve(false); await flush();
  assert.equal(api.getCallSession().micOn, false);
  assert.equal(api.getCallSession().micPending, false);
});
test('native camera errors are surfaced without lying about camera state', async () => {
  const { api } = fixture({ setCallCamera: async () => { throw new Error('permission denied'); } });
  await api.openCallSession('a', 'audio');
  api.toggleSessionCamera(); await flush();
  assert.equal(api.getCallSession().cameraOn, false);
  assert.match(api.getCallSession().controlError, /camera/);
  assert.equal(api.getCallSession().cameraPending, false);
});
test('camera flip and on/off cannot run concurrently', async () => {
  const flip = deferred(); let switches = 0, toggles = 0;
  const { api } = fixture({ connectCall: async () => ({ room: room(), cameraOn: true }),
    switchCallCamera: () => { switches++; return flip.promise; },
    setCallCamera: async () => { toggles++; return false; } });
  await api.openCallSession('a', 'video');
  api.flipSessionCamera(); api.toggleSessionCamera(); api.flipSessionCamera();
  assert.equal(switches, 1); assert.equal(toggles, 0);
  flip.resolve(); await flush();
  assert.equal(api.getCallSession().facing, 'environment');
  assert.equal(api.getCallSession().cameraPending, false);
});
test('late mute completion cannot mutate the next call', async () => {
  const mute = deferred();
  const { api } = fixture({ setCallMicrophone: () => mute.promise });
  await api.openCallSession('a', 'audio'); api.toggleSessionMic();
  await api.closeCallSession('a'); await api.openCallSession('b', 'audio');
  mute.resolve(false); await flush();
  assert.equal(api.getCallSession().micOn, true);
});
