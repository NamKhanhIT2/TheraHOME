import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const VIEWBOX = 240;
const CENTER = VIEWBOX / 2;
const INNER_RADIUS = 76;
const OUTER_RADIUS = 103;

const CYAN = '#00D9FF';
const ELECTRIC_BLUE = '#168BFF';
const WHITE_BLUE = '#E7FBFF';
const VIOLET = '#806DFF';

function pointOnCircle(radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

export function LoginOrbitHud({ size = 220 }: { size?: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const entranceScale = useSharedValue(0.9);
  const innerRotation = useSharedValue(0);
  const outerRotation = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(300, withTiming(1, { duration: reduceMotion ? 180 : 700, easing: Easing.out(Easing.cubic) }));
    entranceScale.value = withDelay(300, withTiming(1, { duration: reduceMotion ? 180 : 820, easing: Easing.out(Easing.cubic) }));

    if (!reduceMotion) {
      innerRotation.value = withDelay(700, withRepeat(withTiming(360, { duration: 16_000, easing: Easing.linear }), -1, false));
      outerRotation.value = withDelay(700, withRepeat(withTiming(-360, { duration: 24_000, easing: Easing.linear }), -1, false));
      pulse.value = withDelay(
        500,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1_600, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 1_600, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      );
    } else {
      pulse.value = 0.45;
    }

    return () => {
      [innerRotation, outerRotation, pulse].forEach(cancelAnimation);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: entranceScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.13 + pulse.value * 0.16,
    transform: [{ scale: 0.92 + pulse.value * 0.09 }],
  }));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${innerRotation.value}deg` }] }));
  const outerStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${outerRotation.value}deg` }] }));

  return (
    <Animated.View pointerEvents="none" style={[styles.container, { width: size, height: size }, containerStyle]}>
      <Animated.View style={[styles.magicGlow, { width: size * 0.76, height: size * 0.76, borderRadius: size * 0.38 }, glowStyle]} />

      <Animated.View style={[styles.layer, outerStyle]}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <Circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS} fill="none" stroke={VIOLET} strokeWidth={1.2} strokeOpacity={0.38} strokeDasharray="31 15 5 17" />
          <Circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS - 8} fill="none" stroke={ELECTRIC_BLUE} strokeWidth={1.1} strokeOpacity={0.64} strokeDasharray="2 13" />
          {Array.from({ length: 12 }, (_, index) => {
            const angle = index * 30;
            const inner = pointOnCircle(OUTER_RADIUS - (index % 3 === 0 ? 7 : 4), angle);
            const outer = pointOnCircle(OUTER_RADIUS + 1, angle);
            return <Line key={angle} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={index % 3 === 0 ? CYAN : ELECTRIC_BLUE} strokeWidth={index % 3 === 0 ? 1.8 : 0.9} strokeOpacity={0.82} strokeLinecap="round" />;
          })}
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.layer, innerStyle]}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <Circle cx={CENTER} cy={CENTER} r={INNER_RADIUS} fill="none" stroke={CYAN} strokeWidth={3.2} strokeOpacity={0.94} strokeLinecap="round" strokeDasharray="54 15 17 11" />
          <Circle cx={CENTER} cy={CENTER} r={INNER_RADIUS - 7} fill="none" stroke={WHITE_BLUE} strokeWidth={0.9} strokeOpacity={0.52} strokeDasharray="2 9" />
          <G>
            {[18, 112, 211, 302].map((angle, index) => {
              const point = pointOnCircle(INNER_RADIUS, angle);
              return (
                <G key={angle}>
                  <Circle cx={point.x} cy={point.y} r={index === 0 ? 7 : 5} fill={CYAN} opacity={0.14} />
                  <Circle cx={point.x} cy={point.y} r={index === 0 ? 2.8 : 2.1} fill={index === 0 ? WHITE_BLUE : CYAN} />
                </G>
              );
            })}
          </G>
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFill,
  },
  magicGlow: {
    position: 'absolute',
    top: '12%',
    left: '12%',
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    shadowColor: CYAN,
    shadowOpacity: 0.64,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
});
