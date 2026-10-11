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
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import { closeCallSession, useCallSession } from '@/lib/callSession';
import {
  CALL_IS_OVER,
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
    if (!enabled && session) void closeCallSession();
  }, [enabled, session]);

  if (!session || !enabled) return null;
  return (
    <ActiveCall
      // Keyed so a second call gets fresh hooks rather than inheriting the
      // first one's Realtime subscription and duration tick.
      key={session.callId}
      callId={session.callId}
      userId={userId}
      micOn={session.micOn}
      reconnecting={session.state === 'reconnecting'}
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
function ActiveCall({ callId, userId, micOn, reconnecting, hidden }: {
  callId: string;
  userId: string | undefined;
  micOn: boolean;
  reconnecting: boolean;
  hidden: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const call = useCall(callId).data ?? null;
  const terminate = useCallTerminator(callId);
  const seconds = useCallDuration(call?.answeredAt);

  const isCaller = !!call && call.callerId === userId;
  const peerIsSupport = !!call && isCaller && call.calleeId === null;
  const peerId = call ? (isCaller ? call.calleeId : call.callerId) : undefined;
  const peer = useCallerProfile(peerIsSupport ? undefined : peerId ?? undefined);

  // The safety net described at the top of the file: the far end hung up
  // while this phone was somewhere else in the app. Nothing on this device
  // acted, so nothing else would have closed the room.
  const over = !!call && CALL_IS_OVER.includes(call.status);
  useEffect(() => {
    if (over) void closeCallSession(callId);
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
        onPress={() => router.push({ pathname: '/call/[callId]', params: { callId } })}
        style={({ pressed }) => [styles.bar, {
          backgroundColor: theme.colors.success,
          opacity: pressed ? 0.9 : 1,
        }]}
      >
        <Icon name={micOn ? 'phone' : 'mic-off'} size={18} color="#fff" />
        <View style={styles.text}>
          <Text numberOfLines={1} style={[theme.type.captionSm, styles.label]}>{name}</Text>
          <Text style={[theme.type.captionSm, styles.label]}>
            {reconnecting ? 'Đang kết nối lại…' : formatCallDuration(seconds)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kết thúc cuộc gọi"
          hitSlop={10}
          onPress={() => { hapticConfirm(); void terminate('ended', 'hangup'); }}
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
