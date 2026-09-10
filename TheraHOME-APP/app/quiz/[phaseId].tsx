import React, { useState } from 'react';
import { Alert, ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Reanimated from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms } from '@/hooks/usePrograms';
import { usePhaseQuiz, useQuizAttempt, useSubmitQuizAttempt } from '@/hooks/useQuiz';
import { useAppConfig } from '@/hooks/useAppConfig';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/icons/Icon';
import { SurveySuggestion } from '@/components/roadmap/SurveySuggestion';
import { useI18n } from '@/lib/i18n';

// Soft wellness backdrop for the suggestion screen (owner-supplied).
const WELLNESS_BG = require('../../assets/suggestion-bg.png');

export default function QuizScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { phaseId, productId, phaseName } = useLocalSearchParams<{ phaseId: string; productId?: string; phaseName?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const programsQuery = useActivatedPrograms(userId);
  const program = (programsQuery.data ?? []).find((p) => p.productId === productId);
  const questionsQuery = usePhaseQuiz(phaseId);
  const attemptQuery = useQuizAttempt(userId, phaseId);
  const submitAttempt = useSubmitQuizAttempt();
  const { get } = useAppConfig();

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const questions = questionsQuery.data ?? [];
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] != null);

  function selectAnswer(questionId: string, optionIndex: number) {
    if (submitted) return;
    setAnswers((cur) => ({ ...cur, [questionId]: optionIndex }));
  }

  // Survey/assessment, not a graded test (per explicit request): there is
  // no right answer and no score — the chosen options are simply recorded
  // (with the question/option text as the user saw them) for CSKH to read.
  async function handleSubmit() {
    if (!allAnswered || !userId || !program) return;
    const snapshot = Object.fromEntries(
      questions.map((q) => {
        const optionIndex = answers[q.id];
        return [q.id, { question: q.question, answer: q.options[optionIndex] ?? '', optionIndex }];
      }),
    );
    try {
      await submitAttempt.mutateAsync({
        userId,
        userProgramId: program.userProgramId,
        phaseId,
        totalQuestions: questions.length,
        answers: snapshot,
      });
      setSubmitted(true);
    } catch {
      // Attempt not saved -- leave answers in place so the user can retry
      // Submit without losing their picks, and SAY so (it used to fail silently).
      Alert.alert(t('sendFailTitle'), t('tryAgainBody'));
    }
  }

  // The survey is answered ONCE (the attempt row is upserted on
  // user_id+phase_id). After submitting — and on every later open of an
  // already-answered survey — we show the admin-editable "Gợi ý từ TheraHOME"
  // screen instead of the questions (per explicit request 2026-09-09).
  const alreadyAnswered = !!attemptQuery.data;
  const showSuggestion = submitted || alreadyAnswered;

  // Wait on the attempt lookup too, so an already-answered survey never flashes
  // its questions for a frame before switching to the suggestion screen.
  const isLoading = programsQuery.isPending || questionsQuery.isPending || attemptQuery.isPending;

  if (showSuggestion) {
    const suggestionTitle = get('survey_suggestion_title', t('surveySuggestTitle'));
    const suggestionBody = get('survey_suggestion_body', t('surveySuggestBody'));
    return (
      <ScreenContainer edges={['top']}>
        <Image source={WELLNESS_BG} resizeMode="cover" style={StyleSheet.absoluteFill} />
        <View style={styles.suggestHeader}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
          >
            {/* Fixed navy, not a theme token: this X sits on a white disc over the
                always-light wellness image, so textSecondary (pale in dark mode)
                made it vanish (owner screenshot, build 20). */}
            <Icon name="x" size={20} color="#174C78" />
          </Pressable>
        </View>
        <SurveySuggestion title={suggestionTitle} body={suggestionBody} onClose={() => router.back()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={phaseName ? `${t('quizTitle')} · ${phaseName}` : t('quizTitle')} />
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {questions.map((q, index) => (
            <Card key={q.id} style={{ width: '100%', marginBottom: 14 }}>
              <Text style={[theme.type.captionSm, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>
                {t('quizQuestionOf', { current: index + 1, total: questions.length })}
              </Text>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, marginTop: 4, marginBottom: 12 }]}>
                {q.question}
              </Text>
              <View style={{ gap: 8 }}>
                {q.options.map((option, optionIndex) => {
                  const selected = answers[q.id] === optionIndex;
                  return (
                    <Reanimated.View key={optionIndex}>
                      <Text
                        onPress={() => selectAnswer(q.id, optionIndex)}
                        style={[
                          styles.option,
                          theme.type.body,
                          {
                            borderColor: selected ? theme.colors.primary : theme.colors.borderInput,
                            backgroundColor: selected ? theme.colors.primaryTint05 : theme.colors.bgCard,
                            borderRadius: theme.radius.md,
                            color: selected ? theme.colors.primary : theme.colors.textPrimary,
                          },
                        ]}
                      >
                        {option}
                      </Text>
                    </Reanimated.View>
                  );
                })}
              </View>
            </Card>
          ))}
          {!allAnswered ? (
            <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, textAlign: 'center', marginBottom: 8 }]}>
              {t('quizAnswerAllHint')}
            </Text>
          ) : null}
          <Button style={{ width: '100%' }} disabled={!allAnswered} loading={submitAttempt.isPending} onPress={handleSubmit}>
            {t('quizSubmit')}
          </Button>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  option: {
    borderWidth: 1.5,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  suggestHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
