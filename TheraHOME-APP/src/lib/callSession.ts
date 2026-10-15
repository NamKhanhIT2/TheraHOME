// One call lifecycle shared by the call screen, the minimised bar and CallKit.
import { useSyncExternalStore } from 'react';
import {
  connectCall,
  disconnectCall,
  readConnectionQuality,
  setCallCamera,
  setCallMicrophone,
  setCallSpeaker,
  subscribeConnectionQuality,
  switchCallCamera,
  CallUnavailableError,
  type CallQuality,
  type LiveKitRoom,
} from '@/lib/livekit';

export type CallMediaState = 'ringing' | 'connecting' | 'live' | 'reconnecting' | 'ending' | 'failed' | 'unsupported';

export interface CallSession {
  callId: string;
  media: 'audio' | 'video';
  room: LiveKitRoom | null;
  state: CallMediaState;
  remoteJoined: boolean;
  micOn: boolean;
  cameraOn: boolean;
  facing: 'user' | 'environment';
  cameraEpoch: number;
  speakerOn: boolean;
  quality: CallQuality;
  micPending: boolean;
  cameraPending: boolean;
  speakerPending: boolean;
  controlError: string | null;
  failureReason: string | null;
}

export const CONNECTION_TIMEOUT_MS = 30_000;
let session: CallSession | null = null;
let generation = 0;
let connection: AbortController | null = null;
let deadline: ReturnType<typeof setTimeout> | undefined;
let unsubscribeRoom: (() => void) | undefined;
const listeners = new Set<() => void>();

function emit(): void { for (const listener of listeners) listener(); }
function patch(callId: string, changes: Partial<CallSession>): void {
  if (session?.callId !== callId) return;
  session = { ...session, ...changes };
  emit();
}
export function getCallSession(): CallSession | null { return session; }
export function subscribeCallSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useCallSession(): CallSession | null {
  return useSyncExternalStore(subscribeCallSession, getCallSession, getCallSession);
}

/** Ringing is tracked too: navigation never owns the ring timeout. */
export function trackCallSession(callId: string, media: 'audio' | 'video'): void {
  if (session) return;
  generation += 1;
  session = {
    callId, media, room: null, state: 'ringing', remoteJoined: false,
    micOn: true, cameraOn: false, facing: 'user', cameraEpoch: 0,
    speakerOn: media === 'video', quality: 'unknown',
    micPending: false, cameraPending: false, speakerPending: false,
    controlError: null, failureReason: null,
  };
  emit();
}

function clearDeadline(): void { clearTimeout(deadline); deadline = undefined; }
function releaseMedia(): Promise<void> {
  clearDeadline();
  unsubscribeRoom?.();
  unsubscribeRoom = undefined;
  connection?.abort();
  connection = null;
  const room = session?.room ?? null;
  if (session) session = { ...session, room: null, cameraOn: false };
  return disconnectCall(room);
}
function fail(callId: string, reason: string, unsupported = false): void {
  if (session?.callId !== callId || session.state === 'ending') return;
  void releaseMedia();
  // Keep the failure observable until the app-wide owner ends the server row.
  patch(callId, { state: unsupported ? 'unsupported' : 'failed', failureReason: reason });
}
function armDeadline(callId: string, reason: string): void {
  clearDeadline();
  deadline = setTimeout(() => fail(callId, reason), CONNECTION_TIMEOUT_MS);
}

/** Joins only after answer_call; repeated screen/native events share one join. */
export async function openCallSession(callId: string, media: 'audio' | 'video'): Promise<void> {
  trackCallSession(callId, media);
  if (session?.callId !== callId || session.state !== 'ringing') return;
  const ownGeneration = generation;
  const controller = new AbortController();
  connection = controller;
  patch(callId, { state: 'connecting' });
  armDeadline(callId, 'connection_timeout');
  try {
    const { room, cameraOn } = await connectCall(callId, media, controller.signal);
    if (controller.signal.aborted || generation !== ownGeneration || session?.callId !== callId) {
      await disconnectCall(room);
      return;
    }
    if (room.state === 'disconnected') {
      await disconnectCall(room);
      fail(callId, 'connection_failed');
      return;
    }
    clearDeadline();
    patch(callId, { room, state: 'live', cameraOn, cameraEpoch: 1,
      remoteJoined: room.remoteParticipants.size > 0 });

    const joined = () => {
      clearDeadline();
      patch(callId, { remoteJoined: true, state: 'live' });
    };
    const left = () => {
      if (room.remoteParticipants.size > 0) return;
      patch(callId, { remoteJoined: false, state: 'reconnecting' });
      // A full LiveKit reconnect can temporarily remove the other participant.
      // A real hangup arrives through the call row; otherwise allow recovery.
      armDeadline(callId, 'peer_timeout');
    };
    const reconnecting = () => {
      patch(callId, { state: 'reconnecting' });
      armDeadline(callId, 'connection_timeout');
    };
    const reconnected = () => {
      patch(callId, { state: 'live', remoteJoined: room.remoteParticipants.size > 0 });
      if (room.remoteParticipants.size) clearDeadline();
      else armDeadline(callId, 'peer_timeout');
    };
    const disconnected = () => fail(callId, 'connection_failed');
    room.on('participantConnected', joined);
    room.on('participantDisconnected', left);
    room.on('reconnecting', reconnecting);
    room.on('signalReconnecting', reconnecting);
    room.on('reconnected', reconnected);
    room.on('disconnected', disconnected);
    const stopQuality = subscribeConnectionQuality(room, (quality) => patch(callId, { quality }));
    unsubscribeRoom = () => {
      stopQuality();
      room.off('participantConnected', joined);
      room.off('participantDisconnected', left);
      room.off('reconnecting', reconnecting);
      room.off('signalReconnecting', reconnecting);
      room.off('reconnected', reconnected);
      room.off('disconnected', disconnected);
    };
    patch(callId, { quality: readConnectionQuality(room) });
    if (!room.remoteParticipants.size) armDeadline(callId, 'peer_timeout');
  } catch (error) {
    if (controller.signal.aborted || generation !== ownGeneration) return;
    fail(callId, error instanceof CallUnavailableError ? 'unsupported' : 'connection_failed',
      error instanceof CallUnavailableError);
    if (__DEV__) console.warn('openCallSession failed:', error);
  }
}

/** Stop media immediately, retaining a visible local hangup while RPC retries. */
export function endCallSession(callId: string): void {
  if (session?.callId !== callId || session.state === 'ending') return;
  void releaseMedia();
  patch(callId, { state: 'ending' });
}
export async function closeCallSession(callId?: string): Promise<void> {
  if (!session || (callId && session.callId !== callId)) return;
  const released = releaseMedia();
  session = null;
  generation += 1;
  emit();
  await released;
}
export function isCallSessionOpen(callId: string): boolean { return session?.callId === callId; }

// Serialize each native control. Rapid taps must not let an older result undo
// a newer choice; camera switching shares the camera lock with on/off.
async function control(
  pending: 'micPending' | 'cameraPending' | 'speakerPending',
  action: (open: CallSession) => Promise<Partial<CallSession>>,
  message: string,
): Promise<void> {
  const open = session;
  if (!open?.room || open[pending] || !['live', 'reconnecting'].includes(open.state)) return;
  const ownGeneration = generation;
  patch(open.callId, { [pending]: true, controlError: null });
  try {
    const changes = await action(open);
    if (generation === ownGeneration && session?.room === open.room) patch(open.callId, changes);
  } catch (error) {
    if (generation === ownGeneration && session?.room === open.room) patch(open.callId, { controlError: message });
    console.warn(message, error);
  } finally {
    if (generation === ownGeneration) patch(open.callId, { [pending]: false });
  }
}
export function toggleSessionMic(): void {
  void control('micPending', async (open) => ({ micOn: await setCallMicrophone(open.room, !open.micOn) }),
    'Không thể đổi trạng thái micro. Vui lòng thử lại.');
}
export function toggleSessionCamera(): void {
  void control('cameraPending', async (open) => {
    const cameraOn = await setCallCamera(open.room, !open.cameraOn);
    return { cameraOn, cameraEpoch: open.cameraEpoch + 1 };
  }, 'Không thể bật/tắt camera. Hãy kiểm tra quyền camera trong Cài đặt.');
}
export function toggleSessionSpeaker(): void {
  void control('speakerPending', async (open) => {
    await setCallSpeaker(!open.speakerOn);
    return { speakerOn: !open.speakerOn };
  }, 'Không thể chuyển loa. Vui lòng thử lại.');
}
export function flipSessionCamera(): void {
  if (!session?.cameraOn) return;
  void control('cameraPending', async (open) => {
    const facing = open.facing === 'user' ? 'environment' : 'user';
    await switchCallCamera(open.room, facing);
    return { facing, cameraEpoch: open.cameraEpoch + 1 };
  }, 'Không thể đổi camera. Vui lòng thử lại.');
}
