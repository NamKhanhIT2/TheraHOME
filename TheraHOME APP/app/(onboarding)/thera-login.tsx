import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, ImageBackground, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/icons/Icon';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useI18n } from '@/lib/i18n';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// The gap between the brand text and the card is sized (see CLAUDE.md) so
// the sunset in login_background.png shows through between them — the
// image's own aspect ratio (853x1844) nearly matches a phone screen, so a
// `cover` fit crops very little and the sun (measured ~36% down the image)
// lands in roughly the same fraction of the screen. Nudged up further from
// the first pass (168 -> 196) since the logo itself was still overlapping
// the sun's upper edge on-device.
const LOGO_CARD_GAP = 196;
// Content is anchored to the bottom (`justifyContent: 'flex-end'`), so the
// card's own top position doesn't depend on runtime keyboard state — only
// its *height* does, measured via onLayout below, to compute exactly how
// far to lift the form so the "Tiếp tục" button (the last thing that needs
// to stay reachable — the footnote below it can go under the keyboard)
// clears it by TARGET_GAP_ABOVE_KEYBOARD, a snug "just enough to see the
// button" fit rather than a big buffer.
const TARGET_GAP_ABOVE_KEYBOARD = 16;
const CONTENT_BOTTOM_PADDING = 28;
// How far above the screen's top edge each leaf starts, on top of its own
// size — makes them read as falling from high in the sky rather than just
// fading in a few pixels above the visible frame.
const LEAF_SKY_OFFSET = 160;

const BG = require('../../assets/login_background.jpg');
const LOGO = require('../../assets/brandmark-glow.png');
const LEAVES: ImageSourcePropType[] = [
  require('../../assets/leaf01.png'),
  require('../../assets/leaf02.png'),
  require('../../assets/leaf03.png'),
  require('../../assets/leaf04.png'),
  require('../../assets/leaf05.png'),
];

interface FallingLeafConfig {
  source: ImageSourcePropType;
  startX: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  rotateAmount: number;
  opacity: number;
}

function FallingLeaf({ source, startX, size, duration, delay, drift, rotateAmount, opacity, reduceMotion }: FallingLeafConfig & { reduceMotion: boolean }) {
  const progress = useSharedValue(0);
  const sway = useSharedValue(0);

  // Falls from well above the screen (LEAF_SKY_OFFSET), not just a few
  // pixels above the top edge — duration is scaled up by the same factor
  // the travel distance grew by, so the leaf still crosses the visible
  // screen at roughly its originally-tuned pace instead of speeding up.
  const baseDistance = SCREEN_HEIGHT + size * 2;
  const distance = baseDistance + LEAF_SKY_OFFSET;
  const effectiveDuration = duration * (distance / baseDistance);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(delay, withRepeat(withTiming(1, { duration: effectiveDuration, easing: Easing.linear }), -1, false));
    sway.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: effectiveDuration * 0.25, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1, { duration: effectiveDuration * 0.25, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.6, { duration: effectiveDuration * 0.25, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: effectiveDuration * 0.25, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [reduceMotion, delay, effectiveDuration, progress, sway]);

  const animatedStyle = useAnimatedStyle(() => {
    const y = -(size + LEAF_SKY_OFFSET) + progress.value * distance;
    const x = startX + sway.value * drift;
    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${progress.value * rotateAmount}deg` }],
    };
  });

  if (reduceMotion) return null;

  return <Animated.Image source={source} resizeMode="contain" style={[styles.leaf, { width: size, height: size }, animatedStyle]} />;
}

// Password login for accounts an Admin issues directly (App Review, staff,
// partners, testers, cskh) — not OAuth, not a "staff" concept baked into
// this screen itself. Logs in with a plain username, not an email —
// resolve_thera_login_email (SQL) maps it to the account's real
// `<username>@thera.local` address (see CLAUDE.md). Success routes to
// /activate exactly like Google/Apple; RootNavigator (app/_layout.tsx) is
// the single place that decides what happens next, including the
// isStaffAccount bypass for admin/cskh accounts.
export default function TheraAccountLoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const reduceMotion = useReduceMotion();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Keyboard avoidance: the card and the logo lift by different amounts
  // (parallax — the card moves the full distance, the logo moves less and
  // shrinks slightly) rather than the whole screen shifting uniformly.
  // `cardLift` is computed from real measured layout (card height + the
  // "Tiếp tục" button's position within it, both via onLayout below) so the
  // button — the last thing that needs to stay reachable while typing, the
  // footnote below it can go under the keyboard — always ends up just
  // TARGET_GAP_ABOVE_KEYBOARD above it, regardless of device/keyboard
  // height; it isn't a hardcoded guess.
  const cardLift = useSharedValue(0);
  const logoLift = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const cardHeightRef = useRef(0);
  const continueButtonLayoutRef = useRef({ y: 0, height: 58 });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const duration = e.duration || 250;
      const keyboardTop = SCREEN_HEIGHT - e.endCoordinates.height;
      const cardTop = SCREEN_HEIGHT - insets.bottom - CONTENT_BOTTOM_PADDING - cardHeightRef.current;
      const buttonBottom = cardTop + continueButtonLayoutRef.current.y + continueButtonLayoutRef.current.height;
      const lift = Math.max(0, buttonBottom + TARGET_GAP_ABOVE_KEYBOARD - keyboardTop);
      cardLift.value = withTiming(lift, { duration, easing: Easing.out(Easing.quad) });
      logoLift.value = withTiming(lift * 0.35, { duration, easing: Easing.out(Easing.quad) });
      logoScale.value = withTiming(0.86, { duration, easing: Easing.out(Easing.quad) });
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      const duration = e.duration || 250;
      cardLift.value = withTiming(0, { duration });
      logoLift.value = withTiming(0, { duration });
      logoScale.value = withTiming(1, { duration });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom, cardLift, logoLift, logoScale]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -cardLift.value }],
  }));
  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -logoLift.value }, { scale: logoScale.value }],
  }));

  function handleCardLayout(e: LayoutChangeEvent) {
    cardHeightRef.current = e.nativeEvent.layout.height;
  }
  function handleContinueButtonLayout(e: LayoutChangeEvent) {
    continueButtonLayoutRef.current = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
  }

  const leaves = useMemo<FallingLeafConfig[]>(
    () => [
      { source: LEAVES[0], startX: SCREEN_WIDTH * 0.04, size: 42, duration: 9000, delay: 0, drift: 22, rotateAmount: 220, opacity: 0.8 },
      { source: LEAVES[1], startX: SCREEN_WIDTH * 0.2, size: 28, duration: 11000, delay: 1800, drift: 30, rotateAmount: 200, opacity: 0.75 },
      { source: LEAVES[2], startX: SCREEN_WIDTH * 0.36, size: 36, duration: 10000, delay: 900, drift: 25, rotateAmount: 240, opacity: 0.8 },
      { source: LEAVES[3], startX: SCREEN_WIDTH * 0.52, size: 46, duration: 12000, delay: 2500, drift: 35, rotateAmount: 210, opacity: 0.7 },
      { source: LEAVES[4], startX: SCREEN_WIDTH * 0.68, size: 34, duration: 10500, delay: 1400, drift: 26, rotateAmount: 250, opacity: 0.75 },
      { source: LEAVES[0], startX: SCREEN_WIDTH * 0.82, size: 30, duration: 9800, delay: 3200, drift: 24, rotateAmount: 230, opacity: 0.75 },
      { source: LEAVES[2], startX: SCREEN_WIDTH * 0.93, size: 38, duration: 11500, delay: 2000, drift: 28, rotateAmount: 200, opacity: 0.8 },
    ],
    [],
  );

  async function handleSubmit() {
    if (!username.trim() || !password || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { data: email, error: resolveError } = await supabase.rpc('resolve_thera_login_email', {
        p_username: username.trim(),
      });
      if (resolveError) throw resolveError;
      if (!email) throw new Error('Invalid login credentials');
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      if (data.session) {
        router.push('/activate');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (message.toLowerCase().includes('invalid login credentials')) {
        setError(t('invalidCredentials'));
      } else {
        setError(t('connectionError'));
      }
      if (__DEV__) console.warn('TheraHOME account sign-in failed:', e);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!username.trim() && !!password && !submitting;

  return (
    <ImageBackground source={BG} resizeMode="cover" style={styles.screen}>
      {/* Tapping anywhere that isn't itself an interactive control (the two
          TextInputs, the back/eye/continue buttons — RN's touch responder
          system lets those claim their own taps without this firing)
          dismisses the keyboard. */}
      <Pressable style={styles.dismissLayer} onPress={Keyboard.dismiss}>
      <View style={[StyleSheet.absoluteFill, styles.darkOverlay]} />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {leaves.map((leaf, index) => (
          <FallingLeaf key={index} {...leaf} reduceMotion={reduceMotion} />
        ))}
      </View>

      <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 16 }]} hitSlop={8}>
        <Icon name="chevron-left" size={20} color="#16213A" />
      </Pressable>

      <View style={[styles.content, { paddingBottom: insets.bottom + CONTENT_BOTTOM_PADDING }]}>
        <Animated.View style={[styles.logoWrap, logoAnimatedStyle]}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>
            Thera<Text style={styles.brandBlue}>HOME</Text>
          </Text>
        </Animated.View>

        <Animated.View style={cardAnimatedStyle}>
        <View style={styles.card} onLayout={handleCardLayout}>
          <Text style={styles.title}>{t('signIn')}</Text>
          <View style={styles.titleUnderline} />

          <View style={styles.inputWrap}>
            <Icon name="user" size={20} color="#78B8FF" />
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder={t('username')}
              placeholderTextColor="#7388A8"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <View style={styles.inputWrap}>
            <Icon name="lock" size={20} color="#78B8FF" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('password')}
              placeholderTextColor="#7388A8"
              autoCapitalize="none"
              secureTextEntry={!showPassword}
              style={styles.input}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={12}>
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color="#78B8FF" />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            onLayout={handleContinueButtonLayout}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.continueButton,
              !canSubmit && styles.continueButtonDisabled,
              pressed && canSubmit ? styles.continueButtonPressed : null,
            ]}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueText}>{t('continue')}</Text>}
          </Pressable>

          <Text style={styles.footnote}>{t('theraAccountFootnote')}</Text>
        </View>
        </Animated.View>
      </View>
      </Pressable>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#08172F',
  },
  dismissLayer: {
    flex: 1,
  },
  darkOverlay: {
    backgroundColor: 'rgba(5, 17, 38, 0.42)',
  },
  leaf: {
    position: 'absolute',
    top: 0,
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 26,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: LOGO_CARD_GAP,
  },
  logo: {
    width: 130,
    height: 130,
  },
  brand: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 36,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  brandBlue: {
    color: '#00A8FF',
  },
  card: {
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(0,168,255,0.35)',
    padding: 22,
    backgroundColor: 'rgba(8,23,47,0.62)',
  },
  title: {
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 32,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  titleUnderline: {
    alignSelf: 'center',
    width: 60,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#00A8FF',
    marginTop: 8,
    marginBottom: 22,
    shadowColor: '#00A8FF',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  inputWrap: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(83,200,255,0.35)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    backgroundColor: 'rgba(5,21,48,0.55)',
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 16,
  },
  errorText: {
    fontSize: 12.5,
    color: '#FF8A8A',
    textAlign: 'center',
    marginBottom: 10,
  },
  continueButton: {
    minHeight: 58,
    marginTop: 6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#078BFF',
    shadowColor: '#00A8FF',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footnote: {
    marginTop: 14,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
});
