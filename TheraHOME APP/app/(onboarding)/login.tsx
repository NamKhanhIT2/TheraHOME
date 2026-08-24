import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { AppleLogo } from '@/components/AppleLogo';
import { GoogleGLogo } from '@/components/GoogleGLogo';
import { LoginOrbitHud } from '@/components/onboarding/LoginOrbitHud';
import { hapticHoverTick } from '@/lib/haptics';
import { signInWithGoogle } from '@/lib/googleAuth';
import { signInWithApple } from '@/lib/appleAuth';
import { useI18n } from '@/lib/i18n';

// Exact color system per CLAUDE.md's "THERAHOME FUTURISTIC LOGIN" spec.
const BACKDROP_COLOR = '#08172F';

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
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  useEffect(() => {
    const sources = [THERA_LOGIN_BG, THERA_LOGIN_LOGO, ...THERA_LOGIN_LEAVES];
    for (const source of sources) {
      const uri = Image.resolveAssetSource(source)?.uri;
      if (uri) void Image.prefetch(uri);
    }
  }, []);

  async function handleGoogleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const session = await signInWithGoogle();
      if (session) {
        router.push('/activate');
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
        router.push('/activate');
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
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + 16 }]}
        hitSlop={8}
      >
        <Icon name="chevron-left" size={20} color={theme.colors.textPrimary} />
      </Pressable>
      <View style={[styles.hudArea, { top: insets.top + 20 }]} pointerEvents="none">
        <LoginOrbitHud />
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
          <Text style={styles.legalLink} onPress={() => router.push('/profile/legal/security')}>
            {t('security')}
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
