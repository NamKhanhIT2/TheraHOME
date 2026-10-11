// The LiveKit side of a voice call: native setup, and the one place that
// opens and closes a room.
//
// Two things make this file more than a thin wrapper.
//
// 1. It loads the native module lazily. `@livekit/react-native` and its WebRTC
//    peer are native modules, so a dev client or TestFlight build made before
//    they were added does not contain them — and a top-level import would then
//    throw while the JS bundle is still evaluating, taking the whole app down
//    on launch for a feature the user may never open. Everything here goes
//    through `loadLiveKit()`, which requires the module on first use and
//    reports a missing one as a normal failure the call screen can explain.
//
// 2. It is where the "never idle in a room" rule is kept. LiveKit Cloud bills
//    every minute a participant is connected, free tier included, so a room is
//    entered only once the call is answered and left the moment it is over.
//    `connectCall` is deliberately the only exported way in, and it always
//    pairs with `disconnectCall`.
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

type LiveKitNative = typeof import('@livekit/react-native');
type LiveKitClient = typeof import('livekit-client');
export type LiveKitRoom = import('livekit-client').Room;

let native: LiveKitNative | null = null;
let client: LiveKitClient | null = null;
let globalsRegistered = false;

export class CallUnavailableError extends Error {
  constructor() {
    super('livekit_native_missing');
    this.name = 'CallUnavailableError';
  }
}

/** Requires the native modules and registers LiveKit's globals exactly once.
 * Throws `CallUnavailableError` on a build that does not contain them. */
function loadLiveKit(): { native: LiveKitNative; client: LiveKitClient } {
  if (!native || !client) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      native = require('@livekit/react-native') as LiveKitNative;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      client = require('livekit-client') as LiveKitClient;
    } catch {
      throw new CallUnavailableError();
    }
  }
  if (!globalsRegistered) {
    // Patches in the WebRTC globals livekit-client expects to find on the
    // platform. Must happen before the first `new Room()`.
    native.registerGlobals();
    globalsRegistered = true;
  }
  return { native, client };
}

/** True when this build can place a call at all — used to hide the call button
 * rather than let someone tap into an error. */
export function isCallSupported(): boolean {
  try {
    loadLiveKit();
    return true;
  } catch {
    return false;
  }
}

/**
 * Asks the Edge Function for a token and joins the call's room.
 *
 * The token is minted per call and only for a call already in 'accepted', so
 * this throws rather than connecting if it is asked too early — which is the
 * intended backstop for the billing rule above, enforced server-side so a
 * client bug cannot quietly start paying for a ringing phone.
 */
export interface ConnectedCall {
  room: LiveKitRoom;
  /** Whether the camera actually came up. False on a video call whose camera
   * could not be opened — the call still works, with no picture. */
  cameraOn: boolean;
}

export async function connectCall(callId: string, media: 'audio' | 'video' = 'audio'): Promise<ConnectedCall> {
  const { native: lk, client: lkClient } = loadLiveKit();

  const { data, error } = await supabase.functions.invoke<{ token: string; url: string }>('livekit-token', {
    body: { callId },
  });
  if (error) throw error;
  if (!data?.token || !data?.url) throw new Error('livekit_token_missing');

  // Audio routing. A voice call belongs at the ear; a video call is held at
  // arm's length and must start on the speaker, the way every other video
  // caller behaves. The communication preset keeps echo cancellation on in
  // both cases — speakerphone without it feeds the far end its own voice.
  const speakerFirst = media === 'video';
  await lk.AudioSession.configureAudio({
    android: {
      preferredOutputList: speakerFirst
        ? ['bluetooth', 'headset', 'speaker', 'earpiece']
        : ['bluetooth', 'headset', 'earpiece', 'speaker'],
      audioTypeOptions: lk.AndroidAudioTypePresets.communication,
    },
    ios: { defaultOutput: speakerFirst ? 'speaker' : 'earpiece' },
  });
  await lk.AudioSession.startAudioSession();

  const room = new lkClient.Room({
    // adaptiveStream drops the resolution of a track whose view is small or
    // hidden; dynacast stops publishing layers nobody is watching. Both cut
    // bandwidth, which is the free tier's OTHER limit (50GB downstream) and
    // the one video actually presses against. On for every call, not just
    // video ones, because a voice call can now raise its camera mid-
    // conversation and would otherwise publish at full rate.
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { resolution: lkClient.VideoPresets.h540.resolution },
  });

  let cameraOn = false;
  try {
    await room.connect(data.url, data.token, { autoSubscribe: true });
    await room.localParticipant.setMicrophoneEnabled(true);
  } catch (connectError) {
    // A half-open room and a live audio session would both leak — and the
    // audio session leaking is audible, because the OS keeps the call route
    // and other apps stay ducked.
    await disconnectCall(room);
    throw connectError;
  }

  // The camera gets its OWN try, deliberately outside the one above. It was
  // inside, which meant a camera that could not be opened — no camera at all,
  // permission refused, another app holding it — tore down the whole room and
  // failed the call. A video call on a device with no working camera should
  // degrade to a voice call, not die. Asked for after the mic so its
  // permission prompt never lands in front of the one that matters: a call
  // with a picture and no sound is useless.
  if (media === 'video') {
    try {
      await room.localParticipant.setCameraEnabled(true);
      cameraOn = true;
    } catch (cameraError) {
      if (__DEV__) console.warn('camera unavailable, continuing audio-only:', cameraError);
    }
  }
  return { room, cameraOn };
}

/** Leaves the room and releases the OS audio session. Safe to call twice, and
 * safe to call on a room that never finished connecting. */
export async function disconnectCall(room: LiveKitRoom | null): Promise<void> {
  try {
    await room?.disconnect();
  } catch {
    // Already gone. Releasing the audio session below still matters.
  }
  try {
    native?.AudioSession.stopAudioSession();
  } catch {
    // Nothing to release.
  }
}

// ------------------------------------------------------------- quality
//
// What the user gets told when the call sounds bad. Without it a weak
// network is indistinguishable from a broken app: the voice breaks up, the
// picture freezes, and nothing on screen admits that anything is wrong.
//
// LiveKit computes this per participant from its own packet loss and RTT.
// BOTH ends matter and the worse one wins, because "your connection is
// fine, theirs is not" is not a distinction the person holding the phone
// can act on differently — either way, wait or move.
export type CallQuality = 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';

const QUALITY_RANK: Record<CallQuality, number> = {
  excellent: 0, good: 1, unknown: 2, poor: 3, lost: 4,
};

function worstQuality(room: LiveKitRoom): CallQuality {
  let worst: CallQuality = (room.localParticipant.connectionQuality as CallQuality) ?? 'unknown';
  for (const participant of room.remoteParticipants.values()) {
    const quality = (participant.connectionQuality as CallQuality) ?? 'unknown';
    if (QUALITY_RANK[quality] > QUALITY_RANK[worst]) worst = quality;
  }
  return worst;
}

/** The current worse-of-the-two quality. */
export function readConnectionQuality(room: LiveKitRoom | null): CallQuality {
  if (!room) return 'unknown';
  try {
    return worstQuality(room);
  } catch {
    return 'unknown';
  }
}

/** Calls back whenever either end's quality changes. Returns an unsubscribe
 * that is safe to drop — the room is disconnected soon after anyway. */
export function subscribeConnectionQuality(
  room: LiveKitRoom,
  onChange: (quality: CallQuality) => void,
): () => void {
  const { client: lkClient } = loadLiveKit();
  const handler = () => onChange(worstQuality(room));
  room.on(lkClient.RoomEvent.ConnectionQualityChanged, handler);
  room.on(lkClient.RoomEvent.ParticipantConnected, handler);
  room.on(lkClient.RoomEvent.ParticipantDisconnected, handler);
  return () => {
    room.off(lkClient.RoomEvent.ConnectionQualityChanged, handler);
    room.off(lkClient.RoomEvent.ParticipantConnected, handler);
    room.off(lkClient.RoomEvent.ParticipantDisconnected, handler);
  };
}

/** Earpiece ↔ speaker, the one audio control a voice call needs. */
export async function setCallSpeaker(on: boolean): Promise<void> {
  const { native: lk } = loadLiveKit();
  // The device ids differ per platform: iOS exposes only "use the system
  // route" or "force the speaker", while on Android they are real device
  // types. Passing the wrong platform's name is silently ignored, so the
  // button would just stop working.
  const deviceId = Platform.OS === 'ios'
    ? (on ? 'force_speaker' : 'default')
    : (on ? 'speaker' : 'earpiece');
  await lk.AudioSession.selectAudioOutput(deviceId);
}

/** Camera on/off mid-call — the "turn my video off" button. */
export async function setCallCamera(room: LiveKitRoom | null, on: boolean): Promise<void> {
  if (!room) return;
  await room.localParticipant.setCameraEnabled(on);
}

/** Front/back camera. LiveKit exposes this on the published track's own
 * capture options rather than on the participant, so it has to be reached
 * through the publication. */
export async function switchCallCamera(room: LiveKitRoom | null): Promise<void> {
  const { client: lkClient } = loadLiveKit();
  if (!room) return;
  const publication = room.localParticipant.getTrackPublication(lkClient.Track.Source.Camera);
  const track = publication?.videoTrack;
  if (!track) return;
  const current = track.mediaStreamTrack.getSettings().facingMode;
  await track.restartTrack({ facingMode: current === 'environment' ? 'user' : 'environment' });
}
