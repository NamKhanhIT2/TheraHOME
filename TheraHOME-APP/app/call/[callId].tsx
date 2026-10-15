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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useIsStaff } from '@/hooks/useWebRoles';
import { AvatarImg } from '@/components/AvatarImg';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import { CallVideo, useCallVideoTracks } from '@/components/call/CallVideo';
import { CallPip } from '@/components/call/CallPip';
import { setCallScreenAwake } from '@/lib/callScreen';
import {
  flipSessionCamera,
  openCallSession,
  trackCallSession,
  toggleSessionCamera,
  toggleSessionMic,
  toggleSessionSpeaker,
  useCallSession,
} from '@/lib/callSession';
import {
  CALL_IS_OVER,
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
  const serverOver = !!call && CALL_IS_OVER.includes(call.status);

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
  const isOver = serverOver || media === 'ending';
  const room = session?.room ?? null;
  const micOn = session?.micOn ?? true;
  const cameraOn = session?.cameraOn ?? false;
  const speakerOn = session?.speakerOn ?? false;
  const facing = session?.facing ?? 'user';
  const cameraEpoch = session?.cameraEpoch ?? 0;
  const remoteJoined = session?.remoteJoined ?? false;
  const quality = session?.quality ?? 'unknown';

  // Video is shown whenever a camera is actually publishing, not only when
  // the call was PLACED as video — that is what lets a voice call become a
  // video one mid-conversation.
  const tracks = useCallVideoTracks(room, media === 'live' || media === 'reconnecting');
  // Read by the back handler, which must not re-subscribe on every render.
  const canMinimiseRef = useRef(false);

  // Over video, the controls get out of the way. Every other caller does
  // this and the reason is the same: the picture is the point, and a row of
  // buttons across someone's face is in the way of it. Tap anywhere to bring
  // them back, and they leave again on their own.
  const [controlsVisible, setControlsVisible] = useState(true);
  // Bumped by any interaction, which restarts the timer below — so the
  // controls never vanish out from under a finger.
  const [touchedAt, setTouchedAt] = useState(0);
  const keepControls = useCallback(() => setTouchedAt(Date.now()), []);
  // Tapping the self-view puts it in the big frame and the other person in
  // the corner — the same gesture, and the same result, as on Messenger.
  const [swapped, setSwapped] = useState(false);

  // Restore deep links as well as calls started through the chat header.
  // Once tracked, the shell owns connection, timeouts and ringback.
  useEffect(() => {
    if (!call || !userId || serverOver) return;
    if (call.status === 'ringing' && isCaller) trackCallSession(call.id, call.media);
    if (call.status === 'accepted' && (isCaller || call.answeredBy === userId)) {
      void openCallSession(call.id, call.media);
    }
  }, [call, userId, isCaller, serverOver]);

  // A call that cannot be read at all (a stale push, or an id RLS hides) gets
  // the same treatment as one that is over, rather than leaving a dead screen
  // with an End button that can never work.
  const unreadable = callQuery.isSuccess && !call;
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

  // Back minimises ringing, connecting and live calls alike.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canMinimiseRef.current) {
        minimise();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [minimise]);

  // ------------------------------------------------------------- chrome
  // Derived before the effects below, because two of them depend on it.
  const showAnswerButtons = !!call && call.status === 'ringing' && !isCaller;
  const inCall = call?.status === 'accepted';
  // Controls stay usable through a reconnect: muting while the socket is
  // re-establishing should still take effect when it comes back.
  const controlsLive = media === 'live' || media === 'reconnecting';
  canMinimiseRef.current = !!session && !isOver;
  // Driven by whether a picture exists at all, EITHER side's — so a voice
  // call that turns into a video one switches to the video stage, and a
  // call where nobody has a camera stays on the plain identity screen.
  const videoStage = inCall && controlsLive && (!!tracks.remote || !!tracks.local);

  // THE BIG FRAME IS THE OTHER PERSON. Always — their picture when they have
  // one, their face and name on black when they do not. Your own camera is
  // always the small window.
  //
  // The first version put whichever camera existed into the big frame, so a
  // video call where only you had switched your camera on filled the screen
  // with your own face. That is not how any caller behaves, and it is
  // disorienting for the obvious reason: the big frame is where you look to
  // see who you are talking to.
  //
  // Tapping the small window swaps them, which is the one case where your
  // own camera belongs in the big frame — checking what you are showing.
  const canSwap = !!tracks.remote && !!tracks.local;
  const mainTrack = swapped ? tracks.local : tracks.remote;
  const pipTrack = swapped ? tracks.remote : tracks.local;
  const mainIsSelf = swapped;
  // A track that goes away under a swap would leave the two frames the wrong
  // way round for the rest of the call.
  useEffect(() => {
    if (swapped && !canSwap) setSwapped(false);
  }, [swapped, canSwap]);
  // The local preview is keyed on the camera epoch, so a camera switch gets
  // a new view instead of the last frame of the track that was stopped.
  const mainKey = mainIsSelf ? `self-${cameraEpoch}` : 'peer';
  const pipKey = mainIsSelf ? 'peer' : `self-${cameraEpoch}`;
  // Mirroring is for a front camera only. A mirrored rear camera shows the
  // world back to front, and every sign and every face in it is reversed.
  const selfMirrored = facing === 'user';
  // Only worth saying when it is bad. "Excellent" on screen is noise.
  const weakNetwork = controlsLive && (quality === 'poor' || quality === 'lost');
  // Hidden only ever over video; everywhere else the controls are the screen.
  //
  // And never while something is wrong. A frozen picture with no caption is
  // the worst thing this screen can show: the user cannot tell a bad line
  // from a crashed app. Whenever the call is reconnecting or the line has
  // dropped, the chrome comes back and says so.
  const troubled = media === 'reconnecting' || quality === 'lost';
  const showControls = !videoStage || controlsVisible;

  // Four seconds, measured from the last touch. Only over video: on the
  // identity card there is nothing underneath worth revealing, and hiding
  // the End button of a call with no picture would just be a way to lose it.
  useEffect(() => {
    // Not while the call is in trouble: see `troubled` above.
    if (!videoStage || !controlsVisible || troubled) return;
    const timer = setTimeout(() => setControlsVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [videoStage, controlsVisible, touchedAt, troubled]);

  // Trouble brings the chrome back whether it was asked for or not, and the
  // timer above does not start again until the trouble has passed — so the
  // explanation does not blink out of existence the instant things recover.
  useEffect(() => {
    if (troubled) setControlsVisible(true);
  }, [troubled]);

  // Leaving the video stage — the far end killed its camera, or the call is
  // winding up — must not strand the controls hidden.
  useEffect(() => {
    if (!videoStage) setControlsVisible(true);
  }, [videoStage]);

  // And the screen does not lock while a call is up — including while it is
  // still ringing, because watching "Đang gọi…" is exactly the kind of
  // waiting the idle timer interrupts.
  useEffect(() => {
    if (isOver || unreadable) return;
    setCallScreenAwake(true);
    return () => setCallScreenAwake(false);
  }, [isOver, unreadable]);


  // ----------------------------------------------------------------- copy
  const peerName = peerIsSupport
    ? 'TheraHOME CSKH'
    : (peerProfile.data?.fullName ?? (isStaff ? 'Khách hàng' : 'TheraHOME CSKH'));

  const statusLine = useMemo(() => {
    if (media === 'ending') return session?.failureReason ? 'Không thể duy trì kết nối' : 'Đã kết thúc';
    if (!call) return callQuery.isError ? 'Không thể tải cuộc gọi' : callQuery.isPending ? 'Đang kết nối…' : 'Không tìm thấy cuộc gọi';
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
        return peerIsSupport ? 'Tổng đài đang có cuộc gọi khác' : 'Người nhận đang bận';
      case 'declined':
        return isCaller ? 'Cuộc gọi bị từ chối' : 'Đã từ chối';
      case 'missed':
        return isCaller ? (call.endReason === 'cancelled' ? 'Đã hủy cuộc gọi' : 'Không có người nghe máy') : 'Cuộc gọi nhỡ';
      case 'ended':
        if (call.endReason === 'unsupported') return 'Bản cài đặt này chưa hỗ trợ gọi';
        if (['connection_failed', 'connection_timeout', 'peer_timeout'].includes(call.endReason ?? '')) return 'Cuộc gọi kết thúc do mất kết nối';
        return call.durationSeconds ? `Đã kết thúc · ${formatCallDuration(call.durationSeconds)}` : 'Đã kết thúc';
    }
  }, [call, callQuery.isPending, callQuery.isError, isCaller, isVideo, media, remoteJoined, seconds, peerIsSupport, session?.failureReason]);

  const hint =
    call?.status === 'busy' ? 'Bạn có thể nhắn tin, CSKH sẽ gọi lại ngay khi xong cuộc hiện tại.'
    : media === 'unsupported' ? 'Cần cập nhật ứng dụng lên bản mới nhất để dùng tính năng gọi.'
    : call?.status === 'ringing' && isCaller ? 'Giữ máy trong khoảng 45 giây nhé.'
    : null;

  return (
    // TWO LAYERS, and the split matters.
    //
    // The picture is a child of the OUTER view, which has no padding, so it
    // reaches every edge of the screen. It used to be a child of the padded
    // SafeAreaView, and an absolutely positioned child is laid out inside
    // its parent's padding — so the video sat in a box inset by 24pt each
    // side and 32pt top and bottom. Against a black background nobody could
    // see the inset; it just looked like a video that did not quite fill
    // the phone.
    //
    // Everything a finger or an eye needs — the buttons, the name, the
    // minimise control — lives in the inner SafeAreaView, where the padding
    // and the notch are respected. `box-none` on it lets a tap that lands
    // on none of those fall through to the picture underneath, which is
    // what hides the controls.
    <View style={[styles.root, { backgroundColor: videoStage ? '#000' : theme.colors.bgApp }]}>
      {videoStage ? (
        <>
          {mainTrack ? (
            <CallVideo key={mainKey} trackRef={mainTrack} style={styles.fill}
              objectFit="cover" mirror={mainIsSelf && selfMirrored} />
          ) : (
            // Their camera is off and yours is on. Their face and name, on
            // black — the frame still belongs to them.
            <View style={[styles.fill, styles.peerStage]}>
              {peerIsSupport ? (
                <View style={[styles.brandAvatar, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                  <Icon name="headphones" size={44} color="#fff" />
                </View>
              ) : (
                <AvatarImg size={104} uri={peerProfile.data?.avatarUrl} />
              )}
              <Text style={[theme.type.h2, styles.videoText]}>{peerName}</Text>
              <Text style={[theme.type.caption, styles.videoTextDim]}>Camera đang tắt</Text>
            </View>
          )}
          {/* The whole picture is one big tap target for showing and hiding
              the controls. It sits ABOVE the video and BELOW everything
              else, so a tap on a button is still a tap on that button —
              React Native hands a touch to the last-drawn view that wants
              it, and every control is drawn after this. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={controlsVisible ? 'Ẩn các nút điều khiển' : 'Hiện các nút điều khiển'}
            style={styles.fill}
            onPress={() => {
              setControlsVisible((visible) => !visible);
              keepControls();
            }}
          />
        </>
      ) : null}

      <SafeAreaView
        pointerEvents="box-none"
        style={[styles.content, { justifyContent: videoStage ? 'flex-end' : 'space-between' }]}
      >
      {videoStage ? (
        showControls ? (
          <View pointerEvents="none" style={styles.videoTopBar}>
            <Text style={[theme.type.bodyStrong, styles.videoText]}>{peerName}</Text>
            <Text style={[theme.type.captionSm, styles.videoText]}>{statusLine}</Text>
          </View>
        ) : null
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

      {/* The shell keeps ringing/connecting even after this view is closed. */}
      {canMinimiseRef.current && showControls ? (
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

      {showControls ? (
      <View pointerEvents="box-none" style={[styles.controls, videoStage ? styles.controlsOverVideo : null]}>
        {inCall && !isOver ? (
          // One row for every call. The camera button is always there, so a
          // voice call can become a video one; "đổi camera" only appears once
          // a camera is actually on, because there is nothing to switch
          // otherwise. Speaker stays available in BOTH kinds — a video call
          // opens on speaker but the user must be able to put it back to the
          // earpiece, which the video-only layout had made impossible.
          <View style={styles.toggleRow}>
            <ToggleButton icon={micOn ? 'mic' : 'mic-off'} label={micOn ? 'Tắt tiếng' : 'Đã tắt tiếng'}
              active={!micOn} onPress={() => { keepControls(); toggleSessionMic(); }} disabled={!controlsLive || session?.micPending} onDark={videoStage} />
            <ToggleButton icon={cameraOn ? 'video' : 'video-off'} label={cameraOn ? 'Tắt camera' : 'Bật camera'}
              active={!cameraOn} onPress={() => { keepControls(); toggleSessionCamera(); }} disabled={!controlsLive || session?.cameraPending} onDark={videoStage} />
            {cameraOn ? (
              <ToggleButton icon="switch-camera" label="Đổi camera" active={false}
                onPress={() => { keepControls(); flipSessionCamera(); }} disabled={!controlsLive || session?.cameraPending} onDark={videoStage} />
            ) : null}
            <ToggleButton icon="volume-2" label="Loa ngoài" active={speakerOn}
              onPress={() => { keepControls(); toggleSessionSpeaker(); }} disabled={!controlsLive || session?.speakerPending} onDark={videoStage} />
          </View>
        ) : null}

        {session?.controlError ? (
          <Text accessibilityRole="alert" style={[theme.type.captionSm, { color: videoStage ? '#fff' : theme.colors.error, textAlign: 'center' }]}>
            {session.controlError}
          </Text>
        ) : null}
        {callQuery.isError && !call ? (
          <RoundButton color={theme.colors.primary} icon="refresh-cw" label="Thử lại" onPress={() => { void callQuery.refetch(); }} />
        ) : null}
        {showAnswerButtons && !isOver ? (
          <View style={styles.answerRow}>
            <RoundButton color={theme.colors.error} icon="phone-off" label="Từ chối"
              disabled={answerCall.isPending}
              onPress={() => { hapticConfirm(); void terminate('declined', 'declined'); }} />
            <RoundButton color={theme.colors.success} icon={isVideo ? 'video' : 'phone'} label="Trả lời"
              disabled={answerCall.isPending}
              onPress={() => { hapticConfirm(); if (callId) answerCall.mutate(callId, { onError: () => Alert.alert('Không thể trả lời', 'Cuộc gọi có thể đã kết thúc. Vui lòng thử lại.') }); }} />
          </View>
        ) : isOver || unreadable ? null : (
          <RoundButton color={theme.colors.error} icon="phone-off"
            label={call?.status === 'ringing' && isCaller ? 'Huỷ' : 'Kết thúc'}
            onPress={() => { hapticConfirm(); void terminate('ended', 'hangup'); }} />
        )}
      </View>
      ) : null}
      </SafeAreaView>

      {/* Last, so it floats over everything — and outside the padded layer,
          because it moves in screen coordinates. Its own bounds keep it
          clear of the controls, so being on top cannot block them. */}
      {videoStage && pipTrack ? (
        <CallPip onPress={canSwap ? () => { keepControls(); setSwapped((on) => !on); } : undefined}>
          <CallVideo key={pipKey} trackRef={pipTrack} style={styles.fill}
            objectFit="cover" mirror={!mainIsSelf && selfMirrored} />
        </CallPip>
      ) : null}
    </View>
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
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingVertical: 32 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  identity: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  brandAvatar: { width: 104, height: 104, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  name: { textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { textAlign: 'center', paddingHorizontal: 24, marginTop: 4 },
  controls: { gap: 28, alignItems: 'center' },
  // box-none so a tap in the gaps between buttons reaches the picture.
  controlsOverVideo: { paddingBottom: 8 },
  toggleRow: { flexDirection: 'row', gap: 24 },
  answerRow: { flexDirection: 'row', gap: 56 },
  roundWrap: { alignItems: 'center', gap: 8 },
  round: { width: 68, height: 68, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 58, height: 58, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  minimise: {
    position: 'absolute', top: 0, left: 0,
    width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
  },
  quality: {
    position: 'absolute', top: 52, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
  },
  qualityText: { color: '#fff', flexShrink: 1 },
  // Their side of the call when they have no camera: the big frame still
  // belongs to them.
  peerStage: { alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#111' },
  videoTopBar: { position: 'absolute', top: 4, left: 52, right: 120, gap: 2 },
  videoText: { color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  videoTextDim: { color: 'rgba(255,255,255,0.65)' },
});
