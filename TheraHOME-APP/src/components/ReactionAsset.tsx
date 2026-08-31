import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Kind = 'pulse' | 'orbit';

interface Preset {
  kind: Kind;
  colors: string[];
}

// Emoji glyph stays a plain, un-transformed Text — every bit of motion here
// lives in a real vector layer (react-native-svg + Animated) behind it:
// pulsing rings for the "intensity" emotions, twinkling orbit dots (colored
// per reaction) for the rest.
const PRESETS: Record<string, Preset> = {
  '❤️': { kind: 'pulse', colors: ['#FF6B8A'] },
  '😮': { kind: 'pulse', colors: ['#FFB648'] },
  '😢': { kind: 'pulse', colors: ['#4DA3E8'] },
  '👍': { kind: 'orbit', colors: ['#4DA3E8', '#7FC1F2'] },
  '🙏': { kind: 'orbit', colors: ['#8B7CF6', '#B7ACF9'] },
  '😊': { kind: 'orbit', colors: ['#FFD23F', '#FFE38A'] },
  '😂': { kind: 'orbit', colors: ['#FFD23F', '#FFE38A'] },
  '👏': { kind: 'orbit', colors: ['#FFB648', '#4FD1C5', '#FF6B8A', '#4DA3E8'] },
  '💪': { kind: 'orbit', colors: ['#FFB648', '#FF9F43'] },
};

export interface ReactionAssetProps {
  emoji: string;
  size: number;
  /** false renders the plain glyph with no motion. Reserve `true` for
   * bounded, momentary UI (an open reaction tray/action sheet) — a
   * continuous per-icon animation running for every small reaction badge on
   * a scrolling feed would be a real perf cost, not a bug. */
  animated?: boolean;
}

export function ReactionAsset({ emoji, size, animated = true }: ReactionAssetProps) {
  const preset = PRESETS[emoji];
  if (!animated || !preset) return <Text style={{ fontSize: size }}>{emoji}</Text>;
  const outer = size * 1.2;
  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {preset.kind === 'pulse' ? <PulseHalo outer={outer} color={preset.colors[0]} /> : <OrbitDots outer={outer} colors={preset.colors} />}
      </View>
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </View>
  );
}

function useLoopingPulse(delay: number, duration: number): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [v, delay, duration]);
  return v;
}

function PulseHalo({ outer, color }: { outer: number; color: string }) {
  const ring1 = useLoopingPulse(0, 1500);
  const ring2 = useLoopingPulse(700, 1500);
  const center = outer / 2;
  return (
    <Svg width={outer} height={outer}>
      {[ring1, ring2].map((v, i) => (
        <AnimatedCircle
          key={i}
          cx={center}
          cy={center}
          r={v.interpolate({ inputRange: [0, 1], outputRange: [center * 0.22, center * 0.92] })}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] })}
        />
      ))}
    </Svg>
  );
}

function OrbitDots({ outer, colors }: { outer: number; colors: string[] }) {
  const count = Math.max(3, Math.min(5, colors.length + 2));
  const dots = useMemo(
    () => Array.from({ length: count }).map((_, i) => ({
      angle: (Math.PI * 2 * i) / count - Math.PI / 2,
      color: colors[i % colors.length],
    })),
    [count, colors],
  );
  return (
    <Svg width={outer} height={outer}>
      {dots.map((dot, i) => <OrbitDot key={i} outer={outer} angle={dot.angle} color={dot.color} delay={i * 180} />)}
    </Svg>
  );
}

function OrbitDot({ outer, angle, color, delay }: { outer: number; angle: number; color: string; delay: number }) {
  const v = useLoopingPulse(delay, 1100);
  const center = outer / 2;
  const radius = center * 0.82;
  const cx = center + Math.cos(angle) * radius;
  const cy = center + Math.sin(angle) * radius;
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [center * 0.06, center * 0.13, center * 0.06] })}
      fill={color}
      opacity={v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 1, 0.25] })}
    />
  );
}
