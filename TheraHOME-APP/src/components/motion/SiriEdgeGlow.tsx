import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useEdgeGlowTransition } from '@/store/useEdgeGlowTransition';
import { DEFAULT_EDGE_GLOW_TUNING, EDGE_GLOW_SHADER, type EdgeGlowTuning } from './edgeGlowShader';

const EFFECT = Skia.RuntimeEffect.Make(EDGE_GLOW_SHADER);
const ENTRY_FAILSAFE_MS = 3_500;

// iOS has no public API for the physical display corner radius. These are
// starting values in points; the debug screen allows calibration on device.
const CORNER_RADII: readonly (readonly [number, number, number])[] = [
  [375, 812, 39], [414, 896, 39], [390, 844, 47], [428, 926, 47],
  [393, 852, 55], [430, 932, 55], [402, 874, 62], [440, 956, 62],
];

export function screenCornerRadius(width: number, height: number): number {
  if (Platform.OS !== 'ios') return 34;
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const match = CORNER_RADII.find(([w, h]) => Math.abs(w - short) < 2 && Math.abs(h - long) < 2);
  return match?.[2] ?? 39;
}

export function EdgeGlowSurface({
  width,
  height,
  timeMs,
  tuning,
}: {
  width: number;
  height: number;
  timeMs: SharedValue<number>;
  tuning: EdgeGlowTuning;
}) {
  const uniforms = useDerivedValue(() => ({
    resolution: [width, height],
    timeMs: timeMs.value,
    radius: Math.min(tuning.radius, width / 2, height / 2),
    exposure: tuning.exposure,
    coreWidth: tuning.coreWidth,
    haloSigma: tuning.haloSigma,
    noiseAmp: tuning.noiseAmp,
    speed: tuning.speed,
    anchorShift: tuning.anchorShift,
    layers: [...tuning.layers],
    debugMask: tuning.debugMask,
  }), [width, height, tuning]);

  if (!EFFECT || width <= 0 || height <= 0) return null;
  return (
    <Canvas style={{ width, height }}>
      <Fill><Shader source={EFFECT} uniforms={uniforms} /></Fill>
    </Canvas>
  );
}

/** A single transparent overlay above the root navigator. */
export function SiriEdgeGlow() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const phase = useEdgeGlowTransition((state) => state.phase);
  const settle = useEdgeGlowTransition((state) => state.settle);
  const reset = useEdgeGlowTransition((state) => state.reset);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const elapsed = useSharedValue(0);
  const visibility = useSharedValue(0);
  const tuning = useMemo<EdgeGlowTuning>(() => ({
    ...DEFAULT_EDGE_GLOW_TUNING,
    radius: screenCornerRadius(width, height),
  }), [width, height]);

  const clock = useFrameCallback((frame) => {
    'worklet';
    elapsed.value += Math.min(frame.timeSincePreviousFrame ?? 0, 50);
  }, false);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);

  useEffect(() => {
    clock.setActive(foreground && !reduceMotion && phase !== 'idle');
    return () => clock.setActive(false);
  }, [clock, foreground, phase, reduceMotion]);

  useEffect(() => {
    if (phase === 'idle') {
      cancelAnimation(visibility);
      visibility.value = 0;
      elapsed.value = 0;
      return;
    }

    if (phase === 'ignite') {
      elapsed.value = reduceMotion ? 1_500 : 0;
      cancelAnimation(visibility);
      visibility.value = withTiming(1, {
        duration: reduceMotion ? 120 : 30,
        easing: Easing.out(Easing.cubic),
      });
      const failsafe = setTimeout(settle, ENTRY_FAILSAFE_MS);
      return () => clearTimeout(failsafe);
    }

    visibility.value = withTiming(0, { duration: reduceMotion ? 120 : 300 }, (finished) => {
      if (finished) runOnJS(reset)();
    });
  }, [elapsed, phase, reduceMotion, reset, settle, visibility]);

  const shellStyle = useAnimatedStyle(() => ({ opacity: visibility.value }));
  if (phase === 'idle' || width <= 0 || height <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, shellStyle]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <EdgeGlowSurface width={width} height={height} timeMs={elapsed} tuning={tuning} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10_000,
    elevation: 10_000,
  },
});
