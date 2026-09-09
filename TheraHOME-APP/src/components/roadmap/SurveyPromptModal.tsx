import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/icons/Icon';
import { Button } from '@/components/ui/Button';

interface SurveyPromptModalProps {
  /** The phase whose survey is due — shown as a subtitle so the user knows
   * which phase this survey belongs to. */
  phaseName: string;
  /** Open the survey now. */
  onTake: () => void;
  /** Dismiss for now — the prompt re-appears the next time the roadmap tab
   * is focused while the survey is still unanswered. */
  onLater: () => void;
}

/** Shown on the roadmap tab once a phase's last day has unlocked but its
 * survey is still unanswered (per explicit request 2026-09-09). Dismissible
 * ("Để sau") but not skippable for good — it comes back on the next tab
 * focus until the survey is submitted. */
export function SurveyPromptModal({ phaseName, onTake, onLater }: SurveyPromptModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onLater}>
      <Pressable style={styles.backdrop} onPress={onLater}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}
        >
          <View style={[styles.icon, { backgroundColor: theme.colors.primaryTint10 }]}>
            <Icon name="clipboard-check" size={26} color={theme.colors.primary} />
          </View>
          <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{t('surveyPromptTitle')}</Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }]}>
            {t('surveyPromptBody')}
          </Text>
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, textAlign: 'center', marginTop: 6 }]}>{phaseName}</Text>
          <Button style={{ width: '100%', marginTop: 20 }} onPress={onTake}>
            {t('surveyPromptCta')}
          </Button>
          <Pressable onPress={onLater} hitSlop={8} style={styles.laterBtn}>
            <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t('later')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 18,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  laterBtn: {
    paddingVertical: 12,
    marginTop: 4,
  },
});
