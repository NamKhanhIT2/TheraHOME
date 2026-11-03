import React, { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { homeGlassColors } from '@/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Geometry straight from the prototype (home-oura.jsx's ArcGauge): a shallow
// 70° slice off the top of a big circle whose centre sits far below the
// visible band, which is why the arc looks almost flat.
const W = 340;
const CX = W / 2;
const CY = 210;
const R = 175;
const A0 = -125;
const A1 = -55;
const BAND_HEIGHT = 80;
/** The prototype draws into an 80px-tall viewBox and then shifts the whole
 * group up by 28 to crop the arc where it wants it. */
// Leave enough air above the arc for the decorative beads. At -28 the old
// beads crossed the viewBox edge: the middle one vanished and the outer two
// were clipped into little downward triangles on the phone.
const LIFT = -18;
const ARC_LENGTH = (R * (A1 - A0) * Math.PI) / 180;

/** Module-scope geometry helper. Everything it produces is static; the live
 * progress animation only changes the path's dash offset on the UI thread. */
function pointAt(angle: number, radius: number = R): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
}

function arcPath(from: number, to: number): string {
  const [x0, y0] = pointAt(from);
  const [x1, y1] = pointAt(to);
  return `M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1}`;
}

const TRACK = arcPath(A0, A1);
// Four small beads float above the track like the new reference. They are
// decoration, not a scale; the end labels still carry the real 0 and max.
// Radial placement preserves the same gap all the way around the curve.
const TICKS = [0.16, 0.36, 0.58, 0.78].map((f) => {
  const [x, y] = pointAt(A0 + (A1 - A0) * f, R + 12);
  return { x, y };
});
const [LABEL0_X, LABEL0_Y] = pointAt(A0 - 4.5, R - 2);
const [LABEL1_X, LABEL1_Y] = pointAt(A1 + 4.5, R - 2);

export interface ArcGaugeProps {
  /** Days reached. */
  value: number;
  /** Days reachable — the gauge's full sweep. */
  max: number;
  /**
   * Whether `value`/`max` are settled.
   *
   * `useAccessibleProgress` reports PROVISIONAL numbers until the phase-lock
   * and purchase queries land — on this account 28 reachable days before, 14
   * after. Animating on those meant the gauge was handed four different
   * targets on every launch (0, 0, 0.5, 1), restarting a 1.2s fill each time,
   * so the head sat near zero for a good while and then jumped about. It
   * holds empty until this is true, then fills once.
   */
  ready?: boolean;
}

/**
 * The hero's progress arc: how far through the programme today is.
 *
 * Mirrors the prototype, which tweens the arc's `d` attribute via a CSS
 * transition. React Native cannot interpolate a path string, so the sweep is
 * drawn by moving a dash offset along the full track instead — same picture,
 * and it runs on the UI thread.
 */
export function ArcGauge({ value, max, ready = true }: ArcGaugeProps) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const target = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  useEffect(() => {
    // Nothing to chase while the numbers are still provisional.
    if (!ready) return;
    if (reduceMotion) {
      progress.value = target;
      return;
    }
    // The prototype waits 120ms before starting so the arc visibly fills
    // rather than arriving already full.
    progress.value = withTiming(target, { duration: 1200, easing: Easing.bezier(0.3, 0.7, 0.2, 1) });
  }, [progress, ready, reduceMotion, target]);

  // Only the hairline itself animates. The previous concentric bloom layers
  // made a nominally thin stroke read as a thick glowing tube on the phone.
  const sweepProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LENGTH * (1 - progress.value),
  }));
  const dash = `${ARC_LENGTH} ${ARC_LENGTH}`;

  return (
    <Svg width="100%" height={BAND_HEIGHT} viewBox={`0 0 ${W} ${BAND_HEIGHT}`}>
      <Defs>
        <LinearGradient id="arcFade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={homeGlassColors.text} stopOpacity={0.08} />
          <Stop offset="0.3" stopColor={homeGlassColors.text} stopOpacity={0.28} />
          <Stop offset="0.56" stopColor={homeGlassColors.text} stopOpacity={0.58} />
          <Stop offset="0.78" stopColor={homeGlassColors.text} stopOpacity={0.94} />
          <Stop offset="1" stopColor={homeGlassColors.text} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <G translateY={LIFT}>
        <Path d={TRACK} fill="none" stroke={homeGlassColors.gaugeTrack} strokeWidth={0.75} strokeLinecap="round" opacity={0.34} />
        <AnimatedPath
          d={TRACK}
          fill="none"
          // The arc runs left to right and fills from the left, so a
          // horizontal gradient is a fade from its tail to its head: thin
          // and faint where it started, full strength at the point
          // (owner, 2026-10-25).
          stroke="url(#arcFade)"
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeDasharray={dash}
          animatedProps={sweepProps}
        />
        {TICKS.map((tick, index) => (
          <Circle key={index} cx={tick.x} cy={tick.y} r={1.35} fill={homeGlassColors.text} opacity={0.64} />
        ))}
        {/* A scale needs both ends to mean something. While the programme's
            length is still unknown the gauge shows the track alone rather
            than a "0" against nothing. */}
        {max > 0 ? (
          <>
            <SvgText
              x={LABEL0_X}
              y={LABEL0_Y}
              fontSize={11}
              fill={homeGlassColors.textSoft}
              textAnchor="middle"
              transform={`rotate(${A0 - 4.5 + 90} ${LABEL0_X} ${LABEL0_Y})`}
            >
              0
            </SvgText>
            <SvgText
              x={LABEL1_X}
              y={LABEL1_Y}
              fontSize={11}
              fill={homeGlassColors.textSoft}
              textAnchor="middle"
              transform={`rotate(${A1 + 4.5 + 90} ${LABEL1_X} ${LABEL1_Y})`}
            >
              {max}
            </SvgText>
          </>
        ) : null}
      </G>
    </Svg>
  );
}
