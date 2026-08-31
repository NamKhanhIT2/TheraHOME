import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const VIEWBOX = 400;
const CENTER = VIEWBOX / 2;
const PRIMARY = '#007FD9';
const CYAN = '#00D9FF';
const WHITE_BLUE = '#BDEEFF';
const PROGRESS_RADIUS = 124;
const PROGRESS_LENGTH = 2 * Math.PI * PROGRESS_RADIUS;

const OUTER_NODES = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2;
  return {
    cx: CENTER + Math.cos(angle) * 178,
    cy: CENTER + Math.sin(angle) * 178,
    radius: index % 3 === 0 ? 2.6 : 1.35,
  };
});

const DATA_SEGMENTS = [
  { x1: 77, y1: 111, x2: 101, y2: 87 },
  { x1: 299, y1: 87, x2: 323, y2: 111 },
  { x1: 66, y1: 286, x2: 93, y2: 313 },
  { x1: 307, y1: 313, x2: 334, y2: 286 },
];

const AMBIENT_PARTICLES = [
  { x: 7, y: 23, radius: 1.6, delay: 0, duration: 2_400 },
  { x: 91, y: 18, radius: 1.2, delay: 700, duration: 2_900 },
  { x: 4, y: 68, radius: 1.1, delay: 1_100, duration: 2_100 },
  { x: 95, y: 72, radius: 1.8, delay: 300, duration: 3_100 },
  { x: 15, y: 88, radius: 1.3, delay: 1_400, duration: 2_700 },
  { x: 82, y: 91, radius: 1.1, delay: 900, duration: 2_300 },
];

type AnalyzingHudProps = {
  size?: number;
  preparingLabel: string;
  completedLabel: string;
  onComplete: () => void;
};

function startRotation(value: SharedValue<number>, target: number, duration: number) {
  value.value = withRepeat(withTiming(target, { duration, easing: Easing.linear }), -1, false);
}

function useRingProps(rotation: SharedValue<number>, opacity?: SharedValue<number>) {
  return useAnimatedProps(() => ({
    rotation: rotation.value,
    origin: `${CENTER}, ${CENTER}`,
    opacity: opacity?.value ?? 1,
  }));
}

export function AnalyzingHud({ size = 400, preparingLabel, completedLabel, onComplete }: AnalyzingHudProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [completed, setCompleted] = useState(false);

  // A single UI-thread value drives the number, arc and leading particle,
  // preventing the visual drift caused by separate JS timers.
  const progress = useSharedValue(0);
  const entrance = useSharedValue(0);
  const outerRotation = useSharedValue(0);
  const segmentRotation = useSharedValue(0);
  const tickRotation = useSharedValue(0);
  const innerRotation = useSharedValue(0);
  const scannerRotation = useSharedValue(0);
  const coreBreath = useSharedValue(0);
  const milestonePulse = useSharedValue(0);
  const completionPulse = useSharedValue(0);
  const completionGlow = useSharedValue(0);
  const hudScale = useSharedValue(1);
  const flickerA = useSharedValue(0.46);
  const flickerB = useSharedValue(0.38);

  useEffect(() => {
    entrance.value = withTiming(1, { duration: reduceMotion ? 120 : 650, easing: Easing.out(Easing.cubic) });

    if (!reduceMotion) {
      startRotation(outerRotation, 360, 42_000);
      startRotation(segmentRotation, -360, 25_000);
      startRotation(tickRotation, 360, 33_000);
      startRotation(innerRotation, -360, 18_000);
      startRotation(scannerRotation, 360, 7_500);
      coreBreath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1_650, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1_650, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
      flickerA.value = withRepeat(
        withSequence(
          withTiming(0.82, { duration: 980, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.36, { duration: 1_340, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      flickerB.value = withDelay(
        420,
        withRepeat(
          withSequence(
            withTiming(0.72, { duration: 1_250, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.3, { duration: 1_730, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    } else {
      coreBreath.value = 0.35;
      flickerA.value = 0.58;
      flickerB.value = 0.48;
    }

    // Quick start, slower 45–70%, a second burst, careful verification at
    // 91–99%, a visible pause at 99%, then the final confirmation.
    progress.value = withSequence(
      withTiming(45, { duration: 1_050, easing: Easing.out(Easing.cubic) }),
      withTiming(70, { duration: 1_800, easing: Easing.inOut(Easing.sin) }),
      withTiming(91, { duration: 820, easing: Easing.in(Easing.cubic) }),
      withTiming(99, { duration: 1_420, easing: Easing.out(Easing.cubic) }),
      withDelay(560, withTiming(99, { duration: 0 })),
      withTiming(100, { duration: 300, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (!finished) return;
        completionGlow.value = withSequence(
          withTiming(1, { duration: 160 }),
          withTiming(0.28, { duration: 720, easing: Easing.out(Easing.cubic) }),
        );
        completionPulse.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) });
        hudScale.value = withSequence(
          withTiming(1.025, { duration: 180, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }),
        );
        runOnJS(setCompleted)(true);
      }),
    );

    return () => {
      [
        progress,
        entrance,
        outerRotation,
        segmentRotation,
        tickRotation,
        innerRotation,
        scannerRotation,
        coreBreath,
        milestonePulse,
        completionPulse,
        completionGlow,
        hudScale,
        flickerA,
        flickerB,
      ].forEach(cancelAnimation);
    };
    // Reanimated shared values are stable for this mounted HUD.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  useEffect(() => {
    if (!completed) return;
    const timer = setTimeout(onComplete, 1_050);
    return () => clearTimeout(timer);
  }, [completed, onComplete]);

  useAnimatedReaction(
    () => progress.value,
    (current, previous) => {
      if (previous === null) return;
      const crossedMilestone = [25, 50, 75].some((value) => previous < value && current >= value);
      if (!crossedMilestone || reduceMotion) return;
      milestonePulse.value = 0;
      milestonePulse.value = withSequence(
        withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
      );
    },
    [reduceMotion],
  );

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: PROGRESS_LENGTH * (1 - progress.value / 100),
    opacity: progress.value <= 0.05 ? 0 : 1,
  }));
  const percentProps = useAnimatedProps(() => {
    const value = Math.round(progress.value);
    return { text: `${value}%`, defaultValue: `${value}%` };
  });
  const progressNumberStyle = useAnimatedStyle(() => {
    if (progress.value >= 99.95) return { opacity: 1, transform: [{ translateY: 0 }] };
    const fraction = progress.value - Math.floor(progress.value);
    return {
      opacity: interpolate(fraction, [0, 0.16, 0.84, 1], [0.72, 1, 1, 0.76]),
      transform: [{ translateY: interpolate(fraction, [0, 0.5, 1], [1.5, 0, -1.5]) }],
    };
  });
  const containerStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ scale: interpolate(entrance.value, [0, 1], [0.965, 1]) * hudScale.value }],
  }));
  const coreGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + coreBreath.value * 0.16 + completionGlow.value * 0.34,
    transform: [{ scale: 0.96 + coreBreath.value * 0.035 + completionGlow.value * 0.035 }],
  }));
  const milestoneProps = useAnimatedProps(() => ({
    r: 91 + milestonePulse.value * 35,
    opacity: (1 - milestonePulse.value) * 0.38,
    strokeWidth: 2 - milestonePulse.value * 0.8,
  }));
  const completionProps = useAnimatedProps(() => ({
    r: 88 + completionPulse.value * 88,
    opacity: (1 - completionPulse.value) * 0.64,
    strokeWidth: 3 - completionPulse.value * 1.5,
  }));
  const outerProps = useRingProps(outerRotation);
  const segmentProps = useRingProps(segmentRotation);
  const tickProps = useRingProps(tickRotation);
  const innerProps = useRingProps(innerRotation);
  const scannerProps = useRingProps(scannerRotation);
  const flickerAProps = useAnimatedProps(() => ({ opacity: flickerA.value }));
  const flickerBProps = useAnimatedProps(() => ({ opacity: flickerB.value }));

  const scale = size / VIEWBOX;
  const subtitle = (completed ? completedLabel : preparingLabel).toLocaleUpperCase();

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, containerStyle]}>
      {AMBIENT_PARTICLES.map((particle, index) => (
        <AmbientParticle key={index} {...particle} size={size} reduceMotion={reduceMotion} />
      ))}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.coreGlow,
          { width: 222 * scale, height: 222 * scale, borderRadius: 111 * scale },
          coreGlowStyle,
        ]}
      />

      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Defs>
          <RadialGradient id="hudCore" cx="50%" cy="46%" r="58%">
            <Stop offset="0%" stopColor="#08295A" stopOpacity={0.38} />
            <Stop offset="64%" stopColor="#03132D" stopOpacity={0.78} />
            <Stop offset="100%" stopColor="#010611" stopOpacity={0.98} />
          </RadialGradient>
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={PRIMARY} />
            <Stop offset="62%" stopColor="#1DA8F3" />
            <Stop offset="100%" stopColor={CYAN} />
          </LinearGradient>
        </Defs>

        <Circle cx={CENTER} cy={CENTER} r={190} fill="none" stroke="rgba(0,127,217,0.11)" strokeWidth={1} />

        <AnimatedG animatedProps={outerProps}>
          <Circle cx={CENTER} cy={CENTER} r={185} fill="none" stroke="rgba(0,127,217,0.48)" strokeWidth={1.25} strokeDasharray="68 24 8 30 42 56" />
          {OUTER_NODES.map((node, index) => (
            <Circle key={index} cx={node.cx} cy={node.cy} r={node.radius} fill={index % 4 === 0 ? CYAN : PRIMARY} opacity={index % 4 === 0 ? 0.8 : 0.4} />
          ))}
        </AnimatedG>

        <AnimatedG animatedProps={segmentProps}>
          <Circle cx={CENTER} cy={CENTER} r={172} fill="none" stroke="rgba(58,161,255,0.52)" strokeWidth={2} strokeDasharray="34 11 4 15 58 22" />
          <Circle cx={CENTER} cy={CENTER} r={166} fill="none" stroke="rgba(0,217,255,0.18)" strokeWidth={1} strokeDasharray="5 17 30 9" />
        </AnimatedG>

        <AnimatedG animatedProps={tickProps}>
          <Circle cx={CENTER} cy={CENTER} r={156} fill="none" stroke="rgba(58,161,255,0.62)" strokeWidth={2.2} strokeLinecap="round" strokeDasharray="1.6 7.2" />
          <Circle cx={CENTER} cy={CENTER} r={149} fill="none" stroke="rgba(0,127,217,0.22)" strokeWidth={1} strokeDasharray="20 12 2 12" />
        </AnimatedG>

        <AnimatedG animatedProps={scannerProps}>
          <Circle cx={CENTER} cy={CENTER} r={156} fill="none" stroke={CYAN} strokeWidth={3.4} strokeLinecap="round" strokeDasharray="2 7 2 7 2 7 2 940" opacity={0.92} />
          <Circle cx={CENTER} cy={CENTER} r={151} fill="none" stroke={CYAN} strokeWidth={14} strokeLinecap="round" strokeDasharray="72 880" opacity={0.045} />
        </AnimatedG>

        <Circle cx={CENTER} cy={CENTER} r={PROGRESS_RADIUS} fill="none" stroke="rgba(0,127,217,0.16)" strokeWidth={12} />
        <AnimatedCircle animatedProps={progressProps} cx={CENTER} cy={CENTER} r={PROGRESS_RADIUS} fill="none" stroke={CYAN} strokeWidth={25} strokeLinecap="round" strokeDasharray={PROGRESS_LENGTH} rotation={-90} origin={`${CENTER}, ${CENTER}`} opacity={0.08} />
        <AnimatedCircle animatedProps={progressProps} cx={CENTER} cy={CENTER} r={PROGRESS_RADIUS} fill="none" stroke="url(#progressGradient)" strokeWidth={12} strokeLinecap="round" strokeDasharray={PROGRESS_LENGTH} rotation={-90} origin={`${CENTER}, ${CENTER}`} />

        <ProgressParticle progress={progress} lagDegrees={7} radius={2.2} opacity={0.12} />
        <ProgressParticle progress={progress} lagDegrees={4} radius={2.8} opacity={0.23} />
        <ProgressParticle progress={progress} lagDegrees={2} radius={3.4} opacity={0.42} />
        <ProgressParticle progress={progress} lagDegrees={0} radius={5} opacity={1} />

        <Circle cx={CENTER} cy={CENTER} r={104} fill="url(#hudCore)" stroke="rgba(0,217,255,0.23)" strokeWidth={1.2} strokeDasharray="1 6" />
        <AnimatedG animatedProps={innerProps}>
          <Circle cx={CENTER} cy={CENTER} r={97} fill="none" stroke="rgba(0,127,217,0.25)" strokeWidth={1} strokeDasharray="38 22 4 18" />
        </AnimatedG>

        <AnimatedCircle animatedProps={milestoneProps} cx={CENTER} cy={CENTER} fill="none" stroke={CYAN} />
        <AnimatedCircle animatedProps={completionProps} cx={CENTER} cy={CENTER} fill="none" stroke={WHITE_BLUE} />

        <AnimatedG animatedProps={flickerAProps}>
          <Path d="M190 53 L200 43 L210 53 M193 58 L200 51 L207 58" fill="none" stroke={CYAN} strokeWidth={1.5} />
          <Circle cx={87} cy={200} r={2.1} fill={CYAN} />
          <Circle cx={313} cy={200} r={2.1} fill={CYAN} />
        </AnimatedG>
        <AnimatedG animatedProps={flickerBProps}>
          {DATA_SEGMENTS.map((segment, index) => (
            <Line key={index} {...segment} stroke={index % 2 ? CYAN : PRIMARY} strokeWidth={1.4} />
          ))}
        </AnimatedG>

        <Path d="M194 129 L200 138 L206 129 Z" fill="none" stroke="rgba(0,217,255,0.72)" strokeWidth={1.5} />
        <SvgText x={200} y={28} textAnchor="middle" fill="rgba(189,238,255,0.82)" fontSize={12} fontWeight="700">0</SvgText>
        <SvgText x={376} y={205} textAnchor="middle" fill="rgba(189,238,255,0.72)" fontSize={12} fontWeight="700">25</SvgText>
        <SvgText x={200} y={386} textAnchor="middle" fill="rgba(189,238,255,0.72)" fontSize={12} fontWeight="700">50</SvgText>
        <SvgText x={24} y={205} textAnchor="middle" fill="rgba(189,238,255,0.72)" fontSize={12} fontWeight="700">75</SvgText>
      </Svg>

      <View style={styles.centerContent} pointerEvents="none">
        <AnimatedTextInput
          defaultValue="0%"
          editable={false}
          caretHidden
          underlineColorAndroid="transparent"
          animatedProps={percentProps}
          style={[
            styles.percent,
            { width: 190 * scale, fontSize: 64 * scale, lineHeight: 76 * scale, fontFamily: theme.fontFamily.bold },
            progressNumberStyle,
          ]}
          accessibilityLabel={completed ? completedLabel : preparingLabel}
        />
        <Text
          key={subtitle}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.subtitle,
            {
              width: 190 * scale,
              fontSize: 10.5 * scale,
              letterSpacing: 3.2 * scale,
              fontFamily: theme.fontFamily.semiBold,
              color: completed ? WHITE_BLUE : '#66C7FF',
            },
          ]}
        >
          {subtitle}
        </Text>
        <View style={[styles.processingDots, { marginTop: 15 * scale, gap: 8 * scale }]}>
          {[0.42, 0.75, 1].map((opacity, index) => (
            <View key={index} style={{ width: 4.5 * scale, height: 4.5 * scale, borderRadius: 3 * scale, backgroundColor: PRIMARY, opacity }} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

function ProgressParticle({ progress, lagDegrees, radius, opacity }: { progress: SharedValue<number>; lagDegrees: number; radius: number; opacity: number }) {
  const props = useAnimatedProps(() => {
    const angle = ((progress.value * 3.6 - 90 - lagDegrees) * Math.PI) / 180;
    return {
      cx: CENTER + Math.cos(angle) * PROGRESS_RADIUS,
      cy: CENTER + Math.sin(angle) * PROGRESS_RADIUS,
      opacity: interpolate(progress.value, [0, 2], [0, opacity], 'clamp'),
    };
  });
  return <AnimatedCircle animatedProps={props} r={radius} fill={lagDegrees === 0 ? '#FFFFFF' : CYAN} />;
}

function AmbientParticle({ x, y, radius, delay, duration, size, reduceMotion }: { x: number; y: number; radius: number; delay: number; duration: number; size: number; reduceMotion: boolean }) {
  const alpha = useSharedValue(reduceMotion ? 0.3 : 0.12);
  useEffect(() => {
    if (reduceMotion) return;
    alpha.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.52, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.12, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(alpha);
  }, [alpha, delay, duration, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: alpha.value }));
  const particleSize = radius * 2 * (size / VIEWBOX);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ambientParticle,
        { left: (x / 100) * size, top: (y / 100) * size, width: particleSize, height: particleSize, borderRadius: particleSize / 2 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  coreGlow: {
    position: 'absolute',
    backgroundColor: CYAN,
    shadowColor: CYAN,
    shadowOpacity: 0.6,
    shadowRadius: 26,
    elevation: 8,
  },
  centerContent: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  percent: {
    color: '#D9F7FF',
    textAlign: 'center',
    padding: 0,
    margin: 0,
    textShadowColor: 'rgba(0,217,255,0.78)',
    textShadowRadius: 14,
  },
  subtitle: { textAlign: 'center', marginTop: -5 },
  processingDots: { flexDirection: 'row', alignItems: 'center' },
  ambientParticle: {
    position: 'absolute',
    backgroundColor: CYAN,
    shadowColor: CYAN,
    shadowOpacity: 0.7,
    shadowRadius: 4,
  },
});
