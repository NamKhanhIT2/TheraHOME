// "Xu của bạn" — the balance, the gift, the rules and where every xu came
// from.
//
// The rules are on this screen rather than in a help article because the
// programme pays out a physical parcel: somebody who misses the gift by ten
// xu will want to read exactly what the deal was, and sending them looking
// for it is how a reward scheme turns into a complaint. The numbers in the
// rules come from coin_settings through the same RPC as the balance, so
// raising the threshold changes the prose too and the two can never disagree.
import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms } from '@/hooks/usePrograms';
import { useAppStore } from '@/store/useAppStore';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import {
  explainCoinError,
  useClaimGift,
  useClaimStreakCoins,
  useCoinHistory,
  useCoinOverview,
  type CoinEntry,
} from '@/hooks/useCoins';
import { timeAgo } from '@/lib/timeAgo';

export default function CoinsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { session } = useSession();
  const userId = session?.user?.id;
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const programsQuery = useActivatedPrograms(userId);

  // The same programme the rest of the app is showing, so the milestone and
  // the day count on this screen match the roadmap the customer just left.
  const programs = programsQuery.data ?? [];
  const program = programs.find((p) => p.productId === selectedProductId) ?? programs[0];

  const { overview, isPending } = useCoinOverview(program?.userProgramId, !!userId);
  const historyQuery = useCoinHistory(!!userId);
  const claimStreak = useClaimStreakCoins();
  const claimGift = useClaimGift();

  const remaining = Math.max(0, overview.giftThreshold - overview.balance);
  const progress = overview.giftThreshold > 0
    ? Math.min(1, overview.balance / overview.giftThreshold)
    : 0;

  function takeStreak(milestone: number) {
    if (!program?.userProgramId || claimStreak.isPending) return;
    hapticConfirm();
    claimStreak.mutate(
      { userProgramId: program.userProgramId, milestone },
      { onError: (e: unknown) => Alert.alert(t('coinsTitle'), t(explainCoinError(e) as TranslationKey)) },
    );
  }

  function takeGift() {
    if (claimGift.isPending) return;
    Alert.alert(t('coinGiftReadyTitle'), t('coinGiftReadyBody'), [
      { text: t('later'), style: 'cancel' },
      {
        text: t('coinGiftClaim'),
        onPress: () => {
          hapticConfirm();
          claimGift.mutate(undefined, {
            onSuccess: () => Alert.alert(t('coinGiftRequestedTitle'), t('coinGiftRequestedBody')),
            onError: (e: unknown) => Alert.alert(t('coinsTitle'), t(explainCoinError(e) as TranslationKey)),
          });
        },
      },
    ]);
  }

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={t('coinsTitle')} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {isPending ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : !overview.eligible ? (
          <Pressable
            onPress={() => router.push('/subscription')}
            style={({ pressed }) => [styles.card, {
              backgroundColor: theme.colors.bgCardAlt,
              borderColor: theme.colors.borderLight,
              opacity: pressed ? 0.9 : 1,
            }]}
          >
            <Icon name="star" size={22} color={theme.colors.primary} />
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, marginTop: 8 }]}>
              {t('coinLockedTitle')}
            </Text>
            <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, marginTop: 4 }]}>
              {t('coinLockedBody')}
            </Text>
            <Text style={[theme.type.button, { color: theme.colors.primary, marginTop: 12 }]}>
              {t('coinSeePlans')}
            </Text>
          </Pressable>
        ) : (
          <>
            {/* ---- balance and the road to the gift */}
            <View style={[styles.card, { backgroundColor: theme.colors.primaryTint05, borderColor: theme.colors.primaryTint10 }]}>
              <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>{t('coinsSubtitle')}</Text>
              <View style={styles.balanceRow}>
                <Icon name="star" size={26} color={theme.colors.primary} />
                <Text style={[theme.type.h1, { color: theme.colors.primary, fontSize: 34, lineHeight: 40 }]}>
                  {overview.balance}
                </Text>
                <Text style={[theme.type.bodyStrong, { color: theme.colors.primary }]}>{t('coinUnit')}</Text>
              </View>
              <View style={[styles.track, { backgroundColor: theme.colors.borderLight }]}>
                <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: theme.colors.primary }]} />
              </View>
              <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, marginTop: 6 }]}>
                {overview.gift.reached
                  ? t('coinGiftReadyTitle')
                  : t('coinGiftRemaining', { remaining })}
              </Text>
            </View>

            {/* ---- the milestone banner */}
            {overview.claimableStreaks.map((milestone) => (
              <Pressable
                key={milestone}
                onPress={() => takeStreak(milestone)}
                disabled={claimStreak.isPending}
                style={({ pressed }) => [styles.banner, {
                  backgroundColor: theme.colors.successTint,
                  borderColor: theme.colors.success,
                  opacity: claimStreak.isPending ? 0.6 : pressed ? 0.9 : 1,
                }]}
              >
                <Icon name="trending-up" size={19} color={theme.colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.type.bodyStrong, { color: theme.colors.success }]}>
                    {t('coinStreakTitle', { days: milestone })}
                  </Text>
                  <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
                    {t('coinStreakClaim', { coins: overview.coinsPerStreak })}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={theme.colors.success} />
              </Pressable>
            ))}

            {/* ---- the gift */}
            {overview.gift.fulfilledAt ? (
              <Notice icon="check" tone={theme.colors.success}
                title={t('coinGiftSentTitle')} body={t('coinGiftSentBody')} />
            ) : overview.gift.claimedAt ? (
              <Notice icon="clock" tone={theme.colors.primary}
                title={t('coinGiftRequestedTitle')} body={t('coinGiftRequestedBody')} />
            ) : overview.gift.reached ? (
              <Pressable
                onPress={takeGift}
                disabled={claimGift.isPending}
                style={({ pressed }) => [styles.banner, {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                  opacity: claimGift.isPending ? 0.6 : pressed ? 0.9 : 1,
                }]}
              >
                <Icon name="shopping-bag" size={19} color={theme.colors.textOnPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.type.bodyStrong, { color: theme.colors.textOnPrimary }]}>
                    {claimGift.isPending ? t('coinGiftClaiming') : t('coinGiftClaim')}
                  </Text>
                  <Text style={[theme.type.captionSm, { color: theme.colors.textOnPrimary, opacity: 0.85 }]}>
                    {t('coinGiftReadyBody')}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {/* ---- the deal, in full */}
            <Section title={t('coinRulesTitle')}>
              {([
                ['coinRule1', {}],
                ['coinRule2', { perDay: overview.coinsPerDay }],
                ['coinRule3', { milestones: overview.streakMilestones.join(' và '), perStreak: overview.coinsPerStreak }],
                ['coinRule4', { threshold: overview.giftThreshold }],
                ['coinRule5', {}],
              ] as [TranslationKey, Record<string, string | number>][]).map(([key, params]) => (
                <View key={key} style={styles.ruleRow}>
                  <Text style={[theme.type.captionSm, { color: theme.colors.primary }]}>•</Text>
                  <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, flex: 1 }]}>
                    {t(key, params)}
                  </Text>
                </View>
              ))}
            </Section>

            {/* ---- where every xu came from */}
            <Section title={t('coinHistoryTitle')}>
              {(historyQuery.data ?? []).length === 0 ? (
                <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>
                  {t('coinHistoryEmpty')}
                </Text>
              ) : (
                (historyQuery.data ?? []).map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }]}>
      <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, marginBottom: 8 }]}>{title}</Text>
      {children}
    </View>
  );
}

function Notice({ icon, tone, title, body }: { icon: string; tone: string; title: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: theme.colors.bgCardAlt, borderColor: theme.colors.borderLight }]}>
      <Icon name={icon} size={19} color={tone} />
      <View style={{ flex: 1 }}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{title}</Text>
        <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

function HistoryRow({ entry }: { entry: CoinEntry }) {
  const theme = useTheme();
  const { t } = useI18n();
  const label = entry.kind === 'streak'
    ? t('coinHistoryStreak', { days: entry.streakMilestone ?? 0 })
    : entry.kind === 'admin'
      ? t('coinHistoryAdmin')
      : t('coinHistoryDay', { day: entry.dayNumber ?? 0 });
  return (
    <View style={styles.historyRow}>
      <View style={{ flex: 1 }}>
        <Text style={[theme.type.captionSm, { color: theme.colors.textPrimary }]}>{label}</Text>
        <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{timeAgo(entry.createdAt, t)}</Text>
      </View>
      <Text style={[theme.type.bodyStrong, { color: theme.colors.primary }]}>+{entry.amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 10 },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  ruleRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
});
