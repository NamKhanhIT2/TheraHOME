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
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme, poseColors } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms, useCatalogProgramDays } from '@/hooks/usePrograms';
import { useExerciseReference } from '@/hooks/useExerciseReference';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { PoseSkeleton, type PoseLevel } from '@/components/pose/PoseSkeleton';
import { getCallSession } from '@/lib/callSession';
import { PoseCamera, isPoseCameraAvailable } from '@/components/pose/PoseCamera';
import {
  getCameraPermissionStatus,
  isPoseSupported,
  requestCameraPermission,
  type PoseFrame,
  type PosePoint,
  type PoseStatus,
} from '@/lib/pose';
import { createComparator, edgesFor, type Comparator, type Verdict } from '@/lib/poseCompare';
import { sampleAt } from '@/lib/poseTrack';
import { hintFor, partOf } from '@/lib/poseHints';

/** The reference skeleton is redrawn at the track's own rate. Faster would
 * draw the same sample twice; slower would make the specialist stutter next
 * to a customer moving smoothly. */
const REFERENCE_HZ = 15;

/** Seconds of "get into position" before anything is scored. Long enough to
 * step back and put the phone down, short enough not to be a wait. */
const COUNTDOWN = 5;

type Phase = 'intro' | 'countdown' | 'running' | 'done';

export default function TrainScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { dayId, productId } = useLocalSearchParams<{ dayId: string; productId?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const programsQuery = useActivatedPrograms(userId);
  const program = (programsQuery.data ?? []).find((p) => p.productId === productId);
  const daysQuery = useCatalogProgramDays(productId, program?.userProgramId, program?.activatedAt);
  const day = (daysQuery.data ?? []).find((x) => x.id === Number(dayId));
  const referenceQuery = useExerciseReference(day?.programDayId);
  const reference = referenceQuery.data ?? null;

  const [phase, setPhase] = useState<Phase>('intro');
  const [counter, setCounter] = useState(COUNTDOWN);
  const [granted, setGranted] = useState(() => getCameraPermissionStatus() === 'granted');
  const [cameraState, setCameraState] = useState<PoseStatus | null>(null);
  const [userPoints, setUserPoints] = useState<PosePoint[]>([]);
  const [referencePoints, setReferencePoints] = useState<PosePoint[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [pane, setPane] = useState({ w: 0, h: 0 });
  const [summary, setSummary] = useState<ReturnType<Comparator['summary']> | null>(null);

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
    instance.muted = false;
  });

  // Read by the camera callback, which must not re-subscribe every frame.
  const clipTimeRef = useRef(0);
  const phaseRef = useRef<Phase>('intro');
  const comparatorRef = useRef<Comparator | null>(null);
  phaseRef.current = phase;

  const paneAspect = pane.h > 0 ? pane.w / pane.h : 1;
  const paneAspectRef = useRef(1);
  paneAspectRef.current = paneAspect;

  // One config, used for both the comparison and for deciding which bones
  // are worth drawing — so the skeleton shows exactly the part of the body
  // the exercise is scored on, and nothing the colour could not explain.
  const compareConfig = useMemo(
    () => (reference ? { ...reference.config, view: reference.track.view } : null),
    [reference],
  );
  const drawnEdges = useMemo(() => (compareConfig ? edgesFor(compareConfig) : undefined), [compareConfig]);

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
      setReferencePoints(
        Object.entries(sample.p).map(([key, value]) => ({
          k: key as PosePoint['k'],
          // The track is normalized against the CLIP's frame and drawn into
          // a pane of the same shape (the video is letterboxed to its own
          // aspect), so these go straight through.
          x: value![0],
          y: value![1],
          c: value![2],
        })),
      );
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
      <ScreenContainer>
        <BackBar onBack={() => router.back()} title={t('trainTitle')} />
        <View style={styles.center}>
          {body === 'loading' ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text style={[theme.type.body, styles.message, { color: theme.colors.textSecondary }]}>
              {body === 'unsupported' ? t('trainUnavailable') : t('trainNoReference')}
            </Text>
          )}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top']}>
      <BackBar onBack={() => router.back()} title={t('trainTitle')} />

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
        <ReferenceOverlay points={referencePoints} only={drawnEdges} />
        <View style={[styles.tag, { backgroundColor: theme.colors.bgCard }]}>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{t('trainSpecialist')}</Text>
        </View>
      </View>

      {/* You. */}
      <View
        style={[styles.cameraPane, { backgroundColor: theme.colors.bgCardAlt }]}
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
          <View style={[styles.cover, { backgroundColor: theme.colors.bgApp }]}>
            <Icon name="user" size={28} color={theme.colors.primary} />
            <Text style={[theme.type.bodyStrong, styles.message, { color: theme.colors.textPrimary }]}>
              {reference.track.view === 'side' ? t('trainSetupSide') : t('trainSetupFront')}
            </Text>
            <Text style={[theme.type.caption, styles.message, { color: theme.colors.textSecondary }]}>
              {t('trainPrivacy')}
            </Text>
          </View>
        ) : null}

        {phase === 'countdown' ? (
          <View style={styles.cover}>
            <Text style={[theme.type.h1, { color: theme.colors.primary }]}>{counter}</Text>
            <Text style={[theme.type.caption, styles.message, { color: theme.colors.textSecondary }]}>
              {t('trainGetReady')}
            </Text>
          </View>
        ) : null}

        {lost ? (
          <View style={[styles.banner, { backgroundColor: theme.colors.bgCard }]}>
            <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{t('trainLost')}</Text>
          </View>
        ) : null}

        {cameraState === 'denied' ? (
          <View style={[styles.cover, { backgroundColor: theme.colors.bgApp }]}>
            <Text style={[theme.type.body, styles.message, { color: theme.colors.textSecondary }]}>
              {t('trainCameraDenied')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {phase === 'running' ? (
          <View style={styles.readout}>
            <Text style={[theme.type.h2, { color: scoreColour(verdict?.score) }]}>
              {verdict?.score ?? '—'}
            </Text>
            <Text style={[theme.type.caption, styles.hint, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {lost
                ? t('trainLost')
                : hint
                  ? t(hint.key, hint.side ? { side: t(hint.side === 'left' ? 'poseSideLeft' : 'poseSideRight') } : undefined)
                  : t('trainOnTrack')}
            </Text>
          </View>
        ) : null}

        {phase === 'done' && summary ? (
          <View style={styles.readout}>
            <Text style={[theme.type.h2, { color: theme.colors.textPrimary }]}>
              {t('trainSummaryGood', { percent: Math.round(summary.goodRatio * 100) })}
            </Text>
            {summary.worst ? (
              <Text style={[theme.type.caption, styles.hint, { color: theme.colors.textSecondary }]}>
                {t('trainSummaryWorst', { part: t(partOf(summary.worst)) })}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={phase === 'running' ? stop : begin}
          style={[styles.action, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}
        >
          <Icon name={phase === 'running' ? 'square' : 'play'} size={18} color="#fff" />
          <Text style={[theme.type.button, { color: '#fff' }]}>
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
  banner: { position: 'absolute', left: 16, right: 16, bottom: 16, padding: 10, borderRadius: 12, alignItems: 'center' },
  tag: { position: 'absolute', left: 10, top: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  footer: { padding: 20, gap: 12 },
  readout: { alignItems: 'center', gap: 2 },
  hint: { textAlign: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
});
