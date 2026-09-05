import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

/** Shown in place of the day list when the user OWNS (activated) a device
 * whose roadmap Admin has not published yet — only TheraNECK+ has real
 * exercise videos as of 2026-09-05. Unpublished devices never appear for
 * users who have not activated them, so App Review only ever sees
 * published roadmaps. When Admin publishes, a `roadmap_ready` notification
 * is written for every owner (DB trigger) and pushed (dispatch-push). */
export function RoadmapComingSoonCard({ productName }: { productName: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.cardPadding }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryTint10 }]}>
        <Icon name="clock" size={24} color={theme.colors.primary} />
      </View>
      <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center', marginTop: 12 }]}>
        {t('roadmapComingSoonTitle', { product: productName })}
      </Text>
      <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
        {t('roadmapComingSoonBody')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 28 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
