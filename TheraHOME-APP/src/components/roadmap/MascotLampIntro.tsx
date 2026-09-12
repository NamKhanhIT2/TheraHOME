import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

const MASCOT = require('../../../assets/mascot-thinking.png');

/**
 * The intro that plays on the "Gợi ý từ TheraHOME" screen before the text
 * types (per explicit request, ref: Interactive-Bulb.html): a hanging lamp
 * switches on and spotlights the TheraHOME mascot; after a beat the mascot
 * fades, the light goes out and the lamp is pulled up out of frame, clearing
 * the centre for the typewriter. `onDone` fires once it has left.
 *
 * Tap anywhere to skip. Reduce-motion callers just don't render this.
 */
export function MascotLampIntro({ onDone }: { onDone: () => void }) {
  const win = Dimensions.get('window');
  // Measure the actual overlay box (the window is taller than this area) so
  // the beam can reach the real bottom corners — see coneHalf.
  const [size, setSize] = useState({ w: win.width, h: win.height });
  const SW = size.w;
  const SH = size.h;
  const cx = SW / 2;
  // Lamp higher up → more distance to the mascot → wider projection on it.
  const cableH = Math.round(SH * 0.14);
  // Triangular shade with a 90° apex (base half-width == height).
  const SHADE_H = 72;
  const shadeHalf = SHADE_H;
  const bulbY = cableH + SHADE_H;
  const bulbR = 22; // bigger bulb; its top half is hidden behind the shade
  const coneTopY = bulbY;
  // Edges run to the exact bottom corners — the whole bottom edge is lit and
  // both edges stay diagonal, so there is no vertical cut at the sides.
  const coneHalf = cx;
  const mascotW = SW * 0.48;
  const mascotH = mascotW * 1.064;
  const mascotTop = SH * 0.5 - mascotH / 2; // centred on screen

  // How far the lamp swings, and when the exit begins.
  const SWAY = 4;
  const EXIT_AT = 2300;

  const backdrop = useSharedValue(0);
  const lightOn = useSharedValue(0);
  // Starts above the frame and drops down into its low resting position.
  const lampY = useSharedValue(-Math.round(SH * 0.24));
  const sway = useSharedValue(-SWAY);
  const mascotOp = useSharedValue(0);
  const mascotScale = useSharedValue(0.9);

  useEffect(() => {
    backdrop.value = withTiming(1, { duration: 260 });
    lampY.value = withTiming(0, { duration: 660, easing: Easing.out(Easing.cubic) });
    lightOn.value = withDelay(220, withTiming(1, { duration: 420 }));
    mascotOp.value = withDelay(320, withTiming(1, { duration: 440 }));
    mascotScale.value = withDelay(320, withTiming(1, { duration: 440, easing: Easing.out(Easing.back(1.4)) }));
    // Gentle sway once it has settled.
    sway.value = withDelay(
      520,
      withRepeat(
        withSequence(
          withTiming(SWAY, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(-SWAY, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );

    // Exit: mascot out, light off, lamp pulled up, backdrop fades → onDone.
    mascotOp.value = withDelay(EXIT_AT, withTiming(0, { duration: 360 }));
    mascotScale.value = withDelay(EXIT_AT, withTiming(0.86, { duration: 360 }));
    lightOn.value = withDelay(EXIT_AT + 60, withTiming(0, { duration: 320 }));
    // Pull the lamp up gradually, clearing the centre for the text.
    lampY.value = withDelay(EXIT_AT + 200, withTiming(-SH, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
    backdrop.value = withDelay(
      EXIT_AT + 360,
      withTiming(0, { duration: 440 }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: lightOn.value }));
  const lampOuterStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lampY.value }] }));
  const lampSwayStyle = useAnimatedStyle(() => ({
    // Rotate around the top edge (the ceiling anchor), not the centre.
    transform: [{ translateY: -SH / 2 }, { rotate: `${sway.value}deg` }, { translateY: SH / 2 }],
  }));
  const mascotStyle = useAnimatedStyle(() => ({ opacity: mascotOp.value, transform: [{ scale: mascotScale.value }] }));

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={onDone}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
      }}
    >
      {/* Fixed dark backdrop: override the theme-driven global StatusBar while the intro shows. */}
      <StatusBar style="light" />
      <Reanimated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

      {/* Mascot, spotlit under the cone. */}
      <Reanimated.Image
        source={MASCOT}
        resizeMode="contain"
        style={[
          { position: 'absolute', width: mascotW, height: mascotH, left: cx - mascotW / 2, top: mascotTop },
          mascotStyle,
        ]}
      />

      {/* Lamp assembly: pulled up on exit (outer), swaying from the top (inner). */}
      <Reanimated.View style={[StyleSheet.absoluteFill, lampOuterStyle]} pointerEvents="none">
        <Reanimated.View style={[StyleSheet.absoluteFill, lampSwayStyle]}>
          {/* Light layer (fades on/off) FIRST — the cone and the bulb. */}
          <Reanimated.View style={[StyleSheet.absoluteFill, lightStyle]}>
            <Svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`}>
              <Defs>
                <LinearGradient id="cone" x1="0" y1={coneTopY} x2="0" y2={SH}>
                  <Stop offset="0" stopColor="#FFF4CE" stopOpacity="0.5" />
                  <Stop offset="0.6" stopColor="#FFF4CE" stopOpacity="0.14" />
                  <Stop offset="1" stopColor="#FFF4CE" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              {/* Wide flat top (= shade base width) spreading to the bottom
                  corners — light comes out wide, not as a sharp point. */}
              <Polygon
                points={`${cx - shadeHalf},${coneTopY} ${cx + shadeHalf},${coneTopY} ${cx + coneHalf},${SH} ${cx - coneHalf},${SH}`}
                fill="url(#cone)"
              />
              <Circle cx={cx} cy={bulbY} r={bulbR} fill="#FFE79A" />
            </Svg>
          </Reanimated.View>

          {/* Structure layer (cable + shade) SECOND, drawn ON TOP — the
              triangular shade hides the bulb's upper half. */}
          <Svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`}>
            <Rect x={cx - 2} y={0} width={4} height={cableH} fill="#243244" />
            <Path
              d={`M ${cx} ${cableH} L ${cx + shadeHalf} ${bulbY} L ${cx - shadeHalf} ${bulbY} Z`}
              fill="#1b2836"
            />
          </Svg>
        </Reanimated.View>
      </Reanimated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#081528',
  },
});
