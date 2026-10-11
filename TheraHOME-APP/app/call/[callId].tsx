// The call screen — one screen for both sides, voice or video.
//
// Which role it is playing comes from the data, not the route: the person
// whose id matches `caller_id` is the caller, whoever `callee_id` names (or
// any staff, when it is null) is the callee. So a push notification, either
// incoming sheet and either chat header can all route to the same path.
//
// The important behaviour is when it joins the LiveKit room, which is exactly
// once, when `status` becomes 'accepted'. Never while ringing. LiveKit bills
// every minute a participant is CONNECTED, so joining early would charge for
// unanswered calls — on the free tier's 5,000 minutes a month that is the
// difference between covering the line and not. Waiting is done over Realtime
// on the `calls` row, which is free.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useIsStaff } from '@/hooks/useWebRoles';
import { AvatarImg } from '@/components/AvatarImg';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import { useRingtone } from '@/hooks/useRingtone';
import { CallVideo, useCallVideoTracks } from '@/components/call/CallVideo';
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
  setCallCamera,
  setCallSpeaker,
  switchCallCamera,
  type LiveKitRoom,
} from '@/lib/livekit';

/** How long the ended state lingers before the screen closes itself, so the
 * reason ("Không có người nghe máy") is readable rather than a flash. */
const CLOSE_DELAY_MS = 1600;

type MediaState = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'failed' | 'unsupported';

export default function CallScreen() {
  const theme = useTheme();
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const userId = useSession().session?.user.id;
  const isStaff = useIsStaff(userId);

  const callQuery = useCall(callId);
  const call = callQuery.data ?? null;
  const isVideo = call?.media === 'video';
  const isCaller = !!call && call.callerId === userId;
  const isOver = !!call && CALL_IS_OVER.includes(call.status);

  // The far end. A call with no `callee_id` is addressed to the support line,
  // so for its caller the other party is TheraHOME rather than a person.
  const peerIsSupport = !!call && isCaller && call.calleeId === null;
  const peerId = call ? (isCaller ? call.calleeId : call.callerId) : undefined;
  const peerProfile = useCallerProfile(peerIsSupport ? undefined : peerId ?? undefined);

  const answerCall = useAnswerCall();
  const terminate = useCallTerminator(callId);
  const seconds = useCallDuration(call?.answeredAt);

  const [media, setMedia] = useState<MediaState>('idle');
  const [micOn, setMicOn] = useState(true);
  // A voice call starts with the camera down and may raise it; a video call
  // starts with it up. Set once the row is known rather than guessed here.
  const [cameraOn, setCameraOn] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const roomRef = useRef<LiveKitRoom | null>(null);
  const [room, setRoom] = useState<LiveKitRoom | null>(null);
  // Separate from `roomRef` because the window to guard is the one BEFORE a
  // room object exists — see the effect below.
  const connectingRef = useRef(false);

  // Video is shown whenever a camera is actually publishing, not only when
  // the call was PLACED as video — that is what lets a voice call become a
  // video one mid-conversation.
  const tracks = useCallVideoTracks(room, media === 'live' || media === 'reconnecting');
  // Read by the back handler, which must not re-subscribe on every render.
  const inCallRef = useRef(false);

  // The caller hears a quiet ringback while it rings at the other end. The
  // callee's own phone is rung by the incoming sheet, not here.
  useRingtone(!!call && call.status === 'ringing' && isCaller, 'ringback');

  // ---------------------------------------------------------------- media
  // Joins the room on 'accepted' and only then. The guard is a ref, not the
  // `media` state: two renders can both read 'idle' before the first setState
  // lands, and joining twice under one identity makes LiveKit evict the first
  // participant — which the user experiences as the call dropping instantly.
  useEffect(() => {
    if (!callId || call?.status !== 'accepted' || connectingRef.current || roomRef.current) return;
    let cancelled = false;
    connectingRef.current = true;
    setMedia('connecting');
    const wanted = call.media === 'video' ? 'video' : 'audio';
    void connectCall(callId, wanted)
      .then(({ room: connected, cameraOn: cameraCameUp }) => {
        if (cancelled) {
          void disconnectCall(connected);
          return;
        }
        roomRef.current = connected;
        setRoom(connected);
        setMedia('live');
        // A video call starts on the speaker; reflect that in the toggle so
        // the button does not claim the opposite of what is happening. The
        // camera flag comes from whether it ACTUALLY came up, not from what
        // was asked for — on a device whose camera failed, the call carries
        // on as audio and the button correctly reads "Bật camera".
        if (wanted === 'video') setSpeakerOn(true);
        setCameraOn(cameraCameUp);
        setRemoteJoined(connected.remoteParticipants.size > 0);
        connected.on('participantConnected', () => setRemoteJoined(true));
        connected.on('participantDisconnected', () => {
          setRemoteJoined(false);
          // The other side left for good — a hangup whose write has not
          // arrived yet, or a client that died. Ending here releases the line
          // even if their `end_call` never lands.
          void terminate('ended', 'remote_left');
        });
        // LiveKit reconnects on its own when the network blips; what was
        // missing was any sign of it, so the picture just froze. 'disconnected'
        // is the FINAL give-up, not a blip.
        connected.on('reconnecting', () => { if (!cancelled) setMedia('reconnecting'); });
        connected.on('reconnected', () => { if (!cancelled) setMedia('live'); });
        connected.on('disconnected', () => {
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
  }, [callId, call?.status, call?.media, terminate]);

  // Leaving the room is tied to the screen, not to a status change, so every
  // way out — red button, swipe back, hardware back, being navigated away —
  // releases the media and the OS audio session. Without this the participant
  // stays connected until LiveKit's own peer timeout, still billing.
  useEffect(() => () => {
    const open = roomRef.current;
    roomRef.current = null;
    connectingRef.current = false;
    void disconnectCall(open);
  }, []);

  // --------------------------------------------------------------- ringing
  // Only the caller runs the give-up timer: if the callee's phone ran one
  // too, a brief network stall there would cancel a call the caller is still
  // happily waiting on.
  useEffect(() => {
    if (!isCaller || call?.status !== 'ringing') return;
    const elapsed = Date.now() - new Date(call.createdAt).getTime();
    const timer = setTimeout(() => { void terminate('missed', 'timeout'); }, Math.max(0, RING_TIMEOUT_MS - elapsed));
    return () => clearTimeout(timer);
  }, [isCaller, call?.status, call?.createdAt, terminate]);

  // An unanswered call must not keep ringing because the caller backgrounded
  // the app mid-ring. Once connected, backgrounding is left alone on purpose:
  // a call is expected to continue when the phone is pocketed.
  useEffect(() => {
    if (!isCaller) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      if (callQuery.data?.status === 'ringing') void terminate('missed', 'caller_left');
    });
    return () => subscription.remove();
  }, [isCaller, callQuery.data?.status, terminate]);

  // A call that cannot be read at all (a stale push, or an id RLS hides) gets
  // the same treatment as one that is over, rather than leaving a dead screen
  // with an End button that can never work.
  const unreadable = !callQuery.isPending && !call;
  useEffect(() => {
    if (!isOver && !unreadable) return;
    const timer = setTimeout(() => {
      if (router.canGoBack()) router.back();
      // Cold start straight onto this screen from a notification tap: nothing
      // to go back to, so land each role where they would have come from.
      else router.replace(isStaff ? '/chat/admin-conversations' : '/chat/human');
    }, CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOver, unreadable, isStaff]);

  // Android's hardware back pops this screen, which unmounts it, which
  // disconnects the room — so a stray back press ended the call outright.
  // While a call is up, back is swallowed; the red button is the only way
  // out. (iOS's swipe-back is already off via gestureEnabled on the route.)
  useEffect(() => {
    // Subscribed once and left alone: the handler reads the ref, so whether
    // back is swallowed follows the call's state without this effect having
    // to tear down and re-add a listener on every render.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => inCallRef.current);
    return () => subscription.remove();
  }, []);

  // --------------------------------------------------------------- actions
  function toggleMic() {
    if (!roomRef.current) return;
    const next = !micOn;
    setMicOn(next);
    void roomRef.current.localParticipant.setMicrophoneEnabled(next).catch(() => setMicOn(!next));
  }

  function toggleCamera() {
    const next = !cameraOn;
    setCameraOn(next);
    void setCallCamera(roomRef.current, next).catch(() => setCameraOn(!next));
  }

  function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    void setCallSpeaker(next).catch(() => setSpeakerOn(!next));
  }

  // ----------------------------------------------------------------- copy
  const peerName = peerIsSupport
    ? 'TheraHOME CSKH'
    : (peerProfile.data?.fullName ?? (isStaff ? 'Khách hàng' : 'TheraHOME CSKH'));

  const statusLine = useMemo(() => {
    if (!call) return callQuery.isPending ? 'Đang kết nối…' : 'Không tìm thấy cuộc gọi';
    switch (call.status) {
      case 'ringing':
        return isCaller ? 'Đang gọi…' : (isVideo ? 'Cuộc gọi video đến' : 'Cuộc gọi đến');
      case 'accepted':
        if (media === 'unsupported') return 'Bản cài đặt này chưa hỗ trợ gọi';
        if (media === 'failed') return 'Mất kết nối';
        if (media === 'reconnecting') return 'Đang kết nối lại…';
        if (media !== 'live') return 'Đang kết nối…';
        return remoteJoined ? formatCallDuration(seconds) : 'Đang chờ đầu kia vào…';
      case 'busy':
        return 'Tổng đài đang có cuộc gọi khác';
      case 'declined':
        return isCaller ? 'Cuộc gọi bị từ chối' : 'Đã từ chối';
      case 'missed':
        return isCaller ? 'Không có người nghe máy' : 'Đã ngắt máy';
      case 'ended':
        return call.durationSeconds ? `Đã kết thúc · ${formatCallDuration(call.durationSeconds)}` : 'Đã kết thúc';
    }
  }, [call, callQuery.isPending, isCaller, isVideo, media, remoteJoined, seconds]);

  const hint =
    call?.status === 'busy' ? 'Bạn có thể nhắn tin, CSKH sẽ gọi lại ngay khi xong cuộc hiện tại.'
    : media === 'unsupported' ? 'Cần cập nhật ứng dụng lên bản mới nhất để dùng tính năng gọi.'
    : call?.status === 'ringing' && isCaller ? 'Giữ máy trong khoảng 45 giây nhé.'
    : null;

  const showAnswerButtons = !!call && call.status === 'ringing' && !isCaller;
  const inCall = call?.status === 'accepted';
  // Controls stay usable through a reconnect: muting while the socket is
  // re-establishing should still take effect when it comes back.
  const controlsLive = media === 'live' || media === 'reconnecting';
  inCallRef.current = !!inCall && !isOver;
  // Driven by whether a picture exists at all, EITHER side's — not by how
  // the call was placed. So a voice call that turns into a video one switches
  // to the video stage, and a video call whose far end kills its camera falls
  // back to the identity card instead of freezing on the last frame.
  //
  // `tracks.local` belongs in this condition and was missing from it, which
  // is the whole of the "camera bật nhưng không thấy hình" report: turning
  // your own camera on published a track, lit the button up, and then
  // rendered nothing, because the only <CallVideo> on the screen lived inside
  // a branch that needed the OTHER side's picture. You could not see yourself
  // until they turned their camera on too.
  const videoStage = inCall && controlsLive && (!!tracks.remote || !!tracks.local);
  // The far end gets the full screen when it has a picture; otherwise your
  // own camera does, the way every other caller behaves while the other side
  // is still audio-only.
  const stageTrack = tracks.remote ?? tracks.local;
  const stageIsSelf = !tracks.remote;
  const pipTrack = tracks.remote ? tracks.local : undefined;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: videoStage ? '#000' : theme.colors.bgApp }]}>
      {videoStage ? (
        <>
          <CallVideo trackRef={stageTrack} style={styles.fill} objectFit="cover" mirror={stageIsSelf} />
          {pipTrack ? (
            <View style={[styles.pip, { borderColor: theme.colors.bgCard }]}>
              <CallVideo trackRef={pipTrack} style={styles.fill} objectFit="cover" mirror />
            </View>
          ) : null}
          <View style={styles.videoTopBar}>
            <Text style={[theme.type.bodyStrong, styles.videoText]}>{peerName}</Text>
            <Text style={[theme.type.captionSm, styles.videoText]}>{statusLine}</Text>
            {stageIsSelf ? (
              // Said out loud, because a screen showing only your own face is
              // otherwise indistinguishable from a broken call.
              <Text style={[theme.type.captionSm, styles.videoText]}>
                {peerName} chưa bật camera
              </Text>
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.identity}>
          {peerIsSupport ? (
            <View style={[styles.brandAvatar, { backgroundColor: theme.colors.primaryTint10 }]}>
              <Icon name="headphones" size={44} color={theme.colors.primary} />
            </View>
          ) : (
            <AvatarImg size={104} uri={peerProfile.data?.avatarUrl} />
          )}
          <Text style={[theme.type.h1, styles.name, { color: theme.colors.textPrimary }]}>{peerName}</Text>
          <View style={styles.statusRow}>
            {inCall && media === 'connecting' ? <ActivityIndicator size="small" color={theme.colors.textSecondary} /> : null}
            <Text style={[theme.type.body, { color: theme.colors.textSecondary }]}>{statusLine}</Text>
          </View>
          {hint ? <Text style={[theme.type.captionSm, styles.hint, { color: theme.colors.textMuted }]}>{hint}</Text> : null}
        </View>
      )}

      <View style={[styles.controls, videoStage ? styles.controlsOverVideo : null]}>
        {inCall ? (
          // One row for every call. The camera button is always there, so a
          // voice call can become a video one; "đổi camera" only appears once
          // a camera is actually on, because there is nothing to switch
          // otherwise. Speaker stays available in BOTH kinds — a video call
          // opens on speaker but the user must be able to put it back to the
          // earpiece, which the video-only layout had made impossible.
          <View style={styles.toggleRow}>
            <ToggleButton icon={micOn ? 'mic' : 'mic-off'} label={micOn ? 'Tắt tiếng' : 'Đã tắt tiếng'}
              active={!micOn} onPress={toggleMic} disabled={!controlsLive} onDark={videoStage} />
            <ToggleButton icon={cameraOn ? 'video' : 'video-off'} label={cameraOn ? 'Tắt camera' : 'Bật camera'}
              active={!cameraOn} onPress={toggleCamera} disabled={!controlsLive} onDark={videoStage} />
            {cameraOn ? (
              <ToggleButton icon="switch-camera" label="Đổi camera" active={false}
                onPress={() => void switchCallCamera(roomRef.current).catch(() => undefined)}
                disabled={!controlsLive} onDark={videoStage} />
            ) : null}
            <ToggleButton icon="volume-2" label="Loa ngoài" active={speakerOn}
              onPress={toggleSpeaker} disabled={!controlsLive} onDark={videoStage} />
          </View>
        ) : null}

        {showAnswerButtons ? (
          <View style={styles.answerRow}>
            <RoundButton color={theme.colors.error} icon="phone-off" label="Từ chối"
              onPress={() => { hapticConfirm(); void terminate('declined', 'declined'); }} />
            <RoundButton color={theme.colors.success} icon={isVideo ? 'video' : 'phone'} label="Trả lời"
              disabled={answerCall.isPending}
              onPress={() => { hapticConfirm(); if (callId) answerCall.mutate(callId); }} />
          </View>
        ) : isOver || unreadable ? null : (
          <RoundButton color={theme.colors.error} icon="phone-off"
            label={call?.status === 'ringing' && isCaller ? 'Huỷ' : 'Kết thúc'}
            onPress={() => { hapticConfirm(); void terminate('ended', 'hangup'); }} />
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
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
        style={({ pressed }) => [styles.round, { backgroundColor: color, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}>
        <Icon name={icon} size={30} color="#fff" />
      </Pressable>
      <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function ToggleButton({ icon, label, active, onPress, disabled, onDark }: {
  icon: string; label: string; active: boolean; onPress: () => void; disabled?: boolean; onDark?: boolean;
}) {
  const theme = useTheme();
  // Over video these sit on an unpredictable picture, so they get a
  // translucent chip rather than the themed card colour.
  const background = active
    ? (onDark ? '#fff' : theme.colors.textPrimary)
    : (onDark ? 'rgba(255,255,255,0.22)' : theme.colors.bgCard);
  const tint = active ? (onDark ? '#000' : theme.colors.bgCard) : (onDark ? '#fff' : theme.colors.textPrimary);
  return (
    <View style={styles.roundWrap}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={label}
        disabled={disabled} onPress={onPress}
        style={({ pressed }) => [styles.toggle, {
          backgroundColor: background,
          borderColor: onDark ? 'transparent' : theme.colors.divider,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        }]}>
        <Icon name={icon} size={24} color={tint} />
      </Pressable>
      <Text style={[theme.type.captionSm, { color: onDark ? 'rgba(255,255,255,0.85)' : theme.colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 32 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  identity: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  brandAvatar: { width: 104, height: 104, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  name: { textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { textAlign: 'center', paddingHorizontal: 24, marginTop: 4 },
  controls: { gap: 28, alignItems: 'center' },
  controlsOverVideo: { paddingBottom: 8 },
  toggleRow: { flexDirection: 'row', gap: 24 },
  answerRow: { flexDirection: 'row', gap: 56 },
  roundWrap: { alignItems: 'center', gap: 8 },
  round: { width: 68, height: 68, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 58, height: 58, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  // Own camera, parked top-right the way every video caller does it.
  pip: {
    position: 'absolute', top: 56, right: 16, width: 108, height: 160,
    borderRadius: 14, overflow: 'hidden', borderWidth: 2, backgroundColor: '#111',
  },
  videoTopBar: { position: 'absolute', top: 58, left: 20, gap: 2 },
  videoText: { color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
});
