const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule, deferred, flush, room } = require('./call-test-helpers.cjs');

function telecom(initial = []) {
  const handlers = {}, calls = { answer: [], ended: [], displayed: [], active: [] };
  const native = {
    setup: async () => {}, setAvailable() {}, hasPhoneAccount: async () => true,
    getInitialEvents: async () => initial, clearInitialEvents() {},
    answerIncomingCall: (id) => calls.answer.push(id),
    endCall: (id) => calls.ended.push(id),
    displayIncomingCall: (id) => calls.displayed.push(id),
    setCurrentCallActive: (id) => calls.active.push(id),
    addEventListener: (event, cb) => { handlers[event] = cb; }, removeEventListener() {},
  };
  const api = loadModule('src/lib/callkeep.ts', {
    'react-native': { NativeModules: { RNCallKeep: true }, Platform: { OS: 'ios' } },
    'react-native-callkeep': { default: native },
  });
  return { api, calls, handlers };
}
const id = 'aabbccdd-1234-4567-abcd-123456789012';
test('native UUID casing cannot lose answer state or echo suppression', () => {
  const { api, handlers } = telecom(); let ends = 0;
  api.listenToCallKeep({ onAnswer() {}, onEnd() { ends++; } });
  api.markCallActive(id.toUpperCase());
  assert.equal(api.wasAnsweredHere(id), true);
  api.dismissCall(id);
  handlers.endCall({ callUUID: id.toUpperCase() });
  assert.equal(ends, 0);
  assert.equal(api.wasAnsweredHere(id), false);
});
test('late incoming push cannot ring a locally dismissed call', async () => {
  const { api, calls } = telecom();
  api.dismissCall(id); await api.displayIncomingCall(id, 'Support', false);
  assert.equal(calls.displayed.length, 0);
  assert.equal(api.isSystemRinging(id), false);
});
test('cold-start answer followed by hangup replays only the final hangup', async () => {
  const { api } = telecom([
    { name: 'RNCallKeepDidDisplayIncomingCall', data: { callUUID: id } },
    { name: 'RNCallKeepPerformAnswerCallAction', data: { callUUID: id } },
    { name: 'RNCallKeepPerformEndCallAction', data: { callUUID: id.toUpperCase() } },
  ]);
  let answers = 0, ends = 0;
  await api.drainInitialCallKeepEvents({ onAnswer: () => answers++, onEnd: () => ends++ });
  assert.equal(answers, 0); assert.equal(ends, 1);
  assert.equal(api.isSystemRinging(id), false);
});
test('failed native display leaves the in-app answer UI available', async () => {
  const { api } = telecom([{ name: 'RNCallKeepDidDisplayIncomingCall', data: { callUUID: id, error: 'failed' } }]);
  await api.drainInitialCallKeepEvents({ onAnswer() {}, onEnd() {} });
  assert.equal(api.isSystemRinging(id), false);
});
test('answering in app answers CallKit, not its Android-only active API', async () => {
  const { api, calls } = telecom();
  await api.displayIncomingCall(id, 'Support', true);
  api.markCallActive(id);
  assert.equal(calls.answer.length, 1);
  assert.equal(calls.active.length, 0);
});
test('native answer does not echo another answer back to CallKit', async () => {
  const { api, calls, handlers } = telecom();
  api.listenToCallKeep({ onAnswer: (callId) => api.markCallActive(callId), onEnd() {} });
  await api.displayIncomingCall(id, 'Support', false);
  handlers.answerCall({ callUUID: id.toUpperCase() });
  handlers.answerCall({ callUUID: id });
  assert.equal(calls.answer.length, 0);
  assert.equal(api.wasAnsweredHere(id), true);
});

function mediaFixture(options = {}) {
  const events = [], rooms = [];
  const audio = {
    configureAudio: async (config) => events.push(['configure', config]),
    startAudioSession: async () => events.push(['start']),
    stopAudioSession: async () => events.push(['stop']),
    selectAudioOutput: async (output) => events.push(['output', output]),
  };
  const native = { registerGlobals() {}, AudioSession: audio, AndroidAudioTypePresets: { communication: {} } };
  class Room {
    constructor() {
      Object.assign(this, room()); rooms.push(this);
      this.connect = async () => events.push(['connect']);
      this.disconnect = async () => events.push(['disconnect']);
      this.localParticipant = {
        setMicrophoneEnabled: options.mic ?? (async () => events.push(['mic'])),
        setCameraEnabled: options.camera ?? (async () => { this.localParticipant.isCameraEnabled = true; }),
        isCameraEnabled: false,
      };
    }
  }
  const api = loadModule('src/lib/livekit.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    '@/lib/supabase': { supabase: { functions: { invoke: options.token ?? (async () => ({ data: { url: 'wss://test', token: 'test' } })) } } },
    '@livekit/react-native': native,
    'livekit-client': { Room, VideoPresets: { h720: { resolution: {}, encoding: {} } } },
  });
  return { api, events, rooms };
}
test('cancelled token fetch never opens microphone or starts audio', async () => {
  const token = deferred(), controller = new AbortController();
  const { api, events } = mediaFixture({ token: () => token.promise });
  const pending = api.connectCall('a', 'video', controller.signal);
  controller.abort(); token.resolve({ data: { url: 'test', token: 'test' } });
  await assert.rejects(pending, /call_cancelled/);
  assert.equal(events.length, 0);
});
test('late room cleanup cannot stop audio owned by the next room', async () => {
  const { api, events } = mediaFixture();
  const first = await api.connectCall('a');
  const second = await api.connectCall('b');
  await api.disconnectCall(first.room);
  assert.equal(events.filter(([event]) => event === 'stop').length, 0);
  await api.disconnectCall(second.room);
  assert.equal(events.filter(([event]) => event === 'stop').length, 1);
});
test('camera permission failure preserves a working voice connection', async () => {
  const { api } = mediaFixture({ camera: async () => { throw new Error('denied'); } });
  const result = await api.connectCall('a', 'video');
  assert.equal(result.cameraOn, false);
  assert.ok(result.room);
});
test('microphone failure releases the room and audio session', async () => {
  const { api, events } = mediaFixture({ mic: async () => { throw new Error('denied'); } });
  await assert.rejects(api.connectCall('a'), /denied/);
  assert.ok(events.some(([event]) => event === 'disconnect'));
  assert.ok(events.some(([event]) => event === 'stop'));
});
test('turning speaker off in a video call restores the iOS earpiece default', async () => {
  const { api, events } = mediaFixture();
  await api.connectCall('a', 'video'); await api.setCallSpeaker(false);
  assert.equal(events.filter(([event]) => event === 'configure').at(-1)[1].ios.defaultOutput, 'earpiece');
  assert.equal(events.at(-1)[1], 'default');
});
test('ringtone cleanup never reconfigures a live call audio session', async () => {
  const { api } = mediaFixture(); let resets = 0;
  const active = await api.connectCall('a');
  await api.configureRingtoneAudio(async () => { resets++; });
  assert.equal(resets, 0);
  await api.disconnectCall(active.room);
  await api.configureRingtoneAudio(async () => { resets++; });
  assert.equal(resets, 1);
});
test('cancellation during mic permission setup releases late media', async () => {
  const mic = deferred(), controller = new AbortController();
  const { api, events } = mediaFixture({ mic: () => mic.promise });
  const pending = api.connectCall('a', 'audio', controller.signal);
  await flush(); controller.abort(); mic.resolve();
  await assert.rejects(pending, /call_cancelled/);
  assert.ok(events.some(([event]) => event === 'stop'));
});

test('muting video removes both tracks from the stage until unmuted', () => {
  let state = {}, subscribed = false;
  const local = { videoTrack: {}, isMuted: false }, remote = { videoTrack: {}, isMuted: false };
  const active = room();
  active.localParticipant.getTrackPublication = () => local;
  active.remoteParticipants.set('peer', { getTrackPublication: () => remote });
  const api = loadModule('src/components/call/CallVideo.tsx', {
    react: { useState: () => [state, (next) => { state = next; }],
      useEffect: (effect) => { if (!subscribed) { subscribed = true; effect(); } } },
    'react/jsx-runtime': {},
    'react-native': { NativeModules: { LivekitReactNativeModule: true }, StyleSheet: { create: (v) => v } },
    '@livekit/react-native': {},
    'livekit-client': { Track: { Source: { Camera: 'camera' } },
      RoomEvent: Object.fromEntries(['TrackSubscribed', 'TrackUnsubscribed', 'LocalTrackPublished', 'LocalTrackUnpublished',
        'TrackMuted', 'TrackUnmuted', 'ParticipantConnected', 'ParticipantDisconnected'].map((name) => [name, name])) },
  });
  api.useCallVideoTracks(active, true);
  assert.ok(api.useCallVideoTracks(active, true).remote);
  local.isMuted = true; remote.isMuted = true; active.emit('TrackMuted');
  assert.equal(api.useCallVideoTracks(active, true).local, undefined);
  assert.equal(api.useCallVideoTracks(active, true).remote, undefined);
  remote.isMuted = false; active.emit('TrackUnmuted');
  assert.ok(api.useCallVideoTracks(active, true).remote);
});

test('late native display is dismissed even when PushKit already raised the UI', () => {
  const { api, calls, handlers } = telecom();
  api.listenToCallKeep({ onAnswer() {}, onEnd() {} });
  api.dismissCall(id);
  handlers.didDisplayIncomingCall({ callUUID: id.toUpperCase() });
  assert.equal(calls.ended.length, 2);
  assert.equal(api.isSystemRinging(id), false);
});
