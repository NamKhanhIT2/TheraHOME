// "Tập cùng chuyên viên" — the specialist on top, you underneath, and the
// part of you that is out of step turning red while you move.
//
// Its own route rather than another section of app/day/[dayId].tsx, which
// is already 559 lines and whose job is to be a page you read. This one is
// a thing you stand in front of: it holds the camera open, it wants the
// whole screen, and leaving it has to switch the camera off.
//
// WHAT IT DOES NOT DO: nothing the camera sees leaves the phone. There is
// no upload, no frame kept, nothing written to Supabase but the fact that a
// session happened. The screen says so before it asks for the camera,
// because that is the question anyone sensible asks first.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoThumbnail } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Image } from 'expo-image';
import { homeGlassColors, useTheme, poseColors } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms, useCatalogProgramDays } from '@/hooks/usePrograms';
import { useExerciseReference, type ExerciseReference } from '@/hooks/useExerciseReference';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { PoseSkeleton, type PoseLevel } from '@/components/pose/PoseSkeleton';
import { getCallSession } from '@/lib/callSession';
import { PoseCamera, isPoseCameraAvailable } from '@/components/pose/PoseCamera';
import {
  getCameraPermissionStatus,
  isPoseSupported,
  POSE_EDGES,
  POSE_HIDDEN,
  requestCameraPermission,
  type PoseFrame,
  type PosePoint,
  type PoseStatus,
} from '@/lib/pose';
import { createComparator, edgesFor, type Comparator, type Verdict } from '@/lib/poseCompare';
import { sampleAt, type TrackSample } from '@/lib/poseTrack';
import { hintFor, partOf } from '@/lib/poseHints';
import { useEdgeGlowTransition } from '@/store/useEdgeGlowTransition';

/** The reference skeleton is redrawn at the track's own rate. Faster would
 * draw the same sample twice; slower would make the specialist stutter next
 * to a customer moving smoothly. */
const REFERENCE_HZ = 15;
const PREVIEW_TIME_MS = 100;

/** Seconds of "get into position" before anything is scored. Long enough to
 * step back and put the phone down, short enough not to be a wait. */
const COUNTDOWN = 5;

type Phase = 'intro' | 'countdown' | 'running' | 'done';

export default function TrainScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { dayId, productId, edgeGlow } = useLocalSearchParams<{ dayId: string; productId?: string; edgeGlow?: string }>();
  const settleEdgeGlow = useEdgeGlowTransition((state) => state.settle);
  const { session } = useSession();
  const userId = session?.user.id;

  const programsQuery = useActivatedPrograms(userId);
  const program = (programsQuery.data ?? []).find((p) => p.productId === productId);
  const daysQuery = useCatalogProgramDays(productId, program?.userProgramId, program?.activatedAt);
  const day = (daysQuery.data ?? []).find((x) => x.id === Number(dayId));
  const referenceQuery = useExerciseReference(day?.programDayId, userId);
  const reference = referenceQuery.data ?? null;
  const compareConfig = useMemo(
    () => (reference ? { ...reference.config, view: reference.track.view } : null),
    [reference],
  );
  const drawnEdges = useMemo(() => (compareConfig ? edgesFor(compareConfig) : undefined), [compareConfig]);
  const previewSample = useMemo(
    () => selectPreviewSample(reference?.track ?? null, drawnEdges),
    [reference, drawnEdges],
  );
  const previewTimeMs = previewSample?.t ?? PREVIEW_TIME_MS;
  const previewPoints = useMemo(() => pointsFromSample(previewSample), [previewSample]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [counter, setCounter] = useState(COUNTDOWN);
  const [granted, setGranted] = useState(() => getCameraPermissionStatus() === 'granted');
  const [cameraState, setCameraState] = useState<PoseStatus | null>(null);
  const [userPoints, setUserPoints] = useState<PosePoint[]>([]);
  const [referencePoints, setReferencePoints] = useState<PosePoint[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [pane, setPane] = useState({ w: 0, h: 0 });
  const [summary, setSummary] = useState<ReturnType<Comparator['summary']> | null>(null);

  // The entrance light belongs to the way in and nothing else: it lingers a
  // moment on arrival, then goes out. The owner asked for exactly that on
  // 2026-10-31 — during the session it was one more thing moving while the
  // customer is trying to hold a pose.
  useEffect(() => {
    if (edgeGlow !== '1' || phase !== 'intro') return;
    const timer = setTimeout(settleEdgeGlow, 2_800);
    return () => clearTimeout(timer);
  }, [edgeGlow, phase, settleEdgeGlow]);

  // Starting early cuts the lingering light short rather than leaving it to
  // time out behind the countdown.
  useEffect(() => {
    if (phase !== 'intro') settleEdgeGlow();
  }, [phase, settleEdgeGlow]);

  useEffect(() => () => settleEdgeGlow(), [settleEdgeGlow]);

  // Whether the specialist's clip has a frame to show. Until it does the
  // pane is a black rectangle, which is what the owner was looking at
  // (2026-10-25) — the player only decodes once something asks it to.
  const [clipReady, setClipReady] = useState(false);
  // A still of the specialist, held over the player until the session
  // starts. `posterDone` is "we have finished trying", which is not the
  // same as having one: the spinner waits for the attempt, not the result,
  // or a clip neither generator can grab a still from would spin for ever.
  const [poster, setPoster] = useState<VideoThumbnail | string | null>(null);
  const [posterDone, setPosterDone] = useState(false);
  const player = useVideoPlayer(reference?.clipUrl ?? null, (instance) => {
    // A demonstration loops: it has no end to reach, and the customer's
    // attention belongs on the two bodies rather than on a progress bar.
    instance.loop = true;
    // WITH SOUND (owner, 2026-10-17). It was muted on the assumption that a
    // demonstration is a silent loop of one movement; day 1's reference is
    // a minute of the specialist talking the customer through several, and
    // muting that throws away half of what she is teaching.
    //
    // iOS still honours the silent switch, so a phone on silent shows the
    // movement and says nothing — which is the right way round: this screen
    // must work without sound, never only with it.
    // Muted until the session starts, so the frame that is nudged onto the
    // screen below arrives silently. Unmuted again in the countdown.
    instance.muted = true;
  });

  // The still, fetched once the clip is loaded enough to have one.
  //
  // This exists because the nudge below is not enough on its own. On
  // Android the player draws its own first frame and always did; on iPhone
  // the layer stayed black through every variation of play/pause/seek
  // (owner, 2026-10-30), so the pane no longer depends on the player having
  // drawn anything at all — it shows a picture it fetched itself, and gets
  // out of the way when the clip actually starts moving.
  //
  // Two generators, tried in order, because they fail for different
  // reasons: expo-video asks THIS player for the still (no second download,
  // and it works on a signed URL that is already open), while
  // expo-video-thumbnails opens the URL again with its own decoder.
  const clipUrl = reference?.clipUrl ?? null;
  useEffect(() => {
    if (!clipReady || !clipUrl) return;
    let alive = true;
    const generate = async () => {
      try {
        const [thumb] = await player.generateThumbnailsAsync([previewTimeMs / 1000], { maxWidth: 720 });
        if (thumb) {
          if (alive) setPoster(thumb);
          return;
        }
      } catch {
        // Falls through to the second generator.
      }
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(clipUrl, { time: previewTimeMs });
        if (alive) setPoster(uri);
      } catch {
        // No still to be had. The player is all there is, which is where
        // this screen stood before.
      }
    };
    void generate().finally(() => {
      if (alive) setPosterDone(true);
    });
    return () => {
      alive = false;
    };
  }, [clipReady, clipUrl, player, previewTimeMs]);

  // Read by the camera callback, which must not re-subscribe every frame.
  const clipTimeRef = useRef(0);
  const phaseRef = useRef<Phase>('intro');
  const comparatorRef = useRef<Comparator | null>(null);
  phaseRef.current = phase;

  // The first frame of the clip, and why it takes a nudge HERE rather than
  // in the setup callback above — which is where it used to be, and did
  // nothing. `setup` runs the instant the player is created, before the
  // clip has loaded anything to decode, so a play/pause there moves no
  // picture. Android's ExoPlayer draws frame 0 by itself once the item is
  // prepared, which is why only iPhone was affected: iOS's AVPlayer leaves
  // the layer blank until something asks it to move, so the spinner
  // finished and handed over to a black rectangle (owner, 2026-10-30).
  //
  // The seek is past 0 rather than at 0 on purpose: the player is already at
  // 0, and a seek to where it already is can be dropped as a no-op — which
  // would leave exactly the blank layer this is here to fix. It matches the
  // thumbnail and its pose sample, so the overlay does not jump on load.
  //
  // Once per player, and only while nobody has pressed Bắt đầu yet. This
  // event fires again every time the clip recovers from buffering, and
  // muting and pausing a session that is already running would be a worse
  // bug than the black pane.
  const firstFrameRef = useRef(false);
  useEffect(() => {
    firstFrameRef.current = false;
    setClipReady(false);
    setPoster(null);
    setPosterDone(false);
    const showFirstFrame = () => {
      setClipReady(true);
      if (firstFrameRef.current || phaseRef.current !== 'intro') return;
      firstFrameRef.current = true;
      player.muted = true;
      player.play();
      player.pause();
      player.currentTime = previewTimeMs / 1000;
    };
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') showFirstFrame();
    });
    // A cached clip can be ready before this effect runs, and the event for
    // that has already been and gone.
    if (player.status === 'readyToPlay') showFirstFrame();
    return () => subscription.remove();
  }, [player, previewTimeMs]);

  const paneAspect = pane.h > 0 ? pane.w / pane.h : 1;
  const paneAspectRef = useRef(1);
  paneAspectRef.current = paneAspect;

  // One config, used for both the comparison and for deciding which bones
  // are worth drawing — so the skeleton shows exactly the part of the body
  // the exercise is scored on, and nothing the colour could not explain.
  const displayedReferencePoints = phase === 'intro' || phase === 'countdown'
    ? previewPoints
    : referencePoints;

  useEffect(() => {
    comparatorRef.current = reference && compareConfig ? createComparator(reference.track, compareConfig) : null;
  }, [reference, compareConfig]);

  // The specialist's skeleton, read out of the track at whatever moment the
  // clip is actually at. Polled rather than pushed because expo-video has no
  // per-frame callback — and at 15Hz against a native property read, it does
  // not need one.
  useEffect(() => {
    if (phase !== 'running' || !reference) return;
    const timer = setInterval(() => {
      const ms = player.currentTime * 1000;
      clipTimeRef.current = ms;
      const sample = sampleAt(reference.track, ms);
      if (!sample) return;
      setReferencePoints(pointsFromSample(sample));
    }, 1000 / REFERENCE_HZ);
    return () => clearInterval(timer);
  }, [phase, player, reference]);

  const onPose = useCallback((frame: PoseFrame) => {
    const comparator = comparatorRef.current;
    const points = frame.points ?? [];
    if (phaseRef.current !== 'running' || !comparator) {
      setUserPoints(points);
      return;
    }
    const next = comparator.push(points, paneAspectRef.current, clipTimeRef.current);
    // One state write per frame, not two: at 12fps the difference is 12
    // extra renders a second of a tree with two SVGs in it.
    setUserPoints(points);
    setVerdict(next);
  }, []);

  const onCameraStatus = useCallback((event: { state: PoseStatus }) => setCameraState(event.state), []);

  // Countdown, then start the clip from the top so the first thing scored
  // is the first thing demonstrated.
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (counter <= 0) {
      comparatorRef.current?.reset();
      player.currentTime = 0;
      player.muted = false;
      player.play();
      setPhase('running');
      return;
    }
    const timer = setTimeout(() => setCounter((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, counter, player]);

  function stop() {
    player.pause();
    setSummary(comparatorRef.current?.summary() ?? null);
    setVerdict(null);
    setPhase('done');
  }

  async function begin() {
    // LiveKit owns the camera for the length of a call, and two owners is a
    // black preview and a confused customer. CallButton checks the same
    // way before starting one.
    if (getCallSession()) return;
    if (!granted) {
      const ok = await requestCameraPermission();
      setGranted(ok);
      if (!ok) return;
    }
    setCounter(COUNTDOWN);
    setPhase('countdown');
  }

  const edges = verdict?.edges as Partial<Record<string, PoseLevel>> | undefined;
  const hint = hintFor(verdict?.hint ?? null);
  const lost = phase === 'running' && verdict?.tracking === 'lost';

  /* Some of the body is out of shot — knees and ankles, usually, because
     the phone is propped too close. The engine already downgrades to
     'partial' and scores only what it can see; before today the screen
     said nothing, so the customer got a low score with no idea that half
     of them was off camera. */
  const partial = phase === 'running' && verdict?.tracking === 'partial';

  /* Nearly everything is out at once. That is not a limb to correct, it is
     the wrong position entirely — lying down while the demonstration sits
     up, or facing the wrong way. Telling somebody to "lower your left arm"
     when they are not even in the posture is noise, and it is what this
     screen did on 2026-10-19 while the tester sat at a desk and the
     specialist lay on a mat. */
  const offPose =
    phase === 'running' &&
    !!verdict &&
    verdict.measures.length >= 3 &&
    verdict.measures.filter((measure) => measure.level === 'bad').length >=
      Math.ceil(verdict.measures.length * 0.75);

  const body = useMemo(() => {
    if (!isPoseSupported() || !isPoseCameraAvailable()) return 'unsupported' as const;
    if (referenceQuery.isLoading || programsQuery.isLoading || daysQuery.isLoading) return 'loading' as const;
    if (!day) return 'missing' as const;
    if (!reference || !reference.clipUrl) return 'no-reference' as const;
    return 'ready' as const;
  }, [referenceQuery.isLoading, programsQuery.isLoading, daysQuery.isLoading, day, reference]);

  // Narrowed for TypeScript as much as for the reader: past this point the
  // day and its reference both exist.
  if (body !== 'ready' || !reference || !reference.clipUrl) {
    return (
      <ScreenContainer tone="glass">
        <BackBar tone="glass" onBack={() => router.back()} title={t('trainTitle')} />
        <View style={styles.center}>
          {body === 'loading' ? (
            <ActivityIndicator color={homeGlassColors.tick} />
          ) : (
            <Text style={[theme.type.body, styles.message, { color: homeGlassColors.textMuted }]}>
              {body === 'unsupported' ? t('trainUnavailable') : t('trainNoReference')}
            </Text>
          )}
        </View>
      </ScreenContainer>
    );
  }

  return (
    // 'bottom' as well as 'top': without it the action button sits UNDER
    // Android's navigation bar. Seen on a Galaxy A12, 2026-10-19 — the
    // gesture bar was drawn across "Dừng lại", which is the one control
    // somebody mid-exercise needs to be able to hit.
    <ScreenContainer tone="glass" edges={['top', 'bottom']}>
      <BackBar tone="glass" onBack={() => router.back()} title={t('trainTitle')} />

      {/* The specialist. Letterboxed to the clip's own shape so the
          precomputed keypoints land exactly on the body — `contentFit`
          anything but "contain" would crop the frame the track was
          measured in. */}
      <View style={[styles.referencePane, { aspectRatio: reference.track.frameWidth / reference.track.frameHeight }]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={false}
          contentFit="contain"
        />
        {/* The still, over the player and under the skeleton. It goes away
            when the clip starts moving — by then the player has frames of
            its own, and at `done` it is paused on the last one. Same
            `contain` as the VideoView, so the two line up exactly. */}
        {poster && (phase === 'intro' || phase === 'countdown') ? (
          <Image source={poster} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
        ) : null}
        <ReferenceOverlay points={displayedReferencePoints} only={drawnEdges} />
        {!clipReady || !posterDone ? (
          // Something to look at while the clip loads, rather than a black
          // rectangle with a label floating on it.
          <View style={[styles.cover, { backgroundColor: homeGlassColors.surfaceRaised }]}>
            <ActivityIndicator color={homeGlassColors.tick} />
            <Text style={[theme.type.caption, styles.message, { color: homeGlassColors.textMuted }]}>
              {t('loading')}
            </Text>
          </View>
        ) : null}
        <View style={[styles.tag, { backgroundColor: homeGlassColors.surface }]}>
          <Text style={[theme.type.caption, { color: homeGlassColors.textMuted }]}>{t('trainSpecialist')}</Text>
        </View>
      </View>

      {/* You. */}
      <View
        style={[styles.cameraPane, { backgroundColor: homeGlassColors.surfaceRaised }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setPane({ w: width, h: height });
        }}
      >
        <PoseCamera
          active={phase === 'countdown' || phase === 'running'}
          facing="front"
          targetFps={12}
          onPose={onPose}
          onPoseStatus={onCameraStatus}
          style={StyleSheet.absoluteFill}
        />
        <PoseSkeleton
          points={userPoints}
          width={pane.w}
          height={pane.h}
          levels={edges}
          only={drawnEdges}
          level={phase === 'running' ? 'ok' : 'reference'}
        />

        {phase === 'intro' ? (
          <View style={[styles.cover, { backgroundColor: homeGlassColors.sky[4] }]}>
            <Icon name="user" size={28} color={homeGlassColors.tick} />
            <Text style={[theme.type.bodyStrong, styles.message, { color: homeGlassColors.text }]}>
              {reference.track.view === 'side' ? t('trainSetupSide') : t('trainSetupFront')}
            </Text>
            <Text style={[theme.type.caption, styles.message, { color: homeGlassColors.textMuted }]}>
              {t('trainPrivacy')}
            </Text>
          </View>
        ) : null}

        {phase === 'countdown' ? (
          <View style={styles.cover}>
            <Text style={[theme.type.h1, { color: homeGlassColors.tick }]}>{counter}</Text>
            <Text style={[theme.type.caption, styles.message, { color: homeGlassColors.textMuted }]}>
              {t('trainGetReady')}
            </Text>
          </View>
        ) : null}

        {/* No banner over the camera. The footer already carries one line of
            advice, in bold, in the place the customer is already reading —
            and when the line was "we cannot see you" the screen printed the
            identical sentence twice, once here and once below (seen on the
            device, 2026-10-19). One message, one place. */}

        {cameraState === 'denied' ? (
          <View style={[styles.cover, { backgroundColor: homeGlassColors.sky[4] }]}>
            <Text style={[theme.type.body, styles.message, { color: homeGlassColors.textMuted }]}>
              {t('trainCameraDenied')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {phase === 'running' ? (
          <View style={styles.readout}>
            <View style={styles.score}>
              {/* A dash, not a zero, when nobody is in shot. The engine
                  reports 0 for an unscorable frame, and printing that under
                  "điểm" tells somebody who simply stepped out of frame that
                  they scored nothing — a verdict on a measurement that was
                  never taken. */}
              <Text style={[theme.type.h2, { color: lost ? homeGlassColors.textFaint : scoreColour(verdict?.score) }]}>
                {lost || verdict === null ? '—' : verdict.score}
              </Text>
              {lost ? null : (
                <Text style={[theme.type.caption, { color: homeGlassColors.textFaint }]}>
                  {t('trainScoreUnit')}
                </Text>
              )}
            </View>
            <Text style={[theme.type.bodyStrong, styles.hint, { color: homeGlassColors.text }]} numberOfLines={2}>
              {lost
                ? t('trainLost')
                : partial
                  ? t('trainPartial')
                  : offPose
                    ? t('trainOffPose')
                    : hint
                      ? t(hint.key, hint.side ? { side: t(hint.side === 'left' ? 'poseSideLeft' : 'poseSideRight') } : undefined)
                      : t('trainOnTrack')}
            </Text>
          </View>
        ) : null}

        {phase === 'done' && summary ? (
          <View style={styles.readout}>
            <Text style={[theme.type.h2, { color: homeGlassColors.text }]}>
              {t('trainSummaryGood', { percent: Math.round(summary.goodRatio * 100) })}
            </Text>
            {summary.worst ? (
              <Text style={[theme.type.caption, styles.hint, { color: homeGlassColors.textMuted }]}>
                {t('trainSummaryWorst', { part: t(partOf(summary.worst)) })}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={phase === 'running' ? stop : begin}
          style={[styles.action, { backgroundColor: homeGlassColors.tick, borderRadius: theme.radius.md }]}
        >
          <Icon name={phase === 'running' ? 'square' : 'play'} size={18} color="#fff" />
          <Text style={[theme.type.button, { color: homeGlassColors.text }]}>
            {phase === 'running' ? t('trainStop') : phase === 'done' ? t('trainAgain') : t('trainStart')}
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

/** The specialist's skeleton. Its own component so the reference pane does
 * not re-render when the customer's does — the two update at different
 * rates and for different reasons. */
function ReferenceOverlay({ points, only }: { points: PosePoint[]; only?: Set<string> }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
    >
      <PoseSkeleton points={points} width={size.w} height={size.h} only={only} level="reference" />
    </View>
  );
}

function pointsFromSample(sample: TrackSample | null): PosePoint[] {
  if (!sample) return [];
  const points: PosePoint[] = [];
  for (const [key, value] of Object.entries(sample.p)) {
    if (!value) continue;
    // Track coordinates are normalized against the clip frame; the video,
    // thumbnail and overlay all use that same aspect ratio.
    points.push({ k: key as PosePoint['k'], x: value[0], y: value[1], c: value[2] });
  }
  return points;
}

function selectPreviewSample(track: ExerciseReference['track'] | null, only?: Set<string>): TrackSample | null {
  if (!track) return null;
  // The first video frame can have no detected joints. Choose the closest
  // early frame that actually draws a scored bone, then request its matching
  // thumbnail. This keeps preview image and keypoints in sync.
  let nearest: TrackSample | null = null;
  for (const sample of track.samples) {
    if (sample.t > 3_000) break;
    if (!POSE_EDGES.some(([from, to]) =>
      (!only || only.has(`${from}-${to}`)) &&
      (sample.p[from]?.[2] ?? 0) >= POSE_HIDDEN &&
      (sample.p[to]?.[2] ?? 0) >= POSE_HIDDEN,
    )) continue;
    if (!nearest || Math.abs(sample.t - PREVIEW_TIME_MS) < Math.abs(nearest.t - PREVIEW_TIME_MS)) {
      nearest = sample;
    }
  }
  return nearest ?? sampleAt(track, PREVIEW_TIME_MS);
}

function scoreColour(score: number | undefined): string {
  if (score === undefined) return poseColors.weak;
  if (score >= 80) return poseColors.ok;
  if (score >= 60) return poseColors.warn;
  return poseColors.bad;
}

const styles = StyleSheet.create({
  referencePane: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  cameraPane: { flex: 1, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cover: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  message: { textAlign: 'center' },
  tag: { position: 'absolute', left: 10, top: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  footer: { padding: 20, gap: 12 },
  readout: { alignItems: 'center', gap: 2 },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hint: { textAlign: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
});
