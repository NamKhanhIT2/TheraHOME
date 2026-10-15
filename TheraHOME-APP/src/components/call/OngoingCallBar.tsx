// The minimised call: a bar across the top saying a call is still running,
// with the time, and a way back into it.
//
// This is the other half of being able to leave the call screen. Without it
// a minimised call is an invisible one — still connected, still billing,
// still carrying someone's voice, with nothing on screen to say so. Every
// caller that lets you navigate away shows one of these, and for the same
// reason: a call you cannot see is a call you forget to end.
//
// It is also the LAST of the three things that close a LiveKit room (see
// src/lib/callSession.ts). The other two react to this device acting — the
// red button, the room failing. This one watches the `calls` row over
// Realtime, so a call ended by the OTHER side while minimised is noticed
// here and nowhere else.
import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import { closeCallSession, openCallSession, useCallSession, type CallSession } from '@/lib/callSession';
import { dismissCall } from '@/lib/callkeep';
import { setProximityBlanking } from '@/lib/callScreen';
import { useRingtone } from '@/hooks/useRingtone';
import { useCallVideoTracks } from '@/components/call/CallVideo';
import {
  CALL_IS_OVER,
  RING_TIMEOUT_MS,
  formatCallDuration,
  useCall,
  useCallDuration,
  useCallTerminator,
  useCallerProfile,
} from '@/hooks/useCalls';

export function OngoingCallBar({ enabled, userId }: {
  /** Whether a signed-in user is inside the app at all. */
  enabled: boolean;
  userId: string | undefined;
}) {
  const session = useCallSession();
  const pathname = usePathname();
  // On the call screen itself there is nothing to minimise back TO.
  const onCallScreen = pathname?.startsWith('/call/') ?? false;

  // Signing out, or being thrown back to onboarding, has to take the call
  // with it. The room is attached to a LiveKit identity minted for an
  // account; leaving it connected after that account has gone would keep
  // billing for a call nobody can see or end.
  useEffect(() => {
    if (!enabled && session) {
      dismissCall(session.callId);
      void closeCallSession();
    }
  }, [enabled, session]);

  if (!session || !enabled) return null;
  return (
    <ActiveCall
      // Keyed so a second call gets fresh hooks rather than inheriting the
      // first one's Realtime subscription and duration tick.
      key={session.callId}
      callId={session.callId}
      userId={userId}
      session={session}
      hidden={onCallScreen}
    />
  );
}

/**
 * Split out so the hooks below run only while a call exists.
 *
 * `useCall` subscribes to Realtime and `useCallDuration` ticks every second;
 * neither should be doing anything for the 99% of the app's life when
 * nobody is on the phone. Keyed by call id at the mount site, so a second
 * call gets a fresh subscription rather than a stale one.
 */
function ActiveCall({ callId, userId, session, hidden }: {
  callId: string;
  userId: string | undefined;
  session: CallSession;
  hidden: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: callData, refetch: refetchCall } = useCall(callId);
  const call = callData ?? null;
  const terminate = useCallTerminator(callId);
  const seconds = useCallDuration(call?.answeredAt);
  const [ringExpired, setRingExpired] = useState(false);

  const isCaller = !!call && call.callerId === userId;
  const peerIsSupport = !!call && isCaller && call.calleeId === null;
  const peerId = call ? (isCaller ? call.calleeId : call.callerId) : undefined;
  const peer = useCallerProfile(peerIsSupport ? undefined : peerId ?? undefined);

  const ending = session.state === 'ending';
  const isParticipant = !!call && (isCaller || call.answeredBy === userId);
  useRingtone(isCaller && call?.status === 'ringing' && !ending && !ringExpired, 'ringback');
  useEffect(() => {
    if (call?.status === 'accepted' && isParticipant && !ending) {
      void openCallSession(callId, call.media);
    }
  }, [call?.status, call?.media, callId, isParticipant, ending]);

  // Owned by the shell, including when the call screen is minimised. Check
  // the original deadline again on resume because mobile timers can pause.
  useEffect(() => {
    if (!isCaller || call?.status !== 'ringing' || ending) return;
    const remaining = () => RING_TIMEOUT_MS - (Date.now() - Date.parse(call.createdAt));
    const expire = () => {
      if (remaining() > 0) return;
      setRingExpired(true);
      void terminate('missed', 'timeout');
    };
    const timer = setTimeout(expire, Math.max(0, remaining()));
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') expire(); });
    return () => { clearTimeout(timer); app.remove(); };
  }, [call?.status, call?.createdAt, isCaller, ending, terminate]);

  useEffect(() => {
    if (!ringExpired || call?.status !== 'ringing' || ending) return;
    const timer = setInterval(() => { void terminate('missed', 'timeout'); }, 5000);
    return () => clearInterval(timer);
  }, [ringExpired, call?.status, ending, terminate]);

  useEffect(() => {
    if (session.state === 'failed' || session.state === 'unsupported') {
      void terminate('ended', session.failureReason ?? 'connection_failed');
    }
  }, [session.state, session.failureReason, terminate]);

  useEffect(() => {
    if (session.state === 'reconnecting' && !session.remoteJoined) {
      // Check for an explicit hangup immediately, even if Realtime/polling
      // was suspended in the background. Otherwise allow peer recovery.
      void refetchCall();
    }
  }, [session.state, session.remoteJoined, refetchCall]);

  // Keep retrying a local hangup while offline; the UI/media stay ended.
  useEffect(() => {
    if (!ending) return;
    const timer = setInterval(() => { void terminate('ended', session.failureReason ?? 'hangup'); }, 5000);
    return () => clearInterval(timer);
  }, [ending, session.failureReason, terminate]);

  const tracks = useCallVideoTracks(session.room, session.state === 'live' || session.state === 'reconnecting');
  const atEar = session.state === 'live' && !session.speakerOn && !session.cameraOn && !tracks.remote;
  useEffect(() => {
    setProximityBlanking(atEar);
    return () => setProximityBlanking(false);
  }, [atEar]);

  // The safety net described at the top of the file: the far end hung up
  // while this phone was somewhere else in the app. Nothing on this device
  // acted, so nothing else would have closed the room.
  const over = !!call && CALL_IS_OVER.includes(call.status);
  useEffect(() => {
    if (over) {
      dismissCall(callId);
      void closeCallSession(callId);
    }
  }, [over, callId]);

  // Rendered-but-hidden rather than unmounted while the call screen is up:
  // unmounting would drop the Realtime subscription above, which is the
  // very thing that has to keep watching.
  if (hidden || over) return null;

  const name = peerIsSupport
    ? 'TheraHOME CSKH'
    : (peer.data?.fullName ?? 'Cuộc gọi');

  return (
    <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Quay lại cuộc gọi với ${name}`}
        onPress={() => router.navigate({ pathname: '/call/[callId]', params: { callId } })}
        style={({ pressed }) => [styles.bar, {
          backgroundColor: theme.colors.success,
          opacity: pressed ? 0.9 : 1,
        }]}
      >
        <Icon name={session.micOn ? 'phone' : 'mic-off'} size={18} color="#fff" />
        <View style={styles.text}>
          <Text numberOfLines={1} style={[theme.type.captionSm, styles.label]}>{name}</Text>
          <Text style={[theme.type.captionSm, styles.label]}>
            {ending ? 'Đang kết thúc…' : call?.status === 'ringing' ? 'Đang gọi…'
              : session.state === 'reconnecting' ? 'Đang kết nối lại…'
              : !session.remoteJoined ? 'Đang kết nối…' : formatCallDuration(seconds)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kết thúc cuộc gọi"
          hitSlop={10}
          disabled={ending}
          onPress={(event) => { event.stopPropagation(); hapticConfirm(); void terminate('ended', 'hangup'); }}
          style={[styles.end, { backgroundColor: theme.colors.error }]}
        >
          <Icon name="phone-off" size={16} color="#fff" />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingLeft: 14, paddingRight: 8,
    borderRadius: 999, alignSelf: 'stretch',
    // Enough lift to read as floating over whatever is behind it.
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  text: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#fff', fontWeight: '600' },
  end: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
