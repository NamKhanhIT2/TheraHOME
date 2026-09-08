import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';

/**
 * The figure-and-door on the sign-in button (owner reference video,
 * 2026-09-08). At rest a stick figure stands beside a shut single door.
 * While the request is in flight it plays once: the door swings open the
 * instant the button is pressed, the figure runs across and steps through,
 * and the door swings shut behind them.
 *
 * Plain react-native `Animated`, the same driver the button's sheen and
 * press-scale use, so the whole thing stays on the native driver.
 *
 * The leaf swings on a hinge at its RIGHT edge, so the doorway clears on the
 * LEFT — the side the runner arrives from. It is a plain View scaled in 2D
 * with the pivot moved to that edge, not a 3D rotateY: react-native-svg does
 * not apply a 3D transform to its own canvas, and RN's rotateY on a bare view
 * would not render reliably at this size either. The lit interior sits behind
 * it and is revealed as the leaf scales away.
 *
 * `run` is one 0→1 timeline. The door is open only in the middle of it, so a
 * single value both opens and closes it: openness peaks while the figure
 * crosses and is back to zero by the end. Turning `running` off before it
 * finishes (a failed sign-in) rewinds to the figure standing at a shut door.
 */
export function RunnerDoor({ running, size = 50 }: { running: boolean; size?: number }) {
  const run = useRef(new Animated.Value(0)).current;
  const stride = useRef(new Animated.Value(0)).current;
  const strideLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (running) {
      strideLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(stride, { toValue: 1, duration: 120, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(stride, { toValue: 0, duration: 120, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      strideLoop.current.start();
      Animated.timing(run, { toValue: 1, duration: 1350, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    } else {
      strideLoop.current?.stop();
      stride.setValue(0);
      Animated.timing(run, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    return () => strideLoop.current?.stop();
  }, [running, run, stride]);

  // Order (owner, 2026-09-08): the door opens the instant the button is
  // pressed, THEN the figure runs across and through, THEN the door shuts.
  // The leaf opens first (0→0.15) and holds; the figure waits a beat, then
  // runs across (0.3→0.66) and through, and the leaf shuts last (0.8→0.94).
  const leafScale = run.interpolate({ inputRange: [0, 0.15, 0.8, 0.94], outputRange: [1, 0.14, 0.14, 1], extrapolate: 'clamp' });
  const glowOpacity = run.interpolate({ inputRange: [0, 0.15, 0.8, 0.94], outputRange: [0, 0.42, 0.42, 0], extrapolate: 'clamp' });

  // Figure holds a beat after the door opens, then runs and fades through.
  const runnerX = run.interpolate({ inputRange: [0, 0.3, 0.64, 0.74], outputRange: [0, 0, 17, 21], extrapolate: 'clamp' });
  const runnerOpacity = run.interpolate({ inputRange: [0, 0.64, 0.74], outputRange: [1, 1, 0], extrapolate: 'clamp' });
  const bob = stride.interpolate({ inputRange: [0, 1], outputRange: [0, -1.3] });

  const leafW = 14;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Warm light from the open doorway. */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', right: 7, width: 15, height: 15, borderRadius: 8, backgroundColor: '#EAF6FF', opacity: glowOpacity }}
      />

      {/* Door frame with a lit interior behind it: the frame's dark opening
          holds a pale panel that the leaf covers when shut and reveals as it
          swings back. */}
      <Svg width={size} height={size} viewBox="0 0 50 50" style={{ position: 'absolute' }}>
        <Rect x="30" y="11" width="17" height="28" rx="2.5" fill="#0C355C" />
        <Rect x="31.6" y="12.6" width="13.8" height="24.8" rx="1.5" fill="#E4F3FF" />
      </Svg>

      {/* The leaf, hinged on its RIGHT edge — it scales toward that edge, so
          the doorway clears on the LEFT, the side the runner arrives from.
          A plain View (react-native-svg does not apply a 3D transform to its
          own canvas), scaled in 2D with the pivot moved to the right edge. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', left: 31.6, top: 12.6, width: leafW, height: 24.8,
          backgroundColor: '#1A5490', borderRadius: 1.5, borderWidth: 0.8, borderColor: '#7FC8FF',
          alignItems: 'flex-end', justifyContent: 'center',
          transform: [{ translateX: leafW / 2 }, { scaleX: leafScale }, { translateX: -leafW / 2 }],
        }}
      >
        <View style={{ width: 1.7, height: 3.2, borderRadius: 0.85, backgroundColor: '#DCF1FF', marginRight: 1.8 }} />
      </Animated.View>

      {/* The stick figure. */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: 6, top: 11, transform: [{ translateX: runnerX }, { translateY: bob }], opacity: runnerOpacity }}
      >
        <Svg width={16} height={28} viewBox="0 0 16 28">
          <Path d="M8 4.2 a2.6 2.6 0 1 0 0.01 0 Z" fill="#FFFFFF" />
          <Line x1="8" y1="7" x2="8" y2="17" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
          <AnimatedLine x1="8" y1="10" x2={stride.interpolate({ inputRange: [0, 1], outputRange: [3.5, 12] })} y2={stride.interpolate({ inputRange: [0, 1], outputRange: [13, 8] })} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
          <AnimatedLine x1="8" y1="10" x2={stride.interpolate({ inputRange: [0, 1], outputRange: [12, 3.5] })} y2={stride.interpolate({ inputRange: [0, 1], outputRange: [8, 13] })} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
          <AnimatedLine x1="8" y1="17" x2={stride.interpolate({ inputRange: [0, 1], outputRange: [3, 12] })} y2="26" stroke="#FFFFFF" strokeWidth={2.1} strokeLinecap="round" />
          <AnimatedLine x1="8" y1="17" x2={stride.interpolate({ inputRange: [0, 1], outputRange: [12, 3] })} y2="26" stroke="#FFFFFF" strokeWidth={2.1} strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const AnimatedLine = Animated.createAnimatedComponent(Line);
