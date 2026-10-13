// "Nhận 10 xu" for the day you just finished.
//
// A button rather than an automatic credit, which is the owner's design and
// a better one: the xu arrive because the customer came back and tapped,
// which is the habit the programme is paying for. Crediting silently would
// reward the database, not the person.
//
// Shown only on a day the server already considers done — `claimableDays`
// comes from coin_overview, so this component never decides anything it
// could be wrong about.
import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { hapticConfirm } from '@/lib/haptics';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useClaimDayCoins, useCoinOverview, explainCoinError } from '@/hooks/useCoins';

export function DayCoinCard({ userProgramId, programDayId }: {
  userProgramId: string | undefined;
  programDayId: string | undefined;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const { overview } = useCoinOverview(userProgramId, !!userProgramId);
  const claim = useClaimDayCoins();

  if (!userProgramId || !programDayId || !overview.active) return null;

  const claimable = overview.claimableDays.some((d) => d.programDayId === programDayId);

  // Not eligible: say what it is and where it lives, rather than hiding a
  // benefit nobody can then discover.
  if (!overview.eligible) {
    return (
      <Pressable
        onPress={() => router.push('/subscription')}
        style={({ pressed }) => [styles.card, {
          backgroundColor: theme.colors.bgCardAlt,
          borderColor: theme.colors.borderLight,
          opacity: pressed ? 0.85 : 1,
        }]}
      >
        <Icon name="star" size={19} color={theme.colors.primary} />
        <View style={styles.text}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('coinLockedTitle')}</Text>
          <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>{t('coinLockedBody')}</Text>
        </View>
        <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
      </Pressable>
    );
  }

  if (!claimable) {
    // Already taken. A quiet line, not a card: it is a receipt, not an offer.
    return (
      <View style={styles.doneRow}>
        <Icon name="check" size={15} color={theme.colors.success} />
        <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
          {t('coinClaimedDay', { coins: overview.coinsPerDay })}
        </Text>
      </View>
    );
  }

  function take() {
    if (claim.isPending) return;
    hapticConfirm();
    claim.mutate(
      { userProgramId: userProgramId!, programDayId: programDayId! },
      {
        onError: (error: unknown) => {
          Alert.alert(t('coinsTitle'), t(explainCoinError(error) as TranslationKey));
        },
      },
    );
  }

  return (
    <Pressable
      onPress={take}
      disabled={claim.isPending}
      style={({ pressed }) => [styles.card, {
        backgroundColor: theme.colors.primaryTint05,
        borderColor: theme.colors.primary,
        opacity: claim.isPending ? 0.6 : pressed ? 0.9 : 1,
      }]}
    >
      {claim.isPending
        ? <ActivityIndicator size="small" color={theme.colors.primary} />
        : <Icon name="star" size={19} color={theme.colors.primary} />}
      <View style={styles.text}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.primaryDark }]}>
          {t('coinClaimDay', { coins: overview.coinsPerDay })}
        </Text>
        <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>{t('coinDayCardHint')}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={theme.colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 },
});
