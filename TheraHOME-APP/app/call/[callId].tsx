// The call screen — one screen for both sides, voice or video.
//
// Which role it is playing comes from the data, not the route: the person
// whose id matches `caller_id` is the caller, whoever `callee_id` names (or
// any staff, when it is null) is the callee. So a push notification, either
// incoming sheet and either chat header can all route to the same path.
//
// THE SCREEN NO LONGER OWNS THE CALL. The LiveKit room lives in
// src/lib/callSession.ts, which is what lets the user minimise a call and
// go and read a message without hanging up — this screen is one of two
// views of that session, the other being <OngoingCallBar>. The billing rule
// that used to be enforced by disconnecting on unmount has not been
// dropped; it moved, and is explained there.
//
// Joining still happens exactly once, when `status` becomes 'accepted', and
// never while ringing: LiveKit bills every minute a participant is
// connected, so joining early would charge for calls nobody answered. The
// waiting is done over Realtime on the `calls` row, which is free.
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { setProximityBlanking } from '@/lib/proximity';
import {
  flipSessionCamera,
  openCallSession,
  toggleSessionCamera,
  toggleSessionMic,
  toggleSessionSpeaker,
  useCallSession,
} from '@/lib/callSession';
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

/** How long the ended state lingers before the screen closes itself, so the
 * reason ("Không có người nghe máy") is readable rather than a flash. */
const CLOSE_DELAY_MS = 1600;

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

  // Everything about the media now comes from the session, so reopening a
  // minimised call shows a live call rather than re-running a connection.
  const liveSession = useCallSession();
  const session = liveSession?.callId === callId ? liveSession : null;
  const media = session?.state ?? 'idle';
  const room = session?.room ?? null;
  const micOn = session?.micOn ?? true;
  const cameraOn = session?.cameraOn ?? false;
  const speakerOn = session?.speakerOn ?? false;
  const remoteJoined = session?.remoteJoined ?? false;
  const quality = session?.quality ?? 'unknown';

  // Video is shown whenever a camera is actually publishing, not only when
  // the call was PLACED as video — that is what lets a voice call become a
  // video one mid-conversation.
  const tracks = useCallVideoTracks(room, media === 'live' || media === 'reconnecting');
  // Read by the back handler, which must not re-subscribe on every render.
  const canMinimiseRef = useRef(false);
  const ringingRef = useRef(false);

  // The caller hears a quiet ringback while it rings at the other end. The
  // callee's own phone is rung by the incoming sheet, not here.
  useRingtone(!!call && call.status === 'ringing' && isCaller, 'ringback');

  // ---------------------------------------------------------------- media
  // Joins on 'accepted' and only then. `openCallSession` is itself a no-op
  // for a call it already holds, which is what makes this safe to run again
  // on every remount — and remounting is exactly what reopening a minimised
  // call does.
  useEffect(() => {
    if (!callId || call?.status !== 'accepted') return;
    void openCallSession(callId, call.media === 'video' ? 'video' : 'audio');
  }, [callId, call?.status, call?.media]);

  // Nothing is disconnected here on unmount. That was the old rule and it is
  // the one thing this screen must NOT do any more: leaving the screen is
  // how a call is minimised. The room is closed by useCallTerminator, by the
  // room's own failure events, and by <OngoingCallBar> when the row goes
  // terminal — see src/lib/callSession.ts.

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

  // --------------------------------------------------------------- actions
  // Leaves the screen WITHOUT touching the call; <OngoingCallBar> takes over
  // from here. Memoised so the back handler below can depend on it without
  // re-subscribing on every render.
  const minimise = useCallback(() => {
    if (router.canGoBack()) router.back();
    // Nothing to go back to — the app was started straight onto this screen
    // by a notification tap. Land each role where they would have come from.
    else router.replace(isStaff ? '/chat/admin-conversations' : '/chat/human');
  }, [isStaff]);

  // Android's hardware back used to be swallowed outright, because popping
  // this screen unmounted it and unmounting ended the call. Now it minimises,
  // the way every other caller behaves.
  //
  // While the call is still RINGING it is swallowed as before, and for a
  // reason worth stating: there is no room to minimise yet, and the give-up
  // timer that cancels an unanswered call lives in this component. Backing
  // out would unmount the timer and leave the other phone ringing on with
  // nothing to stop it but the server's janitor. Huỷ / Từ chối are the way
  // out of a ringing call.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canMinimiseRef.current) {
        minimise();
        return true;
      }
      return ringingRef.current;
    });
    return () => subscription.remove();
  }, [minimise]);

  // ------------------------------------------------------------- proximity
  // Armed only when the phone is plausibly AT an ear: a connected call with
  // no picture on screen. A video call, or a voice call with a camera up,
  // is being looked at — blanking it would be the bug rather than the fix.
  const atEar = media === 'live' && !cameraOn && !tracks.remote;
  useEffect(() => {
    if (!atEar) return;
    setProximityBlanking(true);
    return () => setProximityBlanking(false);
  }, [atEar]);


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
  canMinimiseRef.current = !!inCall && !isOver && controlsLive;
  ringingRef.current = call?.status === 'ringing';
  // Driven by whether a picture exists at all, EITHER side's — so a voice
  // call that turns into a video one switches to the video stage, and a
  // video call whose far end kills its camera falls back to the identity
  // card instead of freezing on the last frame.
  const videoStage = inCall && controlsLive && (!!tracks.remote || !!tracks.local);
  // The far end gets the full screen when it has a picture; otherwise your
  // own camera does, the way every other caller behaves while the other side
  // is still audio-only.
  const stageTrack = tracks.remote ?? tracks.local;
  const stageIsSelf = !tracks.remote;
  const pipTrack = tracks.remote ? tracks.local : undefined;
  // Only worth saying when it is bad. "Excellent" on screen is noise.
  const weakNetwork = controlsLive && (quality === 'poor' || quality === 'lost');

  return (
    <SafeAreaView style={[styles.root, {
      backgroundColor: videoStage ? '#000' : theme.colors.bgApp,
      // On the video stage EVERY other element is absolutely positioned —
      // the picture, the PiP, the name — so the controls are the only child
      // left in flow, and `space-between` put that single child at the TOP,
      // on top of the far end's face and overlapping the PiP. Reported from
      // the device the first time video ever actually rendered.
      justifyContent: videoStage ? 'flex-end' : 'space-between',
    }]}>
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

      {/* Minimise. Only once there is a call worth keeping: while it is still
          ringing there is nothing behind the screen to go back to. */}
      {canMinimiseRef.current ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thu nhỏ cuộc gọi"
          onPress={minimise}
          hitSlop={12}
          style={[styles.minimise, {
            backgroundColor: videoStage ? 'rgba(255,255,255,0.22)' : theme.colors.bgCard,
          }]}
        >
          <Icon name="chevron-down" size={24} color={videoStage ? '#fff' : theme.colors.textPrimary} />
        </Pressable>
      ) : null}

      {/* A weak line is otherwise indistinguishable from a broken app: the
          voice breaks up, the picture freezes, and nothing admits anything
          is wrong. LiveKit's own measure of both ends, worse one wins. */}
      {weakNetwork ? (
        <View style={[styles.quality, { backgroundColor: quality === 'lost' ? theme.colors.error : theme.colors.warning }]}>
          <Icon name="wifi-off" size={14} color="#fff" />
          <Text style={[theme.type.captionSm, styles.qualityText]}>
            {quality === 'lost' ? 'Mất kết nối mạng' : 'Mạng yếu, cuộc gọi có thể bị ngắt quãng'}
          </Text>
        </View>
      ) : null}

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
              active={!micOn} onPress={toggleSessionMic} disabled={!controlsLive} onDark={videoStage} />
            <ToggleButton icon={cameraOn ? 'video' : 'video-off'} label={cameraOn ? 'Tắt camera' : 'Bật camera'}
              active={!cameraOn} onPress={toggleSessionCamera} disabled={!controlsLive} onDark={videoStage} />
            {cameraOn ? (
              <ToggleButton icon="switch-camera" label="Đổi camera" active={false}
                onPress={flipSessionCamera} disabled={!controlsLive} onDark={videoStage} />
            ) : null}
            <ToggleButton icon="volume-2" label="Loa ngoài" active={speakerOn}
              onPress={toggleSessionSpeaker} disabled={!controlsLive} onDark={videoStage} />
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
  minimise: {
    position: 'absolute', top: 54, left: 16,
    width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
  },
  quality: {
    position: 'absolute', top: 104, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
  },
  qualityText: { color: '#fff', flexShrink: 1 },
  // Own camera, parked top-right the way every video caller does it.
  pip: {
    position: 'absolute', top: 56, right: 16, width: 108, height: 160,
    borderRadius: 14, overflow: 'hidden', borderWidth: 2, backgroundColor: '#111',
  },
  videoTopBar: { position: 'absolute', top: 58, left: 64, gap: 2 },
  videoText: { color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
});
