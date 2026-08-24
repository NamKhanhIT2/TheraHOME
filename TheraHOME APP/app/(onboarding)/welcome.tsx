import React from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

const HERO_BG = require('../../assets/welcome.jpg');
// The real designed brand mark (not `BrandMark.tsx`'s hand-approximated SVG
// paths) — `brandmark-glow.png` is that same artwork but white-on-transparent,
// built for the dark backgrounds `login.tsx`/`thera-login.tsx`/
// `AnalyzingHud.tsx` render it on; this screen's background is light, so
// white-on-transparent would be nearly invisible. `brandmark-blue.png` is a
// one-off recolor of the identical alpha mask to the app's electric blue,
// same real logo, just the color variant that actually reads on a light
// photo.
const LOGO = require('../../assets/brandmark-blue.png');

const NAVY = '#16213A';
const BLUE = '#078BFF';
const CYAN = '#00A8FF';
const GRAY = '#6B7480';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <ImageBackground source={HERO_BG} resizeMode="cover" style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 22 }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>TheraHOME</Text>
        <Text style={styles.subtitle}>{t('personalRoadmapSubtitle')}</Text>
        <Text style={styles.desc}>{t('welcomeDesc')}</Text>
      </View>

      <View style={[styles.bottomBlock, { paddingBottom: insets.bottom + 22 }]}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
          onPress={() => router.push('/questions')}
        >
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="primaryGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={CYAN} />
                <Stop offset="1" stopColor={BLUE} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" rx={29} fill="url(#primaryGrad)" />
          </Svg>
          <Text style={styles.primaryBtnText}>{t('startForNewUser')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.secondaryBtnText}>{t('haveAccount')}</Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Icon name="shield" size={14} color={GRAY} strokeWidth={2} />
          <Text style={styles.legal}>
            {t('byContinuingAgree')}{' '}
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 84,
    height: 84,
  },
  title: {
    marginTop: 8,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: NAVY,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '700',
    color: BLUE,
  },
  desc: {
    marginTop: 10,
    fontSize: 13.5,
    lineHeight: 19,
    color: GRAY,
    textAlign: 'center',
  },
  bottomBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: BLUE,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  btnPressed: {
    opacity: 0.85,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    width: '100%',
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(7,139,255,0.5)',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: NAVY,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 6,
  },
  legal: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: GRAY,
  },
  legalLink: {
    color: NAVY,
    fontWeight: '700',
  },
});
