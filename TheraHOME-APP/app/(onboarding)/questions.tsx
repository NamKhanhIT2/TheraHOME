import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useOnboardingContent } from '@/hooks/useOnboardingContent';
import { useAppStore, type AnswerValue } from '@/store/useAppStore';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { OptionCard } from '@/components/ui/OptionCard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import {
  areFirstQuestionImagesReady,
  preloadAllOnboardingImages,
  preloadFirstQuestionImages,
} from '@/lib/onboardingImagePreload';

const PRIORITY_IMAGES = [
  require('../../assets/onboarding/priority-neck.png'),
  require('../../assets/onboarding/priority-back.png'),
  require('../../assets/onboarding/priority-full.png'),
];

const GOAL_IMAGES = [
  require('../../assets/onboarding/goal-sleep.png'),
  require('../../assets/onboarding/goal-work.png'),
  require('../../assets/onboarding/goal-spine.png'),
  require('../../assets/onboarding/goal-complete.png'),
];

const ACTIVITY_IMAGES = [
  require('../../assets/onboarding/goal-work.png'),
  require('../../assets/onboarding/activity-shoes.png'),
  require('../../assets/onboarding/activity-weights.png'),
  require('../../assets/onboarding/goal-spine.png'),
];

const TIME_IMAGES = [
  require('../../assets/onboarding/activity-hero.png'),
  require('../../assets/onboarding/time-medium.png'),
  require('../../assets/onboarding/time-long.png'),
];

const LIFESTYLE_HERO_IMAGES = {
  daily_activity: require('../../assets/onboarding/activity-hero.png'),
  daily_time: require('../../assets/onboarding/time-hero.png'),
};

const TENSION_HERO_IMAGE = require('../../assets/onboarding/tension-hero.png');
const TENSION_POSES_IMAGE = require('../../assets/onboarding/tension-poses-clean.png');
const AGE_HERO_IMAGE = require('../../assets/onboarding/age-hero.png');
const HOME_REASON_SPRITE = require('../../assets/onboarding/home-reason-sprite.png');
const TENSION_TIMING_SPRITE = require('../../assets/onboarding/tension-timing-sprite.png');
const TENSION_TIMING_HERO = require('../../assets/onboarding/tension-timing-hero.png');

const TENSION_TITLES = {
  vi: ['Cơ thể bạn', 'thường cảm thấy ', 'thế nào?'],
  en: ['How does your body', 'usually ', 'feel?'],
  ms: ['Bagaimana keadaan tubuh', 'anda ', 'biasanya?'],
} as const;

const LIFESTYLE_TITLES = {
  daily_activity: {
    vi: ['Một ngày của bạn\nthường ', 'vận động', '\nnhư thế nào?'],
    en: ['How ', 'active', '\nis your typical day?'],
    ms: ['Bagaimana ', 'pergerakan', '\nharian anda?'],
  },
  daily_time: {
    vi: ['Bạn có thể dành bao nhiêu\nthời gian mỗi ngày để\n', 'chăm sóc cơ thể?', ''],
    en: ['How much time can you spend\neach day on ', 'body care?', ''],
    ms: ['Berapa lama masa setiap hari\nuntuk ', 'menjaga tubuh?', ''],
  },
} as const;

const TIME_TITLE_LINES = {
  vi: ['Bạn có thể dành bao nhiêu', 'thời gian mỗi ngày để', 'chăm sóc cơ thể?'],
  en: ['How much time can you spend', 'each day taking care of', 'your body?'],
  ms: ['Berapa lama masa setiap hari', 'yang boleh anda luangkan untuk', 'menjaga tubuh?'],
} as const;

const GOAL_TITLES = {
  vi: ['Mục tiêu chính\ncủa bạn ', 'là gì?'],
  en: ['What is your\nmain ', 'goal?'],
  ms: ['Apakah matlamat\nutama ', 'anda?'],
} as const;

const HOME_REASON_TITLES = {
  vi: ['Điều gì khiến bạn\nchọn ', 'chăm sóc tại nhà?'],
  en: ['Why did you choose\n', 'care at home?'],
  ms: ['Mengapa anda memilih\n', 'penjagaan di rumah?'],
} as const;

const HOME_REASON_SUBTITLES = {
  vi: 'Chọn tất cả mục phù hợp với bạn',
  en: 'Choose all options that suit you',
  ms: 'Pilih semua pilihan yang sesuai',
} as const;

const TENSION_TIMING_TITLES = {
  vi: ['Khi nào bạn\nthường cảm thấy\n', 'căng mỏi nhất?'],
  en: ['When do you usually\nfeel the most\n', 'tense?'],
  ms: ['Bilakah anda paling\nkerap berasa\n', 'tegang?'],
} as const;

const TENSION_TIMING_SUBTITLES = {
  vi: 'Chọn tất cả thời điểm phù hợp với bạn.',
  en: 'Choose all times that apply to you.',
  ms: 'Pilih semua masa yang sesuai untuk anda.',
} as const;

const AGE_ICON_PALETTES = [
  { foreground: '#0878EE', background: '#EAF4FF' },
  { foreground: '#16AF86', background: '#E9F9F4' },
  { foreground: '#0878EE', background: '#EAF4FF' },
  { foreground: '#F29A1D', background: '#FFF4E3' },
  { foreground: '#8046D7', background: '#F3ECFF' },
] as const;

// Illustrative leading icon per answer option — index-matched to each
// question's `options` array (same order across vi/en/ms in mockData.ts),
// not the localized text, so this stays correct regardless of language.
const OPTION_ICONS: Record<string, string[]> = {
  goal_main: ['moon', 'trending-up', 'calendar', 'star'],
  priority_zone: ['user', 'shield', 'accessibility'],
  home_reason: ['clock', 'users', 'home'],
  tension_level: ['heart', 'activity', 'trending-up', 'bell'],
  tension_timing: ['sun', 'book', 'moon', 'calendar'],
  age_group: ['user', 'user', 'user', 'user', 'user'],
  daily_activity: ['book', 'accessibility', 'dumbbell', 'grid'],
  daily_time: ['clock', 'clock', 'clock'],
};

function SpriteCell({
  source,
  index,
  size,
  style,
}: {
  source: ImageSourcePropType;
  index: number;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return (
    <View pointerEvents="none" style={[{ width: size, height: size, overflow: 'hidden' }, style]}>
      <Image
        source={source}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: size * 2,
          height: size * 2,
          left: -column * size,
          top: -row * size,
        }}
      />
    </View>
  );
}

function OptionReveal({
  progress,
  fill = true,
  children,
}: {
  progress: Animated.Value;
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      style={[
        fill ? styles.revealFill : undefined,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function QuestionPreloadSkeleton({ pulse }: { pulse: Animated.Value }) {
  const { t } = useI18n();
  return (
    <Animated.View
      pointerEvents="auto"
      accessibilityLabel={t('a11yPreparingQuestions')}
      style={[styles.preloadOverlay, { opacity: pulse }]}
    >
      <View style={[styles.skeletonBlock, styles.skeletonHero]} />
      <View style={styles.skeletonCards}>
        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={[styles.skeletonBlock, styles.skeletonCard]} />
        ))}
      </View>
    </Animated.View>
  );
}

export default function QuestionsScreen() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const { t } = useI18n();
  const reduceMotion = useReduceMotion();
  const savedQuestionIndex = useAppStore((s) => s.onboardingQuestionIndex);
  const setSavedQuestionIndex = useAppStore((s) => s.setOnboardingQuestionIndex);
  const [qIndex, setQIndex] = useState(savedQuestionIndex);
  const [assetsReady, setAssetsReady] = useState(areFirstQuestionImagesReady);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const answers = useAppStore((s) => s.onboardingAnswers);
  const setAnswer = useAppStore((s) => s.setAnswer);
  const language = useAppStore((s) => s.language);
  // Bundled wording + admin overrides (option COUNT stays fixed — see
  // useOnboardingContent's safety rule).
  const questions = useOnboardingContent().getQuestions(language);

  const q = questions[qIndex];
  const isMulti = !!q.multi;
  const storedAnswer = answers[q.key];
  // Persisted onboarding data can come from an older session/language (or an
  // older schema where a multi answer was accidentally stored as a string).
  // Only a value that visibly matches an option on this screen is considered
  // answered; hidden/stale values must never unlock Continue.
  const selectedSingle = !isMulti && typeof storedAnswer === 'string' && q.options.includes(storedAnswer)
    ? storedAnswer
    : undefined;
  const selectedMulti = isMulti && Array.isArray(storedAnswer)
    ? storedAnswer.filter((value): value is string => typeof value === 'string' && q.options.includes(value))
    : [];
  const canContinue = isMulti
    ? q.options.some((option) => selectedMulti.includes(option))
    : q.options.some((option) => option === selectedSingle);
  const optionIcons = OPTION_ICONS[q.key];
  const isGoalMain = q.key === 'goal_main';
  const isPriorityZone = q.key === 'priority_zone';
  const isTensionLevel = q.key === 'tension_level';
  const isHomeReason = q.key === 'home_reason';
  const isTensionTiming = q.key === 'tension_timing';
  const isEditorialMulti = isHomeReason || isTensionTiming;
  const isAgeGroup = q.key === 'age_group';
  const isDailyActivity = q.key === 'daily_activity';
  const isDailyTime = q.key === 'daily_time';
  const isLifestyleQuestion = isDailyActivity || isDailyTime;
  const isShowcaseQuestion = isGoalMain || isPriorityZone || isTensionLevel || isEditorialMulti || isAgeGroup || isLifestyleQuestion;
  const priorityCardImageWidth = Math.min(178, Math.max(132, width * 0.4));
  const goalTitle = GOAL_TITLES[language];
  const isCompactGoal = height < 760;
  const goalCardImageWidth = Math.min(126, Math.max(92, width * 0.29));
  const lifestyleKey = isDailyActivity ? 'daily_activity' : 'daily_time';
  const lifestyleTitle = LIFESTYLE_TITLES[lifestyleKey][language];
  const lifestyleImages = isDailyActivity ? ACTIVITY_IMAGES : TIME_IMAGES;
  const isCompactLifestyle = height < 780;
  const lifestyleCardImageWidth = Math.min(128, Math.max(96, width * 0.29));
  const tensionTitle = TENSION_TITLES[language];
  const isCompactTension = height < 780;
  const tensionPoseWidth = Math.min(116, Math.max(94, width * 0.28));
  const isCompactEditorial = height < 780;
  const editorialTitle = isHomeReason ? HOME_REASON_TITLES[language] : TENSION_TIMING_TITLES[language];
  const editorialSubtitle = isHomeReason ? HOME_REASON_SUBTITLES[language] : TENSION_TIMING_SUBTITLES[language];
  const isCompactAge = height < 780;

  const progressAnim = useRef(new Animated.Value((qIndex + 1) / questions.length)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const optionAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
  const skeletonPulse = useRef(new Animated.Value(0.48)).current;
  const ambientAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setSavedQuestionIndex(qIndex);
  }, [qIndex, setSavedQuestionIndex]);

  useEffect(() => {
    let cancelled = false;
    preloadFirstQuestionImages().finally(() => {
      if (!cancelled) setAssetsReady(true);
    });
    // Remaining screens continue warming in the background. They no longer
    // block question 1 from rendering.
    void preloadAllOnboardingImages();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, { toValue: 0.78, duration: 620, useNativeDriver: true }),
        Animated.timing(skeletonPulse, { toValue: 0.48, duration: 620, useNativeDriver: true }),
      ]),
    );
    pulse.start();

    return () => {
      cancelled = true;
      pulse.stop();
    };
  }, [skeletonPulse]);

  useEffect(() => {
    if (!assetsReady || reduceMotion) {
      ambientAnim.stopAnimation();
      ambientAnim.setValue(0);
      return;
    }

    const ambientLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(ambientAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ]),
    );
    ambientLoop.start();
    return () => ambientLoop.stop();
  }, [ambientAnim, assetsReady, reduceMotion]);

  useEffect(() => {
    if (!assetsReady) return;

    Animated.timing(progressAnim, {
      toValue: (qIndex + 1) / questions.length,
      duration: reduceMotion ? 0 : 320,
      useNativeDriver: false,
    }).start();
    contentAnim.setValue(0);
    optionAnims.forEach((animation) => animation.setValue(0));

    if (reduceMotion) {
      contentAnim.setValue(1);
      optionAnims.slice(0, q.options.length).forEach((animation) => animation.setValue(1));
      setIsTransitioning(false);
      return;
    }

    Animated.parallel([
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.stagger(
        42,
        optionAnims.slice(0, q.options.length).map((animation) =>
          Animated.spring(animation, {
            toValue: 1,
            damping: 18,
            stiffness: 180,
            mass: 0.75,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start(({ finished }) => {
      if (finished) setIsTransitioning(false);
    });
  }, [assetsReady, q.options.length, qIndex, contentAnim, optionAnims, progressAnim, questions.length, reduceMotion]);

  function selectAnswer(v: string) {
    if (!assetsReady || isTransitioning) return;
    if (isMulti) {
      const next = selectedMulti.includes(v) ? selectedMulti.filter((x) => x !== v) : [...selectedMulti, v];
      setAnswer(q.key, next as AnswerValue);
    } else {
      setAnswer(q.key, v);
    }
  }

  function onNext() {
    if (!assetsReady || !canContinue || isTransitioning) return;
    setIsTransitioning(true);
    if (reduceMotion) {
      if (qIndex < questions.length - 1) setQIndex((current) => current + 1);
      else router.push('/consent');
      return;
    }
    Animated.timing(contentAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      if (qIndex < questions.length - 1) setQIndex((current) => current + 1);
      else router.push('/consent');
    });
  }

  function onBack() {
    if (isTransitioning) return;
    if (qIndex > 0) {
      setIsTransitioning(true);
      if (reduceMotion) {
        setQIndex((current) => current - 1);
        return;
      }
      Animated.timing(contentAnim, { toValue: 0, duration: 130, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setQIndex((current) => current - 1);
      });
    } else {
      router.back();
    }
  }

  return (
    <ScreenContainer style={isShowcaseQuestion ? styles.priorityScreen : undefined}>
      {isShowcaseQuestion ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.decorCircleLarge,
              {
                opacity: ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
                transform: [
                  { translateY: ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
                  { scale: ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.decorCircleSmall,
              {
                opacity: ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 0.55] }),
                transform: [
                  { translateY: ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) },
                  { scale: ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
                ],
              },
            ]}
          />
          <View pointerEvents="none" style={styles.decorLine} />
        </>
      ) : null}
      <BackBar onBack={onBack} />
      <View style={styles.progressHeader}>
        <Text
          style={[
            isShowcaseQuestion ? theme.type.bodyStrong : theme.type.captionSm,
            {
              color: isPriorityZone || isTensionLevel || isEditorialMulti || isAgeGroup ? theme.colors.primary : theme.colors.textMuted,
              fontFamily: theme.fontFamily.semiBold,
            },
          ]}
        >
          {qIndex + 1}/{questions.length}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.colors.borderLight }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: theme.colors.primary,
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      {isGoalMain ? (
        <Animated.View
          style={[
            styles.goalBody,
            {
              opacity: contentAnim,
              transform: [
                {
                  translateY: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.goalHero, { minHeight: isCompactGoal ? 116 : 158 }]}>
            <View style={styles.goalHeroCopy}>
              <Text
                style={[
                  styles.goalTitle,
                  {
                    color: '#0B2D5E',
                    fontFamily: theme.fontFamily.bold,
                    fontSize: isCompactGoal ? 26 : 31,
                    lineHeight: isCompactGoal ? 31 : 37,
                  },
                ]}
              >
                {goalTitle[0]}
                <Text style={{ color: theme.colors.primary }}>{goalTitle[1]}</Text>
              </Text>
              <Text
                numberOfLines={3}
                style={[
                  styles.goalSubtitle,
                  {
                    color: '#687790',
                    fontFamily: theme.fontFamily.regular,
                    fontSize: isCompactGoal ? 11 : 13,
                    lineHeight: isCompactGoal ? 16 : 19,
                  },
                ]}
              >
                {q.subtitle}
              </Text>
            </View>
            <Image
              source={require('../../assets/onboarding/goal-hero.png')}
              resizeMode="contain"
              style={[
                styles.goalHeroImage,
                {
                  width: isCompactGoal ? 164 : 205,
                  height: isCompactGoal ? 166 : 208,
                  right: isCompactGoal ? -24 : -30,
                  bottom: isCompactGoal ? -27 : -38,
                },
              ]}
            />
          </View>

          <View style={[styles.goalOptions, { gap: isCompactGoal ? 6 : 8 }]}>
            {q.options.map((opt, i) => {
              const active = selectedSingle === opt;
              return (
                <OptionReveal key={opt} progress={optionAnims[i]}>
                  <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={opt}
                  onPress={() => selectAnswer(opt)}
                  style={({ pressed }) => [
                    styles.goalCard,
                    theme.shadows.card,
                    {
                      backgroundColor: '#FFFFFF',
                      borderColor: active ? theme.colors.primary : 'rgba(22,65,112,0.08)',
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.988 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.goalIconCircle,
                      {
                        width: isCompactGoal ? 44 : 52,
                        height: isCompactGoal ? 44 : 52,
                        borderRadius: isCompactGoal ? 22 : 26,
                      },
                    ]}
                  >
                    <Icon
                      name={optionIcons?.[i] ?? 'star'}
                      size={isCompactGoal ? 23 : 27}
                      color={theme.colors.primary}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={[styles.goalCardCopy, { paddingRight: goalCardImageWidth - 12 }]}>
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.goalCardLabel,
                        {
                          color: '#112E5A',
                          fontFamily: theme.fontFamily.semiBold,
                          fontSize: isCompactGoal ? 13.5 : 15,
                          lineHeight: isCompactGoal ? 18 : 20,
                        },
                      ]}
                    >
                      {opt}
                    </Text>
                  </View>
                  <Image
                    source={GOAL_IMAGES[i]}
                    resizeMode="contain"
                    style={[
                      styles.goalCardImage,
                      {
                        width: goalCardImageWidth,
                        height: isCompactGoal ? 66 : 78,
                      },
                    ]}
                  />
                  {active ? (
                    <View style={[styles.goalCheck, { backgroundColor: theme.colors.primary }]}>
                      <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  ) : null}
                  </Pressable>
                </OptionReveal>
              );
            })}
          </View>
        </Animated.View>
      ) : isTensionLevel ? (
        <Animated.View
          style={[
            styles.tensionBody,
            {
              opacity: contentAnim,
              transform: [
                {
                  translateY: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.tensionHero,
              { minHeight: isCompactTension ? 128 : 178 },
            ]}
          >
            <View style={styles.tensionHeroCopy}>
              <Text
                numberOfLines={1}
                style={[
                  styles.tensionTitle,
                  {
                    color: '#102D59',
                    fontFamily: theme.fontFamily.bold,
                    fontSize: isCompactTension ? 24 : 29,
                    lineHeight: isCompactTension ? 30 : 36,
                  },
                ]}
              >
                {tensionTitle[0]}
              </Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.68}
                numberOfLines={1}
                style={[
                  styles.tensionTitle,
                  {
                    color: '#102D59',
                    fontFamily: theme.fontFamily.bold,
                    fontSize: isCompactTension ? 24 : 29,
                    lineHeight: isCompactTension ? 30 : 36,
                  },
                ]}
              >
                {tensionTitle[1]}
                <Text style={{ color: theme.colors.primary }}>{tensionTitle[2]}</Text>
              </Text>
            </View>
            <View pointerEvents="none" style={styles.tensionHeroGlow} />
            <Image
              source={TENSION_HERO_IMAGE}
              resizeMode="contain"
              style={[
                styles.tensionHeroImage,
                {
                  width: isCompactTension ? 188 : 225,
                  height: isCompactTension ? 202 : 242,
                },
              ]}
            />
          </View>

          <View
            style={[
              styles.tensionOptions,
              { gap: isCompactTension ? 7 : 10 },
            ]}
          >
            {q.options.map((opt, i) => {
              const active = selectedSingle === opt;
              const spriteScale = 1.08;
              const spriteCellWidth = tensionPoseWidth * spriteScale;
              const spriteWidth = spriteCellWidth * 2;
              const spriteHeight = spriteWidth;
              const spriteCellHeight = spriteHeight / 2;
              const cropX = (spriteCellWidth - tensionPoseWidth) / 2;
              return (
                <OptionReveal key={opt} progress={optionAnims[i]}>
                  <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={opt}
                  onPress={() => selectAnswer(opt)}
                  style={({ pressed }) => [
                    styles.tensionCard,
                    theme.shadows.card,
                    {
                      backgroundColor: '#FFFFFF',
                      borderColor: active ? theme.colors.primary : 'rgba(22,65,112,0.08)',
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.988 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.tensionIconCircle,
                      {
                        width: isCompactTension ? 46 : 54,
                        height: isCompactTension ? 46 : 54,
                        borderRadius: isCompactTension ? 23 : 27,
                        backgroundColor: active ? '#DDF0FF' : '#EAF5FF',
                      },
                    ]}
                  >
                    <Icon
                      name={optionIcons?.[i] ?? 'activity'}
                      size={isCompactTension ? 24 : 28}
                      color={theme.colors.primary}
                      strokeWidth={2}
                    />
                  </View>
                  <Text
                    numberOfLines={3}
                    style={[
                      styles.tensionCardLabel,
                      {
                        color: '#112E5A',
                        fontFamily: theme.fontFamily.semiBold,
                        fontSize: isCompactTension ? 13.5 : 15.5,
                        lineHeight: isCompactTension ? 17.5 : 20,
                        paddingRight: tensionPoseWidth + 8,
                      },
                    ]}
                  >
                    {opt}
                  </Text>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.tensionPoseViewport,
                      {
                        width: tensionPoseWidth,
                        height: isCompactTension ? 72 : 88,
                        right: 28,
                      },
                    ]}
                  >
                    <Image
                      source={TENSION_POSES_IMAGE}
                      resizeMode="stretch"
                      style={{
                        position: 'absolute',
                        width: spriteWidth,
                        height: spriteHeight,
                        left: -(i % 2) * spriteCellWidth - cropX,
                        top: -Math.floor(i / 2) * spriteCellHeight - 2,
                      }}
                    />
                  </View>
                  <View
                    style={[
                      styles.lifestyleRadio,
                      active
                        ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                        : { backgroundColor: '#FFFFFF', borderColor: '#D8E2EF' },
                    ]}
                  >
                    {active ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  </Pressable>
                </OptionReveal>
              );
            })}
          </View>
        </Animated.View>
      ) : isEditorialMulti ? (
        <Animated.View
          style={[
            styles.editorialBody,
            {
              opacity: contentAnim,
              transform: [
                {
                  translateY: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.editorialHero,
              {
                minHeight: isCompactEditorial
                  ? isHomeReason ? 150 : 156
                  : isHomeReason ? 186 : 194,
              },
            ]}
          >
            <View style={[styles.editorialHeroCopy, { width: isHomeReason ? '59%' : '61%' }]}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                numberOfLines={isHomeReason ? 3 : 4}
                style={[
                  styles.editorialTitle,
                  {
                    color: '#102D59',
                    fontFamily: theme.fontFamily.bold,
                    fontSize: isCompactEditorial ? 24 : 29,
                    lineHeight: isCompactEditorial ? 30 : 36,
                  },
                ]}
              >
                {editorialTitle[0]}
                <Text style={{ color: theme.colors.primary }}>{editorialTitle[1]}</Text>
              </Text>
              <Text
                numberOfLines={language === 'ms' ? 3 : 2}
                style={[
                  styles.editorialSubtitle,
                  {
                    color: '#687790',
                    fontFamily: theme.fontFamily.regular,
                    fontSize: isCompactEditorial ? 10.5 : 12.5,
                    lineHeight: isCompactEditorial ? 15 : 18,
                  },
                ]}
              >
                {editorialSubtitle}
              </Text>
            </View>

            {isHomeReason ? (
              <SpriteCell
                source={HOME_REASON_SPRITE}
                index={0}
                size={isCompactEditorial ? 178 : 214}
                style={[
                  styles.editorialHomeHero,
                  {
                    right: isCompactEditorial ? -35 : -44,
                    bottom: isCompactEditorial ? -23 : -31,
                  },
                ]}
              />
            ) : (
              <Image
                source={TENSION_TIMING_HERO}
                resizeMode="contain"
                style={[
                  styles.editorialTimingHero,
                  {
                    width: isCompactEditorial ? 205 : 242,
                    height: isCompactEditorial ? 173 : 205,
                    right: isCompactEditorial ? -25 : -31,
                    bottom: isCompactEditorial ? -19 : -23,
                  },
                ]}
              />
            )}
          </View>

          <View style={[styles.editorialOptions, { gap: isCompactEditorial ? 7 : 10 }]}>
            {q.options.map((opt, i) => {
              const active = selectedMulti.includes(opt);
              const palette = isHomeReason
                ? [
                    { border: '#B9DDF7', background: '#F8FCFF' },
                    { border: '#B7E5D3', background: '#F8FDFB' },
                    { border: '#F3D29A', background: '#FFFCF7' },
                  ][i]
                : [
                    { border: '#F5CF8E', background: '#FFFCF4' },
                    { border: '#B5DCF5', background: '#F7FBFF' },
                    { border: '#D7CBF5', background: '#FBF9FF' },
                    { border: '#B9E7D4', background: '#F6FCF9' },
                  ][i];
              const artSize = isCompactEditorial
                ? isHomeReason ? 76 : 70
                : isHomeReason ? 90 : 82;
              return (
                <OptionReveal key={opt} progress={optionAnims[i]}>
                  <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={opt}
                  onPress={() => selectAnswer(opt)}
                  style={({ pressed }) => [
                    styles.editorialCard,
                    theme.shadows.card,
                    {
                      backgroundColor: palette.background,
                      borderColor: active ? palette.border : 'rgba(22,65,112,0.08)',
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.988 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.editorialIconCircle,
                      {
                        width: isCompactEditorial ? 48 : 56,
                        height: isCompactEditorial ? 48 : 56,
                        borderRadius: isCompactEditorial ? 24 : 28,
                        backgroundColor: isHomeReason && i === 1 ? '#E8F8F1' : i === 2 ? '#FFF4E3' : '#EAF5FF',
                      },
                    ]}
                  >
                    <Icon
                      name={optionIcons?.[i] ?? 'home'}
                      size={isCompactEditorial ? 24 : 28}
                      color={isHomeReason && i === 1 ? '#27A66F' : i === 2 ? '#F29A1D' : theme.colors.primary}
                      strokeWidth={2}
                    />
                  </View>
                  <Text
                    numberOfLines={3}
                    style={[
                      styles.editorialCardLabel,
                      {
                        color: '#112E5A',
                        fontFamily: theme.fontFamily.semiBold,
                        fontSize: isCompactEditorial ? 13.5 : 15.5,
                        lineHeight: isCompactEditorial ? 17.5 : 20,
                        paddingRight: artSize - 14,
                      },
                    ]}
                  >
                    {opt}
                  </Text>
                  <SpriteCell
                    source={isHomeReason ? HOME_REASON_SPRITE : TENSION_TIMING_SPRITE}
                    index={isHomeReason ? i + 1 : i}
                    size={artSize}
                    style={[
                      styles.editorialCardArt,
                      { right: isCompactEditorial ? 19 : 24, bottom: isCompactEditorial ? -3 : -5 },
                    ]}
                  />
                  <View
                    style={[
                      styles.editorialCheck,
                      active
                        ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                        : { backgroundColor: '#FFFFFF', borderColor: '#D7E1ED' },
                    ]}
                  >
                    {active ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  </Pressable>
                </OptionReveal>
              );
            })}
          </View>
        </Animated.View>
      ) : isAgeGroup ? (
        <Animated.View
          style={[
            styles.ageBody,
            {
              opacity: contentAnim,
              transform: [
                {
                  translateY: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.ageHero, { minHeight: isCompactAge ? 132 : 178 }]}>
            <View style={styles.ageHeroCopy}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                numberOfLines={language === 'ms' ? 3 : 2}
                style={[
                  styles.ageHeroTitle,
                  {
                    color: '#102D59',
                    fontFamily: theme.fontFamily.bold,
                    fontSize: isCompactAge ? 27 : 32,
                    lineHeight: isCompactAge ? 33 : 39,
                  },
                ]}
              >
                {q.title}
              </Text>
            </View>
            <View pointerEvents="none" style={styles.ageHeroGlow} />
            <Image
              source={AGE_HERO_IMAGE}
              resizeMode="contain"
              style={[
                styles.ageHeroImage,
                {
                  width: isCompactAge ? 174 : 198,
                  height: isCompactAge ? 116 : 132,
                  right: isCompactAge ? -8 : -12,
                  bottom: isCompactAge ? -3 : -5,
                },
              ]}
            />
          </View>

          <View style={[styles.ageOptions, { gap: isCompactAge ? 7 : 10 }]}>
            {q.options.map((opt, i) => {
              const active = selectedSingle === opt;
              const palette = AGE_ICON_PALETTES[i];
              return (
                <OptionReveal key={opt} progress={optionAnims[i]}>
                  <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={opt}
                  onPress={() => selectAnswer(opt)}
                  style={({ pressed }) => [
                    styles.ageCard,
                    theme.shadows.card,
                    {
                      backgroundColor: '#FFFFFF',
                      borderColor: active ? theme.colors.primary : 'rgba(22,65,112,0.08)',
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.988 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.ageIconBox,
                      {
                        width: isCompactAge ? 52 : 62,
                        height: isCompactAge ? 52 : 62,
                        borderRadius: isCompactAge ? 15 : 18,
                        backgroundColor: active ? theme.colors.primary : palette.background,
                      },
                    ]}
                  >
                    <Icon
                      name="user"
                      size={isCompactAge ? 27 : 31}
                      color={active ? '#FFFFFF' : palette.foreground}
                      strokeWidth={1.9}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.ageCardLabel,
                      {
                        color: active ? theme.colors.primary : '#112E5A',
                        fontFamily: theme.fontFamily.semiBold,
                        fontSize: isCompactAge ? 16 : 18,
                      },
                    ]}
                  >
                    {opt}
                  </Text>
                  <View
                    style={[
                      styles.ageRadio,
                      active
                        ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                        : { backgroundColor: '#FFFFFF', borderColor: '#D8E2EF' },
                    ]}
                  >
                    {active ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  </Pressable>
                </OptionReveal>
              );
            })}
          </View>
        </Animated.View>
      ) : isLifestyleQuestion ? (
        <Animated.View
          style={[
            styles.lifestyleBody,
            {
              opacity: contentAnim,
              transform: [
                {
                  translateY: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.lifestyleHero,
              {
                minHeight: isCompactLifestyle
                  ? isDailyActivity ? 132 : 142
                  : isDailyActivity ? 188 : 180,
              },
            ]}
          >
            <View
              style={[
                styles.lifestyleHeroCopy,
                { width: isDailyActivity ? '66%' : '64%' },
              ]}
            >
              {isDailyTime ? (
                <View style={styles.timeTitleBlock}>
                  {TIME_TITLE_LINES[language].map((line, index) => (
                    <Text
                      key={`${line}-${index}`}
                      adjustsFontSizeToFit
                      minimumFontScale={0.66}
                      numberOfLines={1}
                      style={[
                        styles.timeTitleLine,
                        {
                          color: index === 2 ? theme.colors.primary : '#102D59',
                          fontFamily: theme.fontFamily.bold,
                          fontSize: isCompactLifestyle ? 19 : 22,
                          lineHeight: isCompactLifestyle ? 23 : 27,
                        },
                      ]}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  numberOfLines={3}
                  style={[
                    styles.lifestyleTitle,
                    {
                      color: '#102D59',
                      fontFamily: theme.fontFamily.bold,
                      fontSize: isCompactLifestyle ? 23 : 29,
                      lineHeight: isCompactLifestyle ? 28 : 35,
                    },
                  ]}
                >
                  {lifestyleTitle[0]}
                  <Text style={{ color: theme.colors.primary }}>{lifestyleTitle[1]}</Text>
                  {lifestyleTitle[2]}
                </Text>
              )}
              <Text
                numberOfLines={3}
                style={[
                  styles.lifestyleSubtitle,
                  {
                    color: '#687790',
                    fontFamily: theme.fontFamily.regular,
                    fontSize: isCompactLifestyle ? 10.5 : 12.5,
                    lineHeight: isCompactLifestyle ? 15 : 18,
                    width: '100%',
                  },
                ]}
              >
                {q.subtitle}
              </Text>
            </View>
            <Image
              source={LIFESTYLE_HERO_IMAGES[lifestyleKey]}
              resizeMode="contain"
              style={[
                styles.lifestyleHeroImage,
                isDailyActivity ? styles.activityHeroImage : styles.timeHeroImage,
                {
                  width: isDailyTime
                    ? isCompactLifestyle ? 232 : 270
                    : isCompactLifestyle ? 196 : 238,
                  height: isDailyTime
                    ? isCompactLifestyle ? 155 : 180
                    : isCompactLifestyle ? 151 : 190,
                },
              ]}
            />
          </View>

          <View style={[styles.lifestyleOptions, { gap: isCompactLifestyle ? 7 : 10 }]}>
            {q.options.map((opt, i) => {
              const active = selectedSingle === opt;
              const timeCardImageStyle = isDailyTime
                ? [
                    {
                      width: isCompactLifestyle ? 150 : 174,
                      height: isCompactLifestyle ? 100 : 116,
                      right: isCompactLifestyle ? 3 : 5,
                      bottom: 0,
                    },
                    {
                      width: isCompactLifestyle ? 92 : 108,
                      height: isCompactLifestyle ? 106 : 128,
                      right: isCompactLifestyle ? 25 : 28,
                      bottom: 0,
                    },
                    {
                      width: isCompactLifestyle ? 88 : 102,
                      height: isCompactLifestyle ? 108 : 130,
                      right: isCompactLifestyle ? 28 : 32,
                      bottom: 0,
                    },
                  ][i]
                : undefined;
              return (
                <OptionReveal key={opt} progress={optionAnims[i]}>
                  <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={opt}
                  onPress={() => selectAnswer(opt)}
                  style={({ pressed }) => [
                    styles.lifestyleCard,
                    theme.shadows.card,
                    {
                      backgroundColor: '#FFFFFF',
                      borderColor: active ? theme.colors.primary : 'rgba(22,65,112,0.08)',
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.988 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.lifestyleIconCircle,
                      {
                        width: isCompactLifestyle ? 46 : 54,
                        height: isCompactLifestyle ? 46 : 54,
                        borderRadius: isCompactLifestyle ? 23 : 27,
                      },
                    ]}
                  >
                    <Icon
                      name={optionIcons?.[i] ?? 'activity'}
                      size={isCompactLifestyle ? 24 : 28}
                      color={theme.colors.primary}
                      strokeWidth={2}
                    />
                  </View>
                  <View
                    style={[
                      styles.lifestyleCardCopy,
                      {
                        paddingRight: isDailyTime
                          ? isCompactLifestyle ? 86 : 104
                          : lifestyleCardImageWidth + 2,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={3}
                      style={[
                        styles.lifestyleCardLabel,
                        {
                          color: '#112E5A',
                          fontFamily: theme.fontFamily.semiBold,
                          fontSize: isCompactLifestyle ? 13.5 : 15.5,
                          lineHeight: isCompactLifestyle ? 17.5 : 20,
                        },
                      ]}
                    >
                      {opt}
                    </Text>
                  </View>
                  <Image
                    source={lifestyleImages[i]}
                    resizeMode="contain"
                    style={[
                      styles.lifestyleCardImage,
                      {
                        width: lifestyleCardImageWidth,
                        height: isCompactLifestyle ? 70 : 88,
                      },
                      timeCardImageStyle,
                    ]}
                  />
                  <View
                    style={[
                      styles.lifestyleRadio,
                      active
                        ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                        : { backgroundColor: '#FFFFFF', borderColor: '#D8E2EF' },
                    ]}
                  >
                    {active ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  </Pressable>
                </OptionReveal>
              );
            })}
          </View>
        </Animated.View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={isPriorityZone ? styles.priorityBody : styles.body}
        >
          <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
          {isPriorityZone ? (
            <>
              <View style={styles.priorityHero}>
                <View style={styles.priorityHeroCopy}>
                  <Text style={[styles.priorityTitle, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>
                    {q.title}
                  </Text>
                  <Text style={[styles.prioritySubtitle, { color: theme.colors.textSecondary, fontFamily: theme.fontFamily.regular }]}>
                    {q.subtitle}
                  </Text>
                </View>
                <Image
                  source={require('../../assets/onboarding/priority-hero.png')}
                  resizeMode="contain"
                  style={styles.priorityHeroImage}
                />
                <Text pointerEvents="none" style={[styles.decorPlusOne, { color: theme.colors.primary }]}>+</Text>
                <Text pointerEvents="none" style={[styles.decorPlusTwo, { color: theme.colors.primary }]}>+</Text>
              </View>

              <View style={styles.priorityOptions}>
                {q.options.map((opt, i) => {
                  const active = selectedSingle === opt;
                  return (
                    <OptionReveal key={opt} progress={optionAnims[i]} fill={false}>
                      <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={opt}
                      onPress={() => selectAnswer(opt)}
                      style={({ pressed }) => [
                        styles.priorityCard,
                        theme.shadows.card,
                        {
                          backgroundColor: theme.colors.bgCard,
                          borderColor: active ? theme.colors.primary : 'rgba(0,127,217,0.08)',
                          opacity: pressed ? 0.9 : 1,
                          transform: [{ scale: pressed ? 0.985 : 1 }],
                        },
                      ]}
                    >
                      <View style={[styles.priorityIconCircle, { backgroundColor: active ? 'rgba(0,127,217,0.12)' : 'rgba(0,127,217,0.07)' }]}>
                        <Icon name={optionIcons?.[i] ?? 'user'} size={31} color={theme.colors.primary} strokeWidth={1.9} />
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.priorityCardLabel,
                          {
                            color: theme.colors.textPrimary,
                            fontFamily: theme.fontFamily.semiBold,
                            maxWidth: Math.max(112, width - priorityCardImageWidth - 142),
                          },
                        ]}
                      >
                        {opt}
                      </Text>
                      <Image
                        source={PRIORITY_IMAGES[i]}
                        resizeMode="contain"
                        style={[styles.priorityCardImage, { width: priorityCardImageWidth }]}
                      />
                      {active ? (
                        <View
                          style={[styles.priorityCheck, { backgroundColor: theme.colors.primary }]}
                        >
                          <Icon name="check" size={17} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      ) : null}
                      </Pressable>
                    </OptionReveal>
                  );
                })}
              </View>

            </>
          ) : (
            <>
              <Text style={[theme.type.h1, { color: theme.colors.textPrimary, marginBottom: 6 }]}>{q.title}</Text>
              {q.subtitle ? (
                <Text style={[theme.type.body, { color: theme.colors.textSecondary, marginBottom: 22 }]}>{q.subtitle}</Text>
              ) : null}
              <View
                style={[styles.options, { marginTop: q.subtitle ? 0 : 22 }]}
              >
                {q.options.map((opt, i) => (
                  <OptionReveal key={opt} progress={optionAnims[i]} fill={false}>
                    <OptionCard
                      label={opt}
                      icon={optionIcons?.[i]}
                      index={i}
                      multi={isMulti}
                      active={isMulti ? selectedMulti.includes(opt) : selectedSingle === opt}
                      onPress={() => selectAnswer(opt)}
                    />
                  </OptionReveal>
                ))}
              </View>
            </>
          )}
          </Animated.View>
        </ScrollView>
      )}
      {!assetsReady ? <QuestionPreloadSkeleton pulse={skeletonPulse} /> : null}
      <View
        style={[
          styles.footer,
          isPriorityZone ? styles.priorityFooter : undefined,
          isGoalMain ? styles.goalFooter : undefined,
          isTensionLevel ? styles.lifestyleFooter : undefined,
          isEditorialMulti ? styles.lifestyleFooter : undefined,
          isAgeGroup ? styles.lifestyleFooter : undefined,
          isLifestyleQuestion ? styles.lifestyleFooter : undefined,
        ]}
      >
        <Button
          style={
            isShowcaseQuestion
              ? [
                  styles.priorityButton,
                  isGoalMain || isTensionLevel || isEditorialMulti || isAgeGroup || isLifestyleQuestion ? styles.goalButton : undefined,
                  theme.shadows.fab,
                  !assetsReady || !canContinue || isTransitioning
                    ? { backgroundColor: theme.colors.borderInput }
                    : undefined,
                ]
              : [
                  { width: '100%' },
                  !assetsReady || !canContinue || isTransitioning
                    ? { backgroundColor: theme.colors.borderInput }
                    : undefined,
                ]
          }
          disabled={!assetsReady || !canContinue || isTransitioning}
          onPress={onNext}
        >
          {t('continue')}
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  revealFill: {
    flex: 1,
    minHeight: 0,
  },
  preloadOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 116,
    bottom: 86,
    zIndex: 30,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#F6FAFF',
  },
  skeletonBlock: {
    backgroundColor: '#DFECF8',
    borderRadius: 20,
  },
  skeletonHero: {
    height: 152,
    marginBottom: 12,
  },
  skeletonCards: {
    flex: 1,
    gap: 9,
  },
  skeletonCard: {
    flex: 1,
    minHeight: 70,
  },
  progressHeader: {
    paddingHorizontal: 20,
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  track: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  goalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 4,
  },
  goalHero: {
    flexShrink: 0,
    marginBottom: 6,
    overflow: 'hidden',
  },
  goalHeroCopy: {
    zIndex: 2,
    width: '60%',
    paddingTop: 7,
  },
  goalTitle: {
    letterSpacing: -0.7,
  },
  goalSubtitle: {
    marginTop: 7,
  },
  goalHeroImage: {
    position: 'absolute',
  },
  goalOptions: {
    flex: 1,
  },
  goalCard: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1.3,
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  goalIconCircle: {
    flexShrink: 0,
    zIndex: 2,
    backgroundColor: '#EDF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCardCopy: {
    flex: 1,
    zIndex: 3,
    marginLeft: 11,
  },
  goalCardLabel: {
    letterSpacing: -0.15,
  },
  goalCardImage: {
    position: 'absolute',
    right: -5,
    bottom: -5,
  },
  goalCheck: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalFooter: {
    paddingTop: 7,
    paddingBottom: 12,
    backgroundColor: '#F6FAFF',
  },
  goalButton: {
    minHeight: 52,
  },
  tensionBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 4,
  },
  tensionHero: {
    flexShrink: 0,
    marginBottom: 7,
    overflow: 'hidden',
  },
  tensionHeroCopy: {
    width: '72%',
    zIndex: 3,
    paddingTop: 17,
  },
  tensionTitle: {
    letterSpacing: -0.75,
  },
  tensionHeroGlow: {
    position: 'absolute',
    right: -14,
    bottom: -38,
    width: 206,
    height: 206,
    borderRadius: 103,
    backgroundColor: 'rgba(204,230,255,0.55)',
  },
  tensionHeroImage: {
    position: 'absolute',
    right: -24,
    bottom: -55,
    zIndex: 2,
  },
  tensionOptions: {
    flex: 1,
  },
  tensionCard: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1.3,
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tensionIconCircle: {
    flexShrink: 0,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tensionCardLabel: {
    flex: 1,
    zIndex: 3,
    marginLeft: 11,
    letterSpacing: -0.15,
  },
  tensionPoseViewport: {
    position: 'absolute',
    bottom: -5,
    overflow: 'hidden',
    borderRadius: 12,
    zIndex: 2,
  },
  editorialBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 4,
  },
  editorialHero: {
    flexShrink: 0,
    marginBottom: 7,
    overflow: 'hidden',
  },
  editorialHeroCopy: {
    zIndex: 3,
    paddingTop: 15,
  },
  editorialTitle: {
    letterSpacing: -0.72,
  },
  editorialSubtitle: {
    marginTop: 9,
  },
  editorialHomeHero: {
    position: 'absolute',
    zIndex: 2,
  },
  editorialTimingHero: {
    position: 'absolute',
    zIndex: 2,
  },
  editorialOptions: {
    flex: 1,
  },
  editorialCard: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1.3,
    borderRadius: 21,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  editorialIconCircle: {
    flexShrink: 0,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorialCardLabel: {
    flex: 1,
    zIndex: 3,
    marginLeft: 12,
    letterSpacing: -0.15,
  },
  editorialCardArt: {
    position: 'absolute',
    zIndex: 2,
  },
  editorialCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 25,
    height: 25,
    borderRadius: 6,
    borderWidth: 1.5,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 4,
  },
  ageHero: {
    flexShrink: 0,
    marginBottom: 7,
    overflow: 'hidden',
  },
  ageHeroCopy: {
    width: '50%',
    zIndex: 3,
    paddingTop: 30,
  },
  ageHeroTitle: {
    letterSpacing: -0.75,
  },
  ageHeroGlow: {
    position: 'absolute',
    right: -34,
    bottom: -48,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(204,230,255,0.5)',
  },
  ageHeroImage: {
    position: 'absolute',
    zIndex: 2,
  },
  ageOptions: {
    flex: 1,
  },
  ageCard: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1.3,
    borderRadius: 21,
    paddingLeft: 13,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ageIconBox: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageCardLabel: {
    flex: 1,
    marginLeft: 15,
    letterSpacing: -0.2,
  },
  ageRadio: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifestyleBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 4,
  },
  lifestyleHero: {
    flexShrink: 0,
    marginBottom: 6,
    overflow: 'hidden',
  },
  lifestyleHeroCopy: {
    zIndex: 2,
    paddingTop: 10,
  },
  lifestyleTitle: {
    letterSpacing: -0.7,
  },
  timeTitleBlock: {
    width: '100%',
  },
  timeTitleLine: {
    letterSpacing: -0.62,
  },
  lifestyleSubtitle: {
    marginTop: 8,
  },
  lifestyleHeroImage: {
    position: 'absolute',
  },
  activityHeroImage: {
    right: -28,
    bottom: -23,
  },
  timeHeroImage: {
    right: -35,
    bottom: -9,
  },
  lifestyleOptions: {
    flex: 1,
  },
  lifestyleCard: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1.3,
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  lifestyleIconCircle: {
    flexShrink: 0,
    zIndex: 2,
    backgroundColor: '#EAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifestyleCardCopy: {
    flex: 1,
    zIndex: 3,
    marginLeft: 11,
  },
  lifestyleCardLabel: {
    letterSpacing: -0.15,
  },
  lifestyleCardDescription: {
    marginTop: 3,
  },
  lifestyleCardImage: {
    position: 'absolute',
    right: 17,
    bottom: -5,
  },
  lifestyleRadio: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifestyleFooter: {
    paddingTop: 7,
    paddingBottom: 12,
    backgroundColor: '#F6FAFF',
  },
  priorityScreen: {
    backgroundColor: '#F6FAFF',
  },
  priorityBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  priorityHero: {
    minHeight: 218,
    marginBottom: 10,
    overflow: 'hidden',
  },
  priorityHeroCopy: {
    zIndex: 2,
    width: '61%',
    paddingTop: 26,
  },
  priorityTitle: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  prioritySubtitle: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
  },
  priorityHeroImage: {
    position: 'absolute',
    right: -39,
    bottom: -45,
    width: 222,
    height: 285,
  },
  priorityOptions: {
    gap: 12,
  },
  priorityCard: {
    minHeight: 112,
    borderWidth: 1.5,
    borderRadius: 24,
    paddingLeft: 18,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  priorityIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  priorityCardLabel: {
    marginLeft: 14,
    zIndex: 3,
    fontSize: 17,
    lineHeight: 22,
  },
  priorityCardImage: {
    position: 'absolute',
    right: -7,
    bottom: -8,
    height: 114,
  },
  priorityCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motivationCard: {
    minHeight: 86,
    marginTop: 14,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  motivationIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motivationText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 13,
    lineHeight: 19,
  },
  priorityFooter: {
    paddingTop: 10,
    backgroundColor: '#F6FAFF',
  },
  priorityButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 999,
  },
  decorCircleLarge: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: 'rgba(194,225,255,0.22)',
    top: 34,
    right: -168,
  },
  decorCircleSmall: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(220,239,255,0.25)',
    top: 210,
    left: -108,
  },
  decorLine: {
    position: 'absolute',
    width: 430,
    height: 34,
    backgroundColor: 'rgba(94,174,255,0.07)',
    transform: [{ rotate: '-33deg' }],
    top: 370,
    right: -190,
  },
  decorPlusOne: {
    position: 'absolute',
    right: 138,
    top: 9,
    fontSize: 26,
    fontWeight: '300',
    opacity: 0.42,
  },
  decorPlusTwo: {
    position: 'absolute',
    right: 7,
    top: 102,
    fontSize: 22,
    fontWeight: '300',
    opacity: 0.34,
  },
  options: {
    gap: 10,
  },
  footer: {
    padding: 20,
  },
});
