// The upgrade prompt that appears on opening the app, once the customer has
// actually finished a session (owner 2026-10-13).
//
// Why wait for day 1 rather than show it at install: somebody who has not
// trained yet has no idea what "chấm dáng tập" is worth, so the offer reads
// as noise and gets dismissed for good. After one finished session the
// benefits name things they have just done.
//
// It appears once per app launch, not once per visit to Home — coming back
// to a tab is not opening the app, and a dialog that reappears on every tab
// switch is the fastest way to teach somebody to tick "không hiển thị lại".
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { useActivePlanCode } from '@/hooks/useSubscription';

/** Module scope on purpose: it must survive remounting Home (a tab switch)
 * and reset only when the process does, which is what "once per app launch"
 * means. */
let shownThisLaunch = false;

export function UpgradePromptModal({ userId, daysDone }: { userId: string | undefined; daysDone: number }) {
  const theme = useTheme();
  const { t } = useI18n();
  const muted = useAppStore((s) => s.upgradePromptMuted);
  const mute = useAppStore((s) => s.muteUpgradePrompt);
  const plans = useSubscriptionPlans().data ?? [];
  const activePlanCode = useActivePlanCode(userId).data ?? null;
  const [claimed, setClaimed] = useState(false);
  const [open, setOpen] = useState(true);
  const [muteChecked, setMuteChecked] = useState(false);

  const plan = plans.find((p) => p.highlighted) ?? plans[0];
  // Every reason not to show it. `activePlanCode` is the one worth naming:
  // somebody already paying would be looking at an advert for what they own.
  const eligible = !muted && !!userId && daysDone >= 1 && !!plan && !activePlanCode;

  // Claiming the launch is a side effect, so it happens in an effect rather
  // than during render — a render can be thrown away and re-run, and this
  // flag must be set exactly once.
  useEffect(() => {
    if (!eligible || shownThisLaunch) return;
    shownThisLaunch = true;
    setClaimed(true);
  }, [eligible]);

  if (!claimed || !open || !plan) return null;

  function dismiss(permanently: boolean) {
    if (permanently) mute();
    setOpen(false);
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => dismiss(muteChecked)}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlayScrim }]}>
        <View style={[styles.sheet, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
          <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
            <Icon name="crown" size={20} color={theme.colors.textOnPrimary} />
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textOnPrimary, flexShrink: 1 }]} numberOfLines={1}>
              {t('upgradePromptTitle', { plan: plan.name })}
            </Text>
          </View>

          <View style={styles.body}>
            {plan.tagline ? (
              <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 14, lineHeight: 18 }]}>
                {plan.tagline}
              </Text>
            ) : null}
            {/* Scrolls rather than growing: a tier with eight benefit lines
                must not push the buttons off a small screen. */}
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                {plan.features.map((feature, index) => (
                  <View key={`${feature.text}-${index}`} style={styles.row}>
                    <View style={[styles.icon, { backgroundColor: theme.colors.primaryTint10 }]}>
                      <Icon name={feature.icon || 'check'} size={13} color={theme.colors.primary} />
                    </View>
                    <Text style={[theme.type.captionSm, { color: theme.colors.textPrimary, flex: 1, lineHeight: 19 }]}>
                      {feature.text}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <Pressable style={styles.muteRow} onPress={() => setMuteChecked((v) => !v)} hitSlop={6}>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: muteChecked ? theme.colors.primary : theme.colors.borderInput,
                    backgroundColor: muteChecked ? theme.colors.primary : 'transparent',
                    borderRadius: theme.radius.sm,
                  },
                ]}
              >
                {muteChecked ? <Icon name="check" size={12} color={theme.colors.textOnPrimary} /> : null}
              </View>
              <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>{t('upgradePromptMute')}</Text>
            </Pressable>

            <Pressable
              style={[styles.cta, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}
              onPress={() => {
                dismiss(muteChecked);
                router.push('/subscription');
              }}
            >
              <Icon name="crown" size={15} color={theme.colors.textOnPrimary} />
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textOnPrimary }]}>{t('upgradePromptNow')}</Text>
            </Pressable>
            <Pressable style={styles.later} onPress={() => dismiss(muteChecked)} hitSlop={6}>
              <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{t('later')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  body: {
    padding: 18,
  },
  // Capped so the dialog cannot outgrow a small screen; the list scrolls
  // inside it instead.
  list: {
    maxHeight: 240,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  muteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 14,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
  },
  later: {
    alignItems: 'center',
    paddingVertical: 12,
  },
});
