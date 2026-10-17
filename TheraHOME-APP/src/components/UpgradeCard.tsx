// The upgrade card on Home — the one entrance to the subscription ladder
// that does not require opening Hồ sơ.
//
// Title and body are admin copy (`app_config`: upgrade_card_title /
// upgrade_card_body, edited in WEB Admin → "Nội dung ứng dụng"). When either
// is blank the card borrows the highlighted plan's own name and tagline, so
// it cannot render as an empty box — the same fallback rule every other
// app_config-backed string follows.
//
// It hides itself in ONE case only: when no tier is configured at all.
//
// It used to hide from anyone who already held a tier, which was tidy and
// wrong twice over (owner, 2026-10-17). A subscriber on the middle tier was
// shown no way to reach the one above it. And the paywall's only entrance
// outside Hồ sơ disappeared for exactly the account App Review signs in
// with — which is how build 45 came back rejected for in-app purchases that
// "could not be found".
//
// So it always shows, and what it OFFERS depends on what they hold: the
// next tier up, or — for someone already on the top one — their own plan,
// as a way in rather than a sales pitch. It never sells anybody the thing
// they are already paying for.
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

  // Plans are ordered cheapest first (`sort_order`), so "the next one up" is
  // simply the first that sorts after theirs.
  const held = activePlanCode ? plans.findIndex((plan) => plan.code === activePlanCode) : -1;
  const nextUp = held >= 0 ? plans[held + 1] : undefined;
  const onTopTier = held >= 0 && !nextUp;

  // Someone with no plan gets the admin's own copy — it is written to sell
  // the highlighted tier. A subscriber gets the specific plan this card can
  // actually move them to, because generic upgrade copy aimed at a paying
  // customer reads as the app not knowing who they are.
  const feature = held >= 0 ? (nextUp ?? plans[held]) : (plans.find((plan) => plan.highlighted) ?? plans[0]);
  const title = held >= 0 ? feature.name : get('upgrade_card_title') || feature.name;
  const body = held >= 0 ? feature.tagline : get('upgrade_card_body') || feature.tagline;

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
          {onTopTier ? t('plansCurrentPlan') : t('plansUpgrade')}
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
