// The live call, as app-wide state rather than screen state.
//
// WHY THIS EXISTS. The room used to live in `app/call/[callId].tsx` and was
// disconnected on unmount — a deliberate, billing-driven choice: LiveKit
// charges for every connected minute, and tying the room's life to the
// screen's made it impossible to leave one running by accident.
//
// It also made it impossible to leave the screen. Every other caller lets
// you minimise a call and go read a message; here, navigating away hung up.
// So the room moves out here, and the rule it was protecting is restated
// rather than dropped:
//
//   a room is open only while a call row is 'accepted', and the moment that
//   stops being true — ended, declined, missed, the far end vanishing, the
//   socket giving up — the room closes.
//
// That is now enforced in three independent places, because losing it costs
// real money: this module closes on the room's own 'disconnected' and on the
// far end leaving; `useCallTerminator` closes after any end_call; and
// <OngoingCallBar>, which is mounted for the whole session, watches the row
// over Realtime and closes on any terminal status. Screen unmount is no
// longer one of them, and must not become one again.
//
// Everything the UI needs is here, so the call screen and the minimised bar
// are two views of one state rather than two copies of it.
import { useSyncExternalStore } from 'react';
import {
  connectCall,
  disconnectCall,
  readConnectionQuality,
  setCallCamera,
  setCallSpeaker,
  subscribeConnectionQuality,
  switchCallCamera,
  CallUnavailableError,
  type CallQuality,
  type LiveKitRoom,
} from '@/lib/livekit';

export type CallMediaState = 'connecting' | 'live' | 'reconnecting' | 'failed' | 'unsupported';

export interface CallSession {
  callId: string;
  /** How the call was PLACED. The camera may be raised later on an audio one. */
  media: 'audio' | 'video';
  room: LiveKitRoom | null;
  state: CallMediaState;
  remoteJoined: boolean;
  micOn: boolean;
  cameraOn: boolean;
  speakerOn: boolean;
  quality: CallQuality;
}

let session: CallSession | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function patch(callId: string, changes: Partial<CallSession>): void {
  // Keyed by call id on every write: an event from a room that has already
  // been replaced by the next call must not resurrect it.
  if (!session || session.callId !== callId) return;
  session = { ...session, ...changes };
  emit();
}

export function getCallSession(): CallSession | null {
  return session;
}

export function subscribeCallSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The live call, or null. Re-renders on every change to it. */
export function useCallSession(): CallSession | null {
  return useSyncExternalStore(subscribeCallSession, getCallSession, getCallSession);
}

/**
 * Joins the room for a call, once.
 *
 * Safe to call repeatedly — the call screen's effect runs again on every
 * remount, which is exactly what happens when a minimised call is reopened,
 * and joining twice under one identity makes LiveKit evict the first
 * participant (the user sees the call drop instantly).
 */
export async function openCallSession(callId: string, media: 'audio' | 'video'): Promise<void> {
  if (session?.callId === callId) return;
  // A different call while one is open should not happen — the database
  // allows one live line — but if it does, the old room is released rather
  // than left connected and billing.
  if (session) await closeCallSession();

  session = {
    callId,
    media,
    room: null,
    state: 'connecting',
    remoteJoined: false,
    micOn: true,
    cameraOn: false,
    // A video call is held at arm's length, so it opens on the speaker.
    speakerOn: media === 'video',
    quality: 'unknown',
  };
  emit();

  try {
    const { room, cameraOn } = await connectCall(callId, media);
    // Cancelled while the token round trip was in flight.
    if (session?.callId !== callId) {
      await disconnectCall(room);
      return;
    }
    patch(callId, {
      room,
      state: 'live',
      // Whether the camera ACTUALLY came up, not what was asked for: on a
      // device whose camera failed the call carries on as audio and the
      // button correctly reads "Bật camera".
      cameraOn,
      remoteJoined: room.remoteParticipants.size > 0,
    });

    room.on('participantConnected', () => patch(callId, { remoteJoined: true }));
    room.on('participantDisconnected', () => {
      // The far end is gone for good — a hangup whose write has not arrived,
      // or a client that died. Releasing the room here means the line is not
      // held open (and billed) waiting for an `end_call` that never comes.
      patch(callId, { remoteJoined: false });
      void closeCallSession(callId);
    });
    // LiveKit reconnects on its own when the network blips; what was missing
    // was any sign of it, so the picture simply froze. 'disconnected' is the
    // final give-up, not a blip.
    room.on('reconnecting', () => patch(callId, { state: 'reconnecting' }));
    room.on('reconnected', () => patch(callId, { state: 'live' }));
    room.on('disconnected', () => {
      patch(callId, { state: 'failed' });
      void closeCallSession(callId);
    });
    subscribeConnectionQuality(room, (quality) => patch(callId, { quality }));
    patch(callId, { quality: readConnectionQuality(room) });
  } catch (error) {
    patch(callId, {
      state: error instanceof CallUnavailableError ? 'unsupported' : 'failed',
    });
    if (__DEV__) console.warn('openCallSession failed:', error);
  }
}

/**
 * Leaves the room and releases the OS audio session.
 *
 * `callId` guards against closing a NEWER call: a late event from a room
 * that has already been replaced must not hang up its successor. Omit it
 * only when the intent really is "whatever is open, close it".
 */
export async function closeCallSession(callId?: string): Promise<void> {
  const open = session;
  if (!open) return;
  if (callId && open.callId !== callId) return;
  session = null;
  emit();
  await disconnectCall(open.room);
}

export function isCallSessionOpen(callId: string): boolean {
  return session?.callId === callId;
}

// --------------------------------------------------------------- controls
// Optimistic: the toggle moves immediately and is put back if the native
// call fails, because a control that waits for a round trip before showing
// anything reads as broken.

export function toggleSessionMic(): void {
  const open = session;
  if (!open?.room) return;
  const next = !open.micOn;
  patch(open.callId, { micOn: next });
  void open.room.localParticipant.setMicrophoneEnabled(next)
    .catch(() => patch(open.callId, { micOn: !next }));
}

export function toggleSessionCamera(): void {
  const open = session;
  if (!open) return;
  const next = !open.cameraOn;
  patch(open.callId, { cameraOn: next });
  void setCallCamera(open.room, next)
    .catch(() => patch(open.callId, { cameraOn: !next }));
}

export function toggleSessionSpeaker(): void {
  const open = session;
  if (!open) return;
  const next = !open.speakerOn;
  patch(open.callId, { speakerOn: next });
  void setCallSpeaker(next)
    .catch(() => patch(open.callId, { speakerOn: !next }));
}

export function flipSessionCamera(): void {
  void switchCallCamera(session?.room ?? null).catch(() => undefined);
}
