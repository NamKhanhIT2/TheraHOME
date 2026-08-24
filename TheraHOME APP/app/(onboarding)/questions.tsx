import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { onboardingQuestions } from '@/lib/mockData';
import { useAppStore, type AnswerValue } from '@/store/useAppStore';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { OptionCard } from '@/components/ui/OptionCard';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n';

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

export default function QuestionsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const [qIndex, setQIndex] = useState(0);
  const answers = useAppStore((s) => s.onboardingAnswers);
  const setAnswer = useAppStore((s) => s.setAnswer);
  const language = useAppStore((s) => s.language);
  const questions = onboardingQuestions(language);

  const q = questions[qIndex];
  const isMulti = !!q.multi;
  const selectedSingle = !isMulti ? (answers[q.key] as string | undefined) : undefined;
  const selectedMulti = isMulti ? ((answers[q.key] as string[] | undefined) ?? []) : [];
  const canContinue = isMulti ? selectedMulti.length > 0 : !!selectedSingle;
  const optionIcons = OPTION_ICONS[q.key];

  const progressAnim = useRef(new Animated.Value((qIndex + 1) / questions.length)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: (qIndex + 1) / questions.length, duration: 320, useNativeDriver: false }).start();
    contentAnim.setValue(0);
    Animated.timing(contentAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [qIndex, contentAnim, progressAnim, questions.length]);

  function selectAnswer(v: string) {
    if (isMulti) {
      const next = selectedMulti.includes(v) ? selectedMulti.filter((x) => x !== v) : [...selectedMulti, v];
      setAnswer(q.key, next as AnswerValue);
    } else {
      setAnswer(q.key, v);
    }
  }

  function onNext() {
    if (!canContinue) return;
    if (qIndex < questions.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      router.push('/consent');
    }
  }

  function onBack() {
    if (qIndex > 0) {
      setQIndex(qIndex - 1);
    } else {
      router.back();
    }
  }

  return (
    <ScreenContainer>
      <BackBar onBack={onBack} />
      <View style={styles.progressHeader}>
        <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, fontFamily: theme.fontFamily.semiBold }]}>
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
      <ScrollView contentContainerStyle={styles.body}>
        <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
          <Text style={[theme.type.h1, { color: theme.colors.textPrimary, marginBottom: 6 }]}>{q.title}</Text>
          {q.subtitle ? (
            <Text style={[theme.type.body, { color: theme.colors.textSecondary, marginBottom: 22 }]}>{q.subtitle}</Text>
          ) : null}
          <View style={[styles.options, { marginTop: q.subtitle ? 0 : 22 }]}>
            {q.options.map((opt, i) => (
              <OptionCard
                key={opt}
                label={opt}
                icon={optionIcons?.[i]}
                index={i}
                multi={isMulti}
                active={isMulti ? selectedMulti.includes(opt) : selectedSingle === opt}
                onPress={() => selectAnswer(opt)}
              />
            ))}
          </View>
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        <Button style={{ width: '100%' }} disabled={!canContinue} onPress={onNext}>
          {t('continue')}
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  options: {
    gap: 10,
  },
  footer: {
    padding: 20,
  },
});
