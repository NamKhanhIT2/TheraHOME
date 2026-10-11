// The call screen — one screen for both sides of a voice call.
//
// Which role it is playing comes from the data, not the route: the person
// whose id matches `caller_id` is the customer, anyone else here is CSKH. So
// a push notification, the incoming sheet and the "Gọi" button can all route
// to the same path and the screen works out what to show.
//
// The important behaviour is when it joins the LiveKit room, which is exactly
// once, when `status` becomes 'accepted'. Never while ringing. LiveKit Cloud
// bills participant-minutes from the moment a client connects, so joining
// early would charge for every unanswered call — and on the free tier's 5,000
// minutes a month that is the difference between covering the line and not.
// Waiting is done over Realtime on the `calls` row, which is free.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useIsStaff } from '@/hooks/useWebRoles';
import { AvatarImg } from '@/components/AvatarImg';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import {
  CALL_IS_OVER,
  RING_TIMEOUT_MS,
  formatCallDuration,
  useAnswerCall,
  useCall,
  useCallDuration,
  useCallTerminator,
  useCallerProfile,
} from '@/hooks/useCalls';
import {
  CallUnavailableError,
  connectCall,
  disconnectCall,
  setCallSpeaker,
  type LiveKitRoom,
} from '@/lib/livekit';

/** How long the ended state lingers before the screen closes itself, so the
 * reason ("Không có người nghe máy") is readable rather than a flash. */
const CLOSE_DELAY_MS = 1600;

type MediaState = 'idle' | 'connecting' | 'live' | 'failed' | 'unsupported';

export default function CallScreen() {
  const theme = useTheme();
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const userId = useSession().session?.user.id;
  const isStaff = useIsStaff(userId);

  const callQuery = useCall(callId);
  const call = callQuery.data ?? null;
  const callerProfile = useCallerProfile(call?.callerId);
  const answerCall = useAnswerCall();
  const terminate = useCallTerminator(callId);

  const [media, setMedia] = useState<MediaState>('idle');
  const [micOn, setMicOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const roomRef = useRef<LiveKitRoom | null>(null);
  // Separate from `roomRef` because the window that has to be guarded is the
  // one BEFORE a room object exists — see the effect below.
  const connectingRef = useRef(false);

  const isCaller = !!call && call.callerId === userId;
  const isOver = !!call && CALL_IS_OVER.includes(call.status);
  const seconds = useCallDuration(call?.answeredAt);

  // ---------------------------------------------------------------- media
  // Joins the room on 'accepted' and only then. The guard is a ref, not the
  // `media` state: two renders can both read `media === 'idle'` before the
  // first setState lands, and connecting twice puts two participants in the
  // room under the same identity — LiveKit evicts the first, which the user
  // experiences as the call dropping the instant it connects.
  useEffect(() => {
    if (!callId || call?.status !== 'accepted' || connectingRef.current || roomRef.current) return;
    let cancelled = false;
    connectingRef.current = true;
    setMedia('connecting');
    void connectCall(callId)
      .then((room) => {
        if (cancelled) {
          void disconnectCall(room);
          return;
        }
        roomRef.current = room;
        setMedia('live');
        setRemoteJoined(room.remoteParticipants.size > 0);
        room.on('participantConnected', () => setRemoteJoined(true));
        room.on('participantDisconnected', () => {
          setRemoteJoined(false);
          // The other side left for good — a hangup whose database write has
          // not arrived yet, or a client that died. Either way this call is
          // over; ending it here means the line is released even if their
          // `end_call` never lands.
          void terminate('ended', 'remote_left');
        });
        room.on('disconnected', () => {
          if (!cancelled) setMedia('failed');
        });
      })
      .catch((error: unknown) => {
        connectingRef.current = false;
        if (cancelled) return;
        setMedia(error instanceof CallUnavailableError ? 'unsupported' : 'failed');
        if (__DEV__) console.warn('connectCall failed:', error);
      });
    return () => { cancelled = true; };
  }, [callId, call?.status, terminate]);

  // Leaving the room is tied to the screen, not to a status change, so every
  // way out of here — red button, swipe back, hardware back, being navigated
  // away — releases the media and the OS audio session. Without this the
  // participant stays connected until LiveKit's own peer timeout and keeps
  // billing minutes for a call that is visibly over.
  useEffect(() => () => {
    const room = roomRef.current;
    roomRef.current = null;
    connectingRef.current = false;
    void disconnectCall(room);
  }, []);

  // --------------------------------------------------------------- ringing
  // The caller gives up after RING_TIMEOUT_MS. Only the caller runs this
  // timer: if CSKH's phone ran one too, a brief network stall on their side
  // would cancel a call the customer is still happily waiting on.
  useEffect(() => {
    if (!isCaller || call?.status !== 'ringing') return;
    const elapsed = Date.now() - new Date(call.createdAt).getTime();
    const timer = setTimeout(() => { void terminate('missed', 'timeout'); }, Math.max(0, RING_TIMEOUT_MS - elapsed));
    return () => clearTimeout(timer);
  }, [isCaller, call?.status, call?.createdAt, terminate]);

  // An unanswered call must not keep ringing because the caller backgrounded
  // the app mid-ring. Once connected, backgrounding is left alone on purpose
  // — a voice call is expected to continue when the phone is pocketed.
  useEffect(() => {
    if (!isCaller) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      if (callQuery.data?.status === 'ringing') void terminate('missed', 'caller_left');
    });
    return () => subscription.remove();
  }, [isCaller, callQuery.data?.status, terminate]);

  // Close once it is over, after a beat so the outcome is readable. A call
  // that cannot be read at all (a stale push, or someone else's call id that
  // RLS hides) gets the same treatment rather than leaving a dead screen with
  // an End button that can never work.
  const unreadable = !callQuery.isPending && !call;
  useEffect(() => {
    if (!isOver && !unreadable) return;
    const timer = setTimeout(() => {
      if (router.canGoBack()) router.back();
      // Cold start straight onto this screen from a notification tap: there
      // is nothing to go back to, so land each role in the place they would
      // have come from.
      else router.replace(isStaff ? '/chat/admin-conversations' : '/chat/human');
    }, CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOver, unreadable, isStaff]);

  // --------------------------------------------------------------- actions
  function toggleMic() {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    setMicOn(next);
    void room.localParticipant.setMicrophoneEnabled(next).catch(() => setMicOn(!next));
  }

  function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    void setCallSpeaker(next).catch(() => setSpeakerOn(!next));
  }

  function hangUp() {
    hapticConfirm();
    void terminate('ended', 'hangup');
  }

  function decline() {
    hapticConfirm();
    void terminate('declined', 'declined');
  }

  function answer() {
    hapticConfirm();
    if (callId) answerCall.mutate(callId);
  }

  // ----------------------------------------------------------------- copy
  const peerName = isCaller ? 'TheraHOME CSKH' : callerProfile.data?.fullName ?? 'Khách hàng';
  const peerAvatar = isCaller ? null : callerProfile.data?.avatarUrl ?? null;

  const statusLine = (() => {
    if (!call) return callQuery.isPending ? 'Đang kết nối…' : 'Không tìm thấy cuộc gọi';
    switch (call.status) {
      case 'ringing':
        return isCaller ? 'Đang gọi…' : 'Cuộc gọi đến';
      case 'accepted':
        if (media === 'unsupported') return 'Bản cài đặt này chưa hỗ trợ gọi thoại';
        if (media === 'failed') return 'Mất kết nối âm thanh';
        if (media !== 'live') return 'Đang kết nối âm thanh…';
        return remoteJoined ? formatCallDuration(seconds) : 'Đang chờ đầu kia vào…';
      case 'busy':
        return 'Tổng đài đang có cuộc gọi khác';
      case 'declined':
        return isCaller ? 'Cuộc gọi bị từ chối' : 'Đã từ chối';
      case 'missed':
        return isCaller ? 'Không có người nghe máy' : 'Khách đã ngắt máy';
      case 'ended':
        return call.durationSeconds ? `Đã kết thúc · ${formatCallDuration(call.durationSeconds)}` : 'Đã kết thúc';
    }
  })();

  const hint = (() => {
    if (call?.status === 'busy') return 'Bạn có thể nhắn tin, CSKH sẽ gọi lại ngay khi xong cuộc hiện tại.';
    if (media === 'unsupported') return 'Cần cập nhật ứng dụng lên bản mới nhất để dùng tính năng gọi.';
    if (call?.status === 'ringing' && isCaller) return 'Giữ máy trong khoảng 45 giây nhé.';
    return null;
  })();

  // An unreadable call offers no controls at all — it is already closing.
  const showAnswerButtons = !!call && call.status === 'ringing' && isStaff && !isCaller;
  const showInCallControls = call?.status === 'accepted';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bgApp }]}>
      <View style={styles.identity}>
        {peerAvatar || !isCaller ? (
          <AvatarImg size={104} uri={peerAvatar} />
        ) : (
          <View style={[styles.brandAvatar, { backgroundColor: theme.colors.primaryTint10 }]}>
            <Icon name="headphones" size={44} color={theme.colors.primary} />
          </View>
        )}
        <Text style={[theme.type.h1, styles.name, { color: theme.colors.textPrimary }]}>{peerName}</Text>
        <View style={styles.statusRow}>
          {call?.status === 'accepted' && media === 'connecting' ? (
            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          ) : null}
          <Text style={[theme.type.body, { color: theme.colors.textSecondary }]}>{statusLine}</Text>
        </View>
        {hint ? (
          <Text style={[theme.type.captionSm, styles.hint, { color: theme.colors.textMuted }]}>{hint}</Text>
        ) : null}
      </View>

      <View style={styles.controls}>
        {showInCallControls ? (
          <View style={styles.toggleRow}>
            <ToggleButton
              icon={micOn ? 'mic' : 'mic-off'}
              label={micOn ? 'Tắt tiếng' : 'Đã tắt tiếng'}
              active={!micOn}
              onPress={toggleMic}
              disabled={media !== 'live'}
            />
            <ToggleButton
              icon="volume-2"
              label="Loa ngoài"
              active={speakerOn}
              onPress={toggleSpeaker}
              disabled={media !== 'live'}
            />
          </View>
        ) : null}

        {showAnswerButtons ? (
          <View style={styles.answerRow}>
            <RoundButton color={theme.colors.error} icon="phone-off" label="Từ chối" onPress={decline} />
            <RoundButton color={theme.colors.success} icon="phone" label="Trả lời" onPress={answer} disabled={answerCall.isPending} />
          </View>
        ) : isOver || unreadable ? null : (
          <RoundButton color={theme.colors.error} icon="phone-off" label={call?.status === 'ringing' && isCaller ? 'Huỷ' : 'Kết thúc'} onPress={hangUp} />
        )}
      </View>
    </SafeAreaView>
  );
}

function RoundButton({ color, icon, label, onPress, disabled }: {
  color: string; icon: string; label: string; onPress: () => void; disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.roundWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.round, { backgroundColor: color, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
      >
        <Icon name={icon} size={30} color="#fff" />
      </Pressable>
      <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function ToggleButton({ icon, label, active, onPress, disabled }: {
  icon: string; label: string; active: boolean; onPress: () => void; disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.roundWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.toggle,
          {
            backgroundColor: active ? theme.colors.textPrimary : theme.colors.bgCard,
            borderColor: theme.colors.divider,
            opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Icon name={icon} size={24} color={active ? theme.colors.bgCard : theme.colors.textPrimary} />
      </Pressable>
      <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 32 },
  identity: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  brandAvatar: { width: 104, height: 104, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  name: { textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { textAlign: 'center', paddingHorizontal: 24, marginTop: 4 },
  controls: { gap: 28, alignItems: 'center' },
  toggleRow: { flexDirection: 'row', gap: 40 },
  answerRow: { flexDirection: 'row', gap: 56 },
  roundWrap: { alignItems: 'center', gap: 8 },
  round: { width: 68, height: 68, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 58, height: 58, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
