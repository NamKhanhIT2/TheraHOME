// The upgrade card on Home — the one entrance to the subscription ladder
// that does not require opening Hồ sơ.
//
// Title and body are admin copy (`app_config`: upgrade_card_title /
// upgrade_card_body, edited in WEB Admin → "Nội dung ứng dụng"). When either
// is blank the card borrows the highlighted plan's own name and tagline, so
// it cannot render as an empty box — the same fallback rule every other
// app_config-backed string follows.
//
// It hides itself in the two cases where it would be wrong rather than
// useful: when no tier is configured at all, and when the user already holds
// one. Every tier is paid now (there is no free row on the paywall), so
// holding ANY tier is reason enough to stop advertising.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { useActivePlanCode } from '@/hooks/useSubscription';

export function UpgradeCard({ userId }: { userId: string | undefined }) {
  const theme = useTheme();
  const { t } = useI18n();
  const { get } = useAppConfig();
  const plans = useSubscriptionPlans().data ?? [];
  const activePlanCode = useActivePlanCode(userId).data ?? null;

  if (plans.length === 0) return null;
  // Already paying for something — this card would be selling them what they
  // have. The ladder stays reachable from Hồ sơ either way.
  if (activePlanCode) return null;

  const feature = plans.find((plan) => plan.highlighted) ?? plans[0];
  const title = get('upgrade_card_title') || feature.name;
  const body = get('upgrade_card_body') || feature.tagline;

  return (
    <Pressable
      onPress={() => router.push('/subscription')}
      style={[
        styles.card,
        theme.shadows.card,
        {
          backgroundColor: theme.colors.primaryTint10,
          borderRadius: theme.radius.lg,
          borderColor: theme.colors.primary,
          padding: theme.cardPadding,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}>
          <Icon name="crown" size={20} color={theme.colors.textOnPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]} numberOfLines={2}>
            {title}
          </Text>
          {body ? (
            <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, marginTop: 3, lineHeight: 18 }]} numberOfLines={3}>
              {body}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.cta, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]}>
        <Text style={[theme.type.captionSm, { color: theme.colors.textOnPrimary, fontFamily: theme.fontFamily.semiBold }]}>
          {t('plansUpgrade')}
        </Text>
        <Icon name="chevron-right" size={13} color={theme.colors.textOnPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    marginTop: 14,
  },
});
