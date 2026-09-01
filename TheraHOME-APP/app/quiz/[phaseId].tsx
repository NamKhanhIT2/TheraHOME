import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms } from '@/hooks/usePrograms';
import { usePhaseQuiz, useSubmitQuizAttempt } from '@/hooks/useQuiz';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

export default function QuizScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { phaseId, productId, phaseName } = useLocalSearchParams<{ phaseId: string; productId?: string; phaseName?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const programsQuery = useActivatedPrograms(userId);
  const program = (programsQuery.data ?? []).find((p) => p.productId === productId);
  const questionsQuery = usePhaseQuiz(phaseId);
  const submitAttempt = useSubmitQuizAttempt();

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
      // Submit without losing their picks.
    }
  }

  const isLoading = programsQuery.isPending || questionsQuery.isPending;

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={phaseName ? `${t('quizTitle')} · ${phaseName}` : t('quizTitle')} />
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : submitted ? (
        <Reanimated.View entering={FadeIn.duration(220)} style={styles.resultBody}>
          <View style={[styles.resultIcon, { backgroundColor: theme.colors.successTint }]}>
            <Icon name="clipboard-check" size={30} color={theme.colors.success} />
          </View>
          <Text style={[theme.type.h1, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{t('quizResultTitle')}</Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
            {t('quizSurveyThanks')}
          </Text>
          <Button style={{ width: '100%', marginTop: 24 }} onPress={() => router.back()}>
            {t('quizContinue')}
          </Button>
        </Reanimated.View>
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
  resultBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  resultIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
});
