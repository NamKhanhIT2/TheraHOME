// Futuristic "AI is processing your answers" HUD for the onboarding
// analyzing screen (app/(onboarding)/consent.tsx's 0→100% loading state).
// Multiple concentric layers instead of a single progress ring, each
// animated independently on the UI thread via reanimated so the whole
// cluster reads as "a system actively working," not a static loader:
//   - an outer static frame ring
//   - a ring of small dots orbiting slowly (clockwise)
//   - a dashed "measurement scale" ring counter-rotating, slower
//   - the actual 0-100% progress arc (glow duplicate + bright arc + a
//     leading dot), smoothed between the caller's discrete percent bumps
//   - a thin inner frame around the centered logo/percent/caption
//   - four HUD-style corner brackets and a few twinkling ambient dots
//     outside the main cluster
// `percent` is still owned by consent.tsx's plain countdown effect —
// this component only renders it; the smoothing/rotation/pulse motion
// here is all decorative and independent of that state.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, RadialGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

const HUD_SIZE = 312;
const CENTER = HUD_SIZE / 2;
const CONTAINER_SIZE = HUD_SIZE + 64;
const CONTAINER_CENTER = CONTAINER_SIZE / 2;

const OUTER_TRACK_R = HUD_SIZE / 2 - 3;
const ORBIT_R = OUTER_TRACK_R - 20;
const SCALE_R = ORBIT_R - 22;
const PROGRESS_R = SCALE_R - 24;
const INNER_FRAME_R = PROGRESS_R - 26;
const PROGRESS_STROKE = 7;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_R;

const BRIGHT = '#3AA1FF';
const DIM_STROKE = 'rgba(58,161,255,0.22)';
const GLOW_STROKE = 'rgba(58,161,255,0.35)';

const ORBIT_DOTS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * 2 * Math.PI;
  const big = i % 3 === 0;
  return {
    cx: CENTER + ORBIT_R * Math.cos(angle),
    cy: CENTER + ORBIT_R * Math.sin(angle),
    r: big ? 3.2 : 1.8,
    opacity: big ? 0.95 : 0.45,
  };
});

const AMBIENT_DOTS = [
  { x: 6, y: CONTAINER_CENTER - 70, r: 2.5, delay: 0 },
  { x: 22, y: CONTAINER_CENTER + 96, r: 1.8, delay: 300 },
  { x: CONTAINER_SIZE - 10, y: CONTAINER_CENTER - 108, r: 1.8, delay: 600 },
  { x: CONTAINER_SIZE - 26, y: CONTAINER_CENTER + 78, r: 2.5, delay: 900 },
];

function CornerBracket({ style, colorStyle }: { style: object; colorStyle: object }) {
  return <View style={[styles.bracket, style, colorStyle]} />;
}

export function AnalyzingHud({ percent }: { percent: number }) {
  const theme = useTheme();
  const orbitRotation = useSharedValue(0);
  const scaleRotation = useSharedValue(0);
  const pulse = useSharedValue(0.5);
  const progressOffset = useSharedValue(PROGRESS_CIRCUMFERENCE);

  useEffect(() => {
    orbitRotation.value = withRepeat(withTiming(360, { duration: 9000, easing: Easing.linear }), -1);
    scaleRotation.value = withRepeat(withTiming(-360, { duration: 24000, easing: Easing.linear }), -1);
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const target = PROGRESS_CIRCUMFERENCE * (1 - percent / 100);
    progressOffset.value = withTiming(target, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [percent, progressOffset]);

  const orbitProps = useAnimatedProps(() => ({ rotation: orbitRotation.value, origin: `${CENTER}, ${CENTER}` }));
  const scaleProps = useAnimatedProps(() => ({ rotation: scaleRotation.value, origin: `${CENTER}, ${CENTER}` }));
  const progressArcProps = useAnimatedProps(() => ({ strokeDashoffset: progressOffset.value }));
  const glowOpacityProps = useAnimatedProps(() => ({ opacity: 0.5 + pulse.value * 0.5 }));

  const dotAngle = (percent / 100) * 2 * Math.PI - Math.PI / 2;
  const dotX = CENTER + PROGRESS_R * Math.cos(dotAngle);
  const dotY = CENTER + PROGRESS_R * Math.sin(dotAngle);

  return (
    <View style={styles.container}>
      <CornerBracket style={styles.bracketTL} colorStyle={{ borderColor: DIM_STROKE }} />
      <CornerBracket style={styles.bracketTR} colorStyle={{ borderColor: DIM_STROKE }} />
      <CornerBracket style={styles.bracketBL} colorStyle={{ borderColor: DIM_STROKE }} />
      <CornerBracket style={styles.bracketBR} colorStyle={{ borderColor: DIM_STROKE }} />

      {AMBIENT_DOTS.map((dot, index) => (
        <AmbientDot key={index} dot={dot} />
      ))}

      <View style={styles.hudWrap}>
        <Svg width={HUD_SIZE} height={HUD_SIZE} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="hudBackglow" cx="50%" cy="50%" r="50%">
              <Stop offset="45%" stopColor={BRIGHT} stopOpacity={0.18} />
              <Stop offset="100%" stopColor={BRIGHT} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          <AnimatedCircle cx={CENTER} cy={CENTER} r={HUD_SIZE / 2} fill="url(#hudBackglow)" animatedProps={glowOpacityProps} />

          {/* Layer 0 — outer static frame */}
          <Circle cx={CENTER} cy={CENTER} r={OUTER_TRACK_R} stroke={DIM_STROKE} strokeWidth={1} fill="none" />

          {/* Layer 1 — orbiting dot ring, rotates clockwise */}
          <AnimatedG animatedProps={orbitProps}>
            {ORBIT_DOTS.map((dot, index) => (
              <Circle key={index} cx={dot.cx} cy={dot.cy} r={dot.r} fill={BRIGHT} opacity={dot.opacity} />
            ))}
          </AnimatedG>

          {/* Layer 2 — dashed measurement scale, counter-rotates slowly */}
          <AnimatedG animatedProps={scaleProps}>
            <Circle cx={CENTER} cy={CENTER} r={SCALE_R} stroke={DIM_STROKE} strokeWidth={2} strokeDasharray="1.5,7" fill="none" />
          </AnimatedG>

          {/* Layer 3 — the actual 0-100% progress arc */}
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={PROGRESS_R}
            stroke={GLOW_STROKE}
            strokeWidth={PROGRESS_STROKE + 8}
            strokeLinecap="round"
            strokeDasharray={PROGRESS_CIRCUMFERENCE}
            fill="none"
            rotation={-90}
            origin={`${CENTER}, ${CENTER}`}
            animatedProps={progressArcProps}
          />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={PROGRESS_R}
            stroke={BRIGHT}
            strokeWidth={PROGRESS_STROKE}
            strokeLinecap="round"
            strokeDasharray={PROGRESS_CIRCUMFERENCE}
            fill="none"
            rotation={-90}
            origin={`${CENTER}, ${CENTER}`}
            animatedProps={progressArcProps}
          />
          {percent > 0 && percent < 100 ? <Circle cx={dotX} cy={dotY} r={5} fill="#fff" /> : null}

          {/* Layer 4 — thin frame around the centered content */}
          <Circle cx={CENTER} cy={CENTER} r={INNER_FRAME_R} stroke={DIM_STROKE} strokeWidth={1} fill="none" />
        </Svg>

        <View style={styles.content}>
          <Text style={[styles.percentText, { fontFamily: theme.fontFamily.bold }]}>{percent}%</Text>
        </View>
      </View>
    </View>
  );
}

function AmbientDot({ dot }: { dot: { x: number; y: number; r: number; delay: number } }) {
  const local = useSharedValue(0.3);
  useEffect(() => {
    local.value = withDelay(dot.delay, withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animatedStyle = useAnimatedProps(() => ({ opacity: 0.25 + local.value * 0.6 }));
  return (
    <Svg width={dot.r * 2 + 6} height={dot.r * 2 + 6} style={{ position: 'absolute', left: dot.x, top: dot.y }}>
      <AnimatedCircle cx={dot.r + 3} cy={dot.r + 3} r={dot.r} fill={BRIGHT} animatedProps={animatedStyle} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudWrap: {
    width: HUD_SIZE,
    height: HUD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontSize: 56,
    lineHeight: 64,
    color: '#fff',
  },
  bracket: {
    position: 'absolute',
    width: 20,
    height: 20,
  },
  bracketTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  bracketTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  bracketBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  bracketBR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
});
