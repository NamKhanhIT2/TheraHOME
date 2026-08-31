import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const LOGO = require('../../../assets/brandmark-blue.png');

const BRAND = 'TheraHOME';
const CELL_HEIGHT = 56;
const SLOT_SEQUENCES = [
  ['7', 'R', 'A', 'K', '2', 'T'],
  ['N', '8', 'E', 'M', 'A', 'h'],
  ['3', 'B', 'Q', 'R', 'I', 'e'],
  ['D', '9', 'X', 'A', 'P', 'r'],
  ['4', 'N', 'C', 'V', '7', 'a'],
  ['K', '2', 'R', 'A', 'N', 'H'],
  ['0', 'Q', 'D', '8', 'C', 'O'],
  ['W', '6', 'N', '3', 'H', 'M'],
  ['L', '1', 'F', 'K', '9', 'E'],
] as const;

const SLOT_WIDTHS = [30, 27, 24, 20, 25, 34, 35, 38, 29] as const;

function SplashBackdrop() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="base" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F9FBFE" />
          <Stop offset="0.48" stopColor="#F2F6FC" />
          <Stop offset="1" stopColor="#CBD7E8" />
        </LinearGradient>
        <RadialGradient id="centerLight" cx="50%" cy="39%" rx="58%" ry="58%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.98" />
          <Stop offset="0.58" stopColor="#F8FAFD" stopOpacity="0.72" />
          <Stop offset="1" stopColor="#D9E3F1" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="waveOne" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#C5D2E4" stopOpacity="0.74" />
          <Stop offset="0.48" stopColor="#F8FAFD" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#BBCADF" stopOpacity="0.68" />
        </LinearGradient>
        <LinearGradient id="waveTwo" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#E7EDF6" stopOpacity="0.94" />
          <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.82" />
          <Stop offset="1" stopColor="#D5DFED" stopOpacity="0.9" />
        </LinearGradient>
      </Defs>
      <Rect width="390" height="844" fill="url(#base)" />
      <Rect width="390" height="844" fill="url(#centerLight)" />
      <Path
        d="M-42 566 C62 605 99 690 195 684 C289 678 325 584 432 548 L432 844 L-42 844 Z"
        fill="url(#waveOne)"
      />
      <Path
        d="M-34 613 C71 652 105 730 203 710 C292 692 334 630 428 602 L428 718 C327 734 280 793 181 788 C80 783 38 716 -34 701 Z"
        fill="url(#waveTwo)"
      />
      <Path
        d="M-35 690 C68 731 117 764 208 751 C300 738 340 690 430 682"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.62"
        strokeWidth="18"
      />
    </Svg>
  );
}

function SlotCharacter({ index, reducedMotion }: { index: number; reducedMotion: boolean }) {
  const translateY = useSharedValue(reducedMotion ? -(SLOT_SEQUENCES[index].length - 1) * CELL_HEIGHT : 0);
  const lockGlow = useSharedValue(0);
  const isHome = index >= 5;

  useEffect(() => {
    const sequence = SLOT_SEQUENCES[index];
    const finalY = -(sequence.length - 1) * CELL_HEIGHT;

    if (reducedMotion) {
      translateY.value = finalY;
      lockGlow.value = 0;
      return;
    }

    translateY.value = 0;
    lockGlow.value = 0;

    // "Thera" settles first. "HOME" has a longer roll and a stronger lock,
    // so the brand reads as assembled rather than faded in as one word.
    const homeIndex = Math.max(0, index - 5);
    const startDelay = isHome ? 260 + homeIndex * 55 : 60 + index * 45;
    const duration = isHome ? 880 + homeIndex * 65 : 720 + index * 35;
    const lockAt = startDelay + duration;

    translateY.value = withDelay(
      startDelay,
      withTiming(finalY, {
        duration,
        easing: Easing.bezier(0.16, 0.82, 0.24, 1),
      }),
    );
    lockGlow.value = withDelay(
      lockAt - 16,
      withSequence(
        withTiming(isHome ? 1 : 0.55, { duration: 70 }),
        withTiming(0, { duration: isHome ? 150 : 105 }),
      ),
    );
  }, [index, isHome, lockGlow, reducedMotion, translateY]);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: lockGlow.value,
    transform: [{ scale: 0.88 + lockGlow.value * 0.28 }],
  }));

  return (
    <View style={[styles.slot, { width: SLOT_WIDTHS[index] }]} accessibilityElementsHidden>
      <Animated.View style={[styles.characterGlow, isHome && styles.characterGlowHome, glowStyle]} />
      <Animated.View style={stripStyle}>
        {SLOT_SEQUENCES[index].map((character, itemIndex) => (
          <Text
            key={`${character}-${itemIndex}`}
            style={[
              styles.character,
              { width: SLOT_WIDTHS[index] },
              itemIndex === SLOT_SEQUENCES[index].length - 1 && (isHome ? styles.homeCharacter : styles.theraCharacter),
            ]}
          >
            {character}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

export function AppSplashScreen() {
  const reducedMotion = useReduceMotion();
  const logoScale = useSharedValue(1);
  const logoGlowOpacity = useSharedValue(reducedMotion ? 0.2 : 0.1);
  const logoGlowScale = useSharedValue(0.86);

  useEffect(() => {
    if (reducedMotion) {
      logoScale.value = 1;
      logoGlowOpacity.value = 0.2;
      logoGlowScale.value = 1;
      return;
    }

    logoScale.value = 1;
    logoGlowOpacity.value = 0.1;
    logoGlowScale.value = 0.86;
    logoScale.value = withDelay(
      1480,
      withSequence(withTiming(1.026, { duration: 115 }), withTiming(1, { duration: 145 })),
    );
    logoGlowOpacity.value = withDelay(
      1450,
      withSequence(withTiming(0.5, { duration: 120 }), withTiming(0.18, { duration: 210 })),
    );
    logoGlowScale.value = withDelay(
      1450,
      withSequence(withTiming(1.16, { duration: 145 }), withTiming(1, { duration: 190 })),
    );
  }, [logoGlowOpacity, logoGlowScale, logoScale, reducedMotion]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));
  const logoGlowStyle = useAnimatedStyle(() => ({
    opacity: logoGlowOpacity.value,
    transform: [{ scale: logoGlowScale.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SplashBackdrop />
      <View style={styles.brandBlock}>
        <View style={styles.logoStage}>
          <Animated.View style={[styles.logoGlow, logoGlowStyle]} />
          <Animated.Image source={LOGO} resizeMode="contain" style={[styles.logo, logoStyle]} />
        </View>
        <View style={styles.word} accessible accessibilityRole="text" accessibilityLabel={BRAND}>
          {BRAND.split('').map((_, index) => (
            <SlotCharacter key={index} index={index} reducedMotion={reducedMotion} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#F3F7FC',
  },
  brandBlock: {
    position: 'absolute',
    top: '31%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logoStage: {
    width: 182,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: '#47AEFF',
    shadowColor: '#007FD9',
    shadowOpacity: 0.38,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  logo: {
    width: 164,
    height: 164,
  },
  word: {
    height: CELL_HEIGHT,
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    height: CELL_HEIGHT,
    overflow: 'hidden',
    alignItems: 'center',
  },
  character: {
    height: CELL_HEIGHT,
    lineHeight: CELL_HEIGHT,
    textAlign: 'center',
    color: '#5A789B',
    fontSize: 43,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  theraCharacter: {
    color: '#176DC1',
  },
  homeCharacter: {
    color: '#007FD9',
    fontWeight: '800',
  },
  characterGlow: {
    position: 'absolute',
    top: 10,
    left: 1,
    right: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8BC8F5',
  },
  characterGlowHome: {
    backgroundColor: '#00BDF2',
    shadowColor: '#007FD9',
    shadowOpacity: 0.35,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
});
