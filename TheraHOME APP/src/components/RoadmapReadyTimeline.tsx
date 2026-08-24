// "Personalized Roadmap Animation" for the ready-roadmap screen (shown
// right after the onboarding 0→100% analyzing screen) — same public API
// as before (topLabels/bottomLabels, 3 milestones), rebuilt per an
// explicit premium-health-tech animation brief (see CLAUDE.md). Only this
// component changed; the screen around it is untouched.
//
// Sequence on mount: the line draws left→right over DRAW_DURATION via a
// real strokeDashoffset animation (not a clip-width illusion), a bright
// particle chases the drawing tip, and each of the 3 nodes pops in
// (scale + ripple + its label fading/sliding up) exactly when the line
// reaches it — timed by that node's actual cumulative arc length divided
// by the path's total length, not a guessed fraction. Once the initial
// sequence finishes, everything settles — nodes never keep pulsing — and
// only the particle re-traces the path very lightly every ~4.5s as an
// ambient "system is alive" cue. All of it is reanimated shared values on
// the UI thread; nothing re-renders React state per frame.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { hapticHoverTick } from '@/lib/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);

export interface RoadmapReadyTimelineProps {
  topLabels: [string, string, string];
  bottomLabels: [string, string, string];
}

const H = 96;
const PAD = 10;
const DRAW_DURATION = 1400; // 1.2-1.6s spec

const LINE_START = '#FFB13B';
const LINE_MID = '#18A7E0';
const LINE_END = '#078BFF';
const PARTICLE_GLOW = '#00A8FF';

// Fractional [x, y] positions (0-1 of chart width/height) for the sparse
// background dots — a handful, low opacity, nowhere near a starfield.
const BG_DOTS: [number, number][] = [
  [0.16, 0.22],
  [0.38, 0.6],
  [0.58, 0.18],
  [0.74, 0.5],
  [0.88, 0.28],
];

type Point = [number, number];
interface BezierSegment { p0: Point; c1: Point; c2: Point; p3: Point }

// Same Catmull-Rom → cubic-bezier smoothing the previous version used,
// restructured to also drive length/lookup-table math below instead of
// only producing a `d` string.
function catmullRomSegments(pts: Point[]): BezierSegment[] {
  const segments: BezierSegment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    segments.push({ p0: p1, c1, c2, p3: p2 });
  }
  return segments;
}

function sampleCubic(seg: BezierSegment, steps: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt ** 3 * seg.p0[0] + 3 * mt ** 2 * t * seg.c1[0] + 3 * mt * t ** 2 * seg.c2[0] + t ** 3 * seg.p3[0];
    const y = mt ** 3 * seg.p0[1] + 3 * mt ** 2 * t * seg.c1[1] + 3 * mt * t ** 2 * seg.c2[1] + t ** 3 * seg.p3[1];
    out.push([x, y]);
  }
  return out;
}

interface PathGeometry {
  d: string;
  areaD: string;
  totalLength: number;
  /** Cumulative arc length at [day1, day7, day14] — day1 is always 0. */
  nodeLengths: [number, number, number];
  points: [Point, Point, Point];
  lengthTable: number[];
  xTable: number[];
  yTable: number[];
}

/** Builds the curve (2 bezier segments + a straight tail past day14, same
 * shape as before) and, in the same pass, a piecewise-linear length→(x,y)
 * lookup table used to time node activation and to place the traveling
 * particle at any progress 0-1 along the real path. */
function buildGeometry(width: number): PathGeometry {
  const pts: [Point, Point, Point] = [
    [PAD, 12],
    [width / 2, 36],
    [width - PAD - 30, H - PAD - 18],
  ];
  const segments = catmullRomSegments(pts);
  const tailEnd: Point = [width - PAD, pts[2][1]];

  const lengthTable: number[] = [0];
  const xTable: number[] = [pts[0][0]];
  const yTable: number[] = [pts[0][1]];
  let cumulative = 0;
  let cursor: Point = pts[0];
  const nodeLengths: number[] = [0];

  for (const seg of segments) {
    const samples = sampleCubic(seg, 24);
    for (let i = 1; i < samples.length; i++) {
      const point = samples[i];
      cumulative += Math.hypot(point[0] - cursor[0], point[1] - cursor[1]);
      cursor = point;
      lengthTable.push(cumulative);
      xTable.push(point[0]);
      yTable.push(point[1]);
    }
    nodeLengths.push(cumulative);
  }

  const tailSteps = 6;
  for (let i = 1; i <= tailSteps; i++) {
    const t = i / tailSteps;
    const point: Point = [pts[2][0] + (tailEnd[0] - pts[2][0]) * t, pts[2][1] + (tailEnd[1] - pts[2][1]) * t];
    cumulative += Math.hypot(point[0] - cursor[0], point[1] - cursor[1]);
    cursor = point;
    lengthTable.push(cumulative);
    xTable.push(point[0]);
    yTable.push(point[1]);
  }

  const d = `M ${pts[0][0]} ${pts[0][1]} C ${segments[0].c1[0]} ${segments[0].c1[1]}, ${segments[0].c2[0]} ${segments[0].c2[1]}, ${segments[0].p3[0]} ${segments[0].p3[1]} C ${segments[1].c1[0]} ${segments[1].c1[1]}, ${segments[1].c2[0]} ${segments[1].c2[1]}, ${segments[1].p3[0]} ${segments[1].p3[1]} L ${tailEnd[0]} ${tailEnd[1]}`;
  const areaD = `${d} L ${tailEnd[0]} ${H} L ${pts[0][0]} ${H} Z`;

  return {
    d,
    areaD,
    totalLength: cumulative,
    nodeLengths: [nodeLengths[0], nodeLengths[1], nodeLengths[2]],
    points: pts,
    lengthTable,
    xTable,
    yTable,
  };
}

function RoadmapNode({ x, y, color, delay }: { x: number; y: number; color: string; delay: number }) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
    scale.value = withDelay(delay, withSequence(withTiming(1.15, { duration: 160 }), withTiming(1, { duration: 140 })));
    rippleOpacity.value = withDelay(delay, withSequence(withTiming(0.5, { duration: 60 }), withTiming(0, { duration: 420 })));
    rippleScale.value = withDelay(delay, withTiming(2.4, { duration: 480, easing: Easing.out(Easing.cubic) }));
    glowOpacity.value = withDelay(delay, withTiming(0.22, { duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTap() {
    hapticHoverTick();
    scale.value = withSequence(withTiming(1.08, { duration: 90 }), withTiming(1, { duration: 140 }));
    glowOpacity.value = withSequence(withTiming(0.55, { duration: 120 }), withTiming(0.22, { duration: 240 }));
  }

  const nodeStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const rippleStyle = useAnimatedStyle(() => ({ opacity: rippleOpacity.value, transform: [{ scale: rippleScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <Pressable onPress={handleTap} style={[styles.nodeHit, { left: x - 18, top: y - 18 }]} hitSlop={4}>
      <Animated.View style={[styles.nodeGlow, glowStyle, { backgroundColor: color }]} />
      <Animated.View style={[styles.nodeRipple, rippleStyle, { borderColor: color }]} />
      <Animated.View style={[styles.nodeDot, nodeStyle, { backgroundColor: color }]} />
    </Pressable>
  );
}

function RoadmapLabel({ text, delay, style }: { text: string; delay: number; style: object }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(6);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 260 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));
  return <Animated.Text style={[style, animatedStyle]}>{text}</Animated.Text>;
}

/** Bright core + soft blue glow + a short trailing comet — travels along
 * the real path geometry via a length→(x,y) lookup table (piecewise-
 * linear `interpolate`), not an approximated straight line. */
function RoadmapParticle({ geometry, progress, opacity }: { geometry: PathGeometry; progress: SharedValue<number>; opacity: SharedValue<number> }) {
  function resolve(p: number) {
    'worklet';
    const clamped = Math.max(0, Math.min(1, p));
    const targetLength = clamped * geometry.totalLength;
    return {
      x: interpolate(targetLength, geometry.lengthTable, geometry.xTable),
      y: interpolate(targetLength, geometry.lengthTable, geometry.yTable),
    };
  }

  const outerGlowProps = useAnimatedProps(() => {
    const { x, y } = resolve(progress.value);
    return { cx: x, cy: y, opacity: opacity.value * 0.3 };
  });
  const innerGlowProps = useAnimatedProps(() => {
    const { x, y } = resolve(progress.value);
    return { cx: x, cy: y, opacity: opacity.value * 0.55 };
  });
  const coreProps = useAnimatedProps(() => {
    const { x, y } = resolve(progress.value);
    return { cx: x, cy: y, opacity: opacity.value };
  });
  const trail0Props = useAnimatedProps(() => {
    const { x, y } = resolve(progress.value - 0.018);
    return { cx: x, cy: y, opacity: opacity.value * 0.35 };
  });
  const trail1Props = useAnimatedProps(() => {
    const { x, y } = resolve(progress.value - 0.036);
    return { cx: x, cy: y, opacity: opacity.value * 0.2 };
  });
  const trail2Props = useAnimatedProps(() => {
    const { x, y } = resolve(progress.value - 0.054);
    return { cx: x, cy: y, opacity: opacity.value * 0.1 };
  });

  return (
    <>
      <AnimatedCircle r={10} fill={PARTICLE_GLOW} animatedProps={outerGlowProps} />
      <AnimatedCircle r={6} fill={PARTICLE_GLOW} animatedProps={innerGlowProps} />
      <AnimatedCircle r={2} fill="#fff" animatedProps={trail0Props} />
      <AnimatedCircle r={1.6} fill="#fff" animatedProps={trail1Props} />
      <AnimatedCircle r={1.2} fill="#fff" animatedProps={trail2Props} />
      <AnimatedCircle r={3} fill="#fff" animatedProps={coreProps} />
    </>
  );
}

export function RoadmapReadyTimeline({ topLabels, bottomLabels }: RoadmapReadyTimelineProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(300);
  const geometry = useMemo(() => buildGeometry(width), [width]);
  const hasStarted = useRef(false);

  const lineProgress = useSharedValue(0);
  const particleProgress = useSharedValue(0);
  const particleOpacity = useSharedValue(0);
  const bgOpacity = useSharedValue(0);

  const day1Delay = 60;
  const day7Delay = 60 + (geometry.nodeLengths[1] / geometry.totalLength) * DRAW_DURATION;
  const day14Delay = 60 + (geometry.nodeLengths[2] / geometry.totalLength) * DRAW_DURATION;

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    lineProgress.value = withDelay(day1Delay, withTiming(1, { duration: DRAW_DURATION, easing: Easing.out(Easing.cubic) }));
    bgOpacity.value = withDelay(day1Delay, withTiming(1, { duration: DRAW_DURATION, easing: Easing.out(Easing.cubic) }));

    // Initial run chases the drawing tip, then — after the whole sequence
    // settles — a very light ambient re-run every ~4.5s, on a single
    // chained sequence per value so the two shared values never drift
    // apart from each other across repeats.
    particleProgress.value = withDelay(
      day1Delay,
      withSequence(
        withTiming(1, { duration: DRAW_DURATION, easing: Easing.out(Easing.cubic) }),
        withDelay(700, withRepeat(withSequence(withTiming(0, { duration: 0 }), withDelay(3800, withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }))), -1)),
      ),
    );
    particleOpacity.value = withDelay(
      day1Delay,
      withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(1, { duration: Math.max(0, DRAW_DURATION - 450) }),
        withTiming(0, { duration: 300 }),
        withDelay(
          700,
          withRepeat(withSequence(withDelay(3800, withTiming(0.7, { duration: 150 })), withTiming(0.7, { duration: 400 }), withTiming(0, { duration: 150 })), -1),
        ),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: (1 - lineProgress.value) * geometry.totalLength }));
  const areaClipProps = useAnimatedProps(() => ({ width: lineProgress.value * width }));
  const bgDotsProps = useAnimatedProps(() => ({ opacity: bgOpacity.value * 0.4 }));

  return (
    <View>
      <View style={styles.topLabelRow}>
        <RoadmapLabel text={topLabels[0]} delay={day1Delay} style={[theme.type.captionSm, { color: theme.colors.textSecondary, fontFamily: theme.fontFamily.semiBold }]} />
        <RoadmapLabel text={topLabels[1]} delay={day7Delay} style={[theme.type.captionSm, { color: theme.colors.textSecondary, fontFamily: theme.fontFamily.semiBold }]} />
        <RoadmapLabel text={topLabels[2]} delay={day14Delay} style={[theme.type.captionSm, { color: theme.colors.textSecondary, fontFamily: theme.fontFamily.semiBold }]} />
      </View>
      <View
        style={{ height: H }}
        onLayout={(e) => {
          const w = Math.floor(e.nativeEvent.layout.width);
          if (w > 0 && w !== width) setWidth(w);
        }}
      >
        <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
          <Defs>
            <LinearGradient id="readyLineGrad" x1="0" y1="0" x2={width} y2="0" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor={LINE_START} />
              <Stop offset="50%" stopColor={LINE_MID} />
              <Stop offset="100%" stopColor={LINE_END} />
            </LinearGradient>
            <LinearGradient id="readyAreaGrad" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#00A8FF" stopOpacity={0} />
              <Stop offset="55%" stopColor="#00A8FF" stopOpacity={0.06} />
              <Stop offset="100%" stopColor="#078BFF" stopOpacity={0.1} />
            </LinearGradient>
            <ClipPath id="readyAreaReveal">
              <AnimatedRect x={0} y={0} height={H} animatedProps={areaClipProps} />
            </ClipPath>
          </Defs>

          <AnimatedG animatedProps={bgDotsProps}>
            {BG_DOTS.map(([fx, fy], i) => (
              <Circle key={i} cx={fx * width} cy={fy * H} r={1} fill={theme.colors.textMuted} />
            ))}
          </AnimatedG>

          <Path d={geometry.areaD} fill="url(#readyAreaGrad)" stroke="none" clipPath="url(#readyAreaReveal)" />
          <AnimatedPath
            d={geometry.d}
            fill="none"
            stroke="url(#readyLineGrad)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={geometry.totalLength}
            animatedProps={lineProps}
          />

          <RoadmapParticle geometry={geometry} progress={particleProgress} opacity={particleOpacity} />
        </Svg>

        <RoadmapNode x={geometry.points[0][0]} y={geometry.points[0][1]} color={LINE_START} delay={day1Delay} />
        <RoadmapNode x={geometry.points[1][0]} y={geometry.points[1][1]} color={LINE_MID} delay={day7Delay} />
        <RoadmapNode x={geometry.points[2][0]} y={geometry.points[2][1]} color={LINE_END} delay={day14Delay} />
      </View>
      <View style={styles.bottomLabelRow}>
        <RoadmapLabel text={bottomLabels[0]} delay={day1Delay} style={[theme.type.captionSm, { color: theme.colors.textMuted }]} />
        <RoadmapLabel text={bottomLabels[1]} delay={day7Delay} style={[theme.type.captionSm, { color: theme.colors.textMuted }]} />
        <RoadmapLabel text={bottomLabels[2]} delay={day14Delay} style={[theme.type.captionSm, { color: theme.colors.textMuted }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bottomLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  nodeHit: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeGlow: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  nodeRipple: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  nodeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
