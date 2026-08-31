import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Reanimated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedRect = Reanimated.createAnimatedComponent(Rect);
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

const TRACK_HEIGHT = 8;
const DOT_RADIUS = 7;
const SVG_HEIGHT = DOT_RADIUS * 2 + 4;

export interface HeroProgressBarProps {
  /** 0..1 — clamped internally. */
  progress: number;
}

/** Horizontal progress track for the Home hero card. Tweens both the fill
 * and the current-position dot together whenever `progress` changes
 * (including the very first render, once width is known) — this is what
 * makes the bar "run" the moment the card appears. */
export function HeroProgressBar({ progress }: HeroProgressBarProps) {
  const [width, setWidth] = useState(0);
  const clamped = Math.min(1, Math.max(0, progress));
  const anim = useSharedValue(0);

  useEffect(() => {
    if (width === 0) return;
    anim.value = withTiming(clamped, { duration: 750, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, width]);

  const fillProps = useAnimatedProps(() => ({
    width: DOT_RADIUS * 2 + anim.value * Math.max(width - DOT_RADIUS * 2, 0),
  }));
  const dotProps = useAnimatedProps(() => ({
    cx: DOT_RADIUS + anim.value * Math.max(width - DOT_RADIUS * 2, 0),
  }));

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={SVG_HEIGHT} viewBox={`0 0 ${width} ${SVG_HEIGHT}`}>
          <Defs>
            <LinearGradient id="heroProgressGrad" x1="0" y1="0" x2={width} y2="0" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#22D3EE" />
              <Stop offset="100%" stopColor="#3AA1FF" />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={SVG_HEIGHT / 2 - TRACK_HEIGHT / 2}
            width={width}
            height={TRACK_HEIGHT}
            rx={TRACK_HEIGHT / 2}
            fill="rgba(4,20,44,0.35)"
          />
          <AnimatedRect
            animatedProps={fillProps}
            x={0}
            y={SVG_HEIGHT / 2 - TRACK_HEIGHT / 2}
            height={TRACK_HEIGHT}
            rx={TRACK_HEIGHT / 2}
            fill="url(#heroProgressGrad)"
          />
          <AnimatedCircle animatedProps={dotProps} cy={SVG_HEIGHT / 2} r={DOT_RADIUS + 5} fill="rgba(255,255,255,0.28)" />
          <AnimatedCircle animatedProps={dotProps} cy={SVG_HEIGHT / 2} r={DOT_RADIUS} fill="#fff" stroke="#22D3EE" strokeWidth={2.5} />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
});
