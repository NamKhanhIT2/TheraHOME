import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/icons/Icon';
import { AppleLogo } from '@/components/AppleLogo';
import { GoogleGLogo } from '@/components/GoogleGLogo';
import { LoginOrbitHud } from '@/components/onboarding/LoginOrbitHud';
import { hapticHoverTick } from '@/lib/haptics';
import { signInWithGoogle } from '@/lib/googleAuth';
import { signInWithApple } from '@/lib/appleAuth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { preloadAllOnboardingImages } from '@/lib/onboardingImagePreload';
import { useAppStore } from '@/store/useAppStore';

// Exact color system per CLAUDE.md's "THERAHOME FUTURISTIC LOGIN" spec.
const BACKDROP_COLOR = '#08172F';
// The supplied login artwork already contains the centered TheraHOME mark.
// LoginOrbitHud therefore renders only transparent rings around that mark.
const LOGIN_BACKGROUND = require('../../assets/login.png');

// thera-login.tsx's own image assets are otherwise decoded for the first
// time only once that screen mounts, which is what made navigating there
// from here feel slow — prefetching them while the user is still looking
// at this screen (a few seconds' head start, typically) lets the native
// image cache have them ready before they tap the button. See CLAUDE.md.
// The 5 leaf sprites are included here too, not just the background/logo:
// they were user-supplied replacements added after the first perf pass and
// were never downscaled, so they were still a multi-megabyte decode cost
// on first mount even after that pass shipped.
const THERA_LOGIN_BG = require('../../assets/login_background.jpg');
const THERA_LOGIN_LOGO = require('../../assets/brandmark-glow.png');
const THERA_LOGIN_LEAVES = [
  require('../../assets/leaf01.png'),
  require('../../assets/leaf02.png'),
  require('../../assets/leaf03.png'),
  require('../../assets/leaf04.png'),
  require('../../assets/leaf05.png'),
];

/** Wraps a Pressable with a 1 → 0.985 → 1 press-in/out scale (reanimated,
 * UI thread) plus a light haptic tick — used by all three sign-in buttons.
 * Apple's button used to be the native system control (which animates its
 * own press feedback) but is now a custom button like the other two, so
 * its size/typography can actually match them — see CLAUDE.md. */
function PressScale({ onPress, disabled, style, children }: { onPress: () => void; disabled?: boolean; style?: object; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    // `width: '100%'` here is load-bearing: bottomBlock uses
    // `alignItems: 'center'`, so without an explicit width this wrapper
    // shrink-wraps to its content, and the inner Pressable's own
    // `width: '100%'` (set via the caller's `style`) then resolves against
    // that ambiguous, content-sized parent instead of the real screen
    // width — the three sign-in buttons all end up different widths.
    <Animated.View style={[{ width: '100%' }, animatedStyle]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          hapticHoverTick();
          scale.value = withTiming(0.985, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width, height } = useWindowDimensions();
  const { t } = useI18n();
  const resetOnboardingAnswers = useAppStore((state) => state.resetOnboardingAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const backgroundOpacity = useSharedValue(0);

  const compact = height < 740;
  const hudSize = compact ? Math.min(width * 0.5, 190) : Math.min(width * 0.58, 240);
  const backgroundStyle = useAnimatedStyle(() => ({ opacity: backgroundOpacity.value }));

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  useEffect(() => {
    backgroundOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    void preloadAllOnboardingImages();
    const sources = [LOGIN_BACKGROUND, THERA_LOGIN_BG, THERA_LOGIN_LOGO, ...THERA_LOGIN_LEAVES];
    for (const source of sources) {
      const uri = Image.resolveAssetSource(source)?.uri;
      // `Image.prefetch` rejects when Metro/the network briefly disconnects.
      // This is only a cache warm-up, so it must never become an unhandled
      // rejection or block the login screen.
      if (uri) void Image.prefetch(uri).catch(() => false);
    }
    // Reanimated shared values are stable for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `login.tsx` is shared by two very different callers: a brand-new user
  // arriving here at the *end* of welcome→questions→consent (their answers
  // only exist locally in zustand until this moment, and the profile row's
  // `onboarding_completed` trigger-default is `true` — see CLAUDE.md — so it
  // must be force-reset to `false` here or they'd land straight in the app
  // with nothing ever persisted), and a *returning* user who tapped "Đã có
  // tài khoản" to sign back in with an account that already finished
  // onboarding. Only the first case should reset/replay onboarding — doing
  // it unconditionally wiped a returning user's `onboarding_completed`/
  // `country_confirmed` back to false on *every single login*, which put
  // RootNavigator's gate and this screen's own `router.replace('/questions')`
  // into a race that manifested as a splash screen that never settled.
  // `created_at === last_sign_in_at` is Supabase's own signal for "this is
  // the first sign-in ever for this identity."
  async function startOAuthOnboarding(userId: string, isNewUser: boolean) {
    if (!isNewUser) {
      router.replace('/');
      return;
    }
    resetOnboardingAnswers();
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ onboarding_completed: false, country_confirmed: false })
      .eq('id', userId);
    if (profileError) throw profileError;
    await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    router.replace('/questions');
  }

  async function handleGoogleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const session = await signInWithGoogle();
      if (session) {
        await startOAuthOnboarding(session.user.id, session.user.created_at === session.user.last_sign_in_at);
      }
      // A null session means the user cancelled the browser sheet — stay put.
    } catch (e) {
      // Most likely cause pre-launch: the Google provider isn't configured
      // in the Supabase dashboard yet (see CLAUDE.md's setup steps).
      setError(t('googleSignInError'));
      if (__DEV__) console.warn('Google sign-in failed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const session = await signInWithApple();
      if (session) {
        await startOAuthOnboarding(session.user.id, session.user.created_at === session.user.last_sign_in_at);
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'ERR_REQUEST_CANCELED') {
        // User dismissed the native Apple sheet — stay put, no error banner.
      } else {
        setError(t('appleSignInError'));
        if (__DEV__) console.warn('Apple sign-in failed:', e);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: BACKDROP_COLOR }]}>
      <Animated.Image
        source={LOGIN_BACKGROUND}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, styles.backgroundImage, backgroundStyle]}
      />
      <View pointerEvents="none" style={styles.backgroundTint} />
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="loginNavyFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#031126" stopOpacity={0} />
            <Stop offset="38%" stopColor="#031126" stopOpacity={0.04} />
            <Stop offset="58%" stopColor="#031126" stopOpacity={0.62} />
            <Stop offset="76%" stopColor="#031126" stopOpacity={0.94} />
            <Stop offset="100%" stopColor="#031126" stopOpacity={1} />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#loginNavyFade)" />
      </Svg>
      <View
        style={[
          styles.hudArea,
          {
            // login.png is a portrait 9:16 artwork and its baked logo is
            // centered at roughly 28.2% of the image height.
            top: height * 0.282 - hudSize / 2,
          },
        ]}
        pointerEvents="none"
      >
        <LoginOrbitHud size={hudSize} />
      </View>
      <View style={[styles.bottomBlock, { paddingBottom: 22 + insets.bottom }]}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            Thera<Text style={styles.titleAccent}>HOME</Text>
          </Text>
          <Text style={styles.subtitle}>{t('personalRoadmapSubtitle')}</Text>
        </View>
        {appleAvailable ? (
          <PressScale style={[styles.authBtn, { backgroundColor: '#fff' }, loading && { opacity: 0.7 }]} onPress={handleAppleSubmit} disabled={loading}>
            <AppleLogo size={27} color="#000000" />
            <Text style={[styles.authBtnText, { color: '#071426' }]}>{t('signInWithApple')}</Text>
          </PressScale>
        ) : null}
        <PressScale style={[styles.authBtn, { backgroundColor: '#fff' }, loading && { opacity: 0.7 }]} onPress={handleGoogleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#16213A" />
          ) : (
            <>
              <GoogleGLogo size={25} />
              <Text style={[styles.authBtnText, { color: '#15233A' }]}>{t('signInWithGoogle')}</Text>
            </>
          )}
        </PressScale>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('or')}</Text>
          <View style={styles.dividerLine} />
        </View>
        <PressScale style={styles.theraBtn} onPress={() => router.push('/thera-login')}>
          <Icon name="user" size={19} color="#F3F7FC" />
          <Text style={styles.theraBtnText}>{t('signInWithTheraAccount')}</Text>
        </PressScale>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.legal}>
          {t('loginLegalPrefix')}{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/profile/legal/terms')}>
            {t('terms')}
          </Text>{' '}
          {t('and')}{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/profile/legal/privacy')}>
            {t('privacy')}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  backgroundTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(1, 13, 33, 0.025)',
  },
  hudArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bottomBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 13,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  titleAccent: {
    color: '#00A8FF',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#D2DCEB',
    marginTop: 5,
  },
  // Apple and Google share this one style — same height/radius/gap/font,
  // only background/text/icon colors differ per-button — so they carry
  // identical visual weight instead of one being a native system button
  // with its own fixed (smaller) typography.
  authBtn: {
    width: '100%',
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
    borderRadius: 31,
  },
  authBtnText: {
    fontWeight: '600',
    fontSize: 18,
  },
  divider: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#50627C',
  },
  dividerText: {
    fontSize: 12,
    color: '#8392A8',
  },
  theraBtn: {
    width: '100%',
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#75849B',
    borderRadius: 31,
  },
  theraBtnText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#F3F7FC',
    textAlign: 'center',
    flexShrink: 1,
  },
  legal: {
    fontSize: 11,
    color: '#9EABBD',
    lineHeight: 16,
    textAlign: 'center',
  },
  legalLink: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12.5,
    color: '#FF8A8A',
    textAlign: 'center',
  },
});
