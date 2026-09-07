import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/icons/Icon';
import { useChatConnected } from '@/lib/chatConnection';

/**
 * Tells the user the thread has gone quiet because the connection dropped,
 * not because nobody is answering.
 *
 * Renders nothing while the thread is live, and `useChatConnected` waits out
 * a grace period before reporting a drop, so an ordinary rejoin never makes
 * this appear. Whatever the user sends meanwhile is queued and goes out on
 * reconnect, which is what the wording promises.
 */
export function ChatOfflineBanner() {
  const theme = useTheme();
  const { t } = useI18n();
  const connected = useChatConnected();
  if (connected) return null;
  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.warningTint }]}>
      <Icon name="wifi-off" size={14} color={theme.colors.warning} />
      <Text style={[styles.text, { color: theme.colors.warning }]}>{t('chatOffline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: { flex: 1, fontSize: 12, lineHeight: 16 },
});
