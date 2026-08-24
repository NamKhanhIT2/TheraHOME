import React, { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Reanimated, { Easing, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

export interface ExternalLinkModalProps {
  url: string;
  onClose: () => void;
}

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, '').split('/')[0];
}

/** Confirm-before-leaving-the-app modal — mirrors `ExternalLinkModal`. Opens
 * the link in an in-app browser via `expo-web-browser`. */
export function ExternalLinkModal({ url, onClose }: ExternalLinkModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (submitting) return;
    // Hide the card content immediately — but keep the <Modal> itself
    // mounted with `visible` constant (never toggled) for the entire
    // round trip, including after the browser closes. Two failure modes
    // depend on this:
    // 1. Dismissing/unmounting this Modal in the same tick as (or shortly
    //    before) calling openBrowserAsync races it against expo-web-browser's
    //    own native presentation — on iOS this can silently drop the
    //    browser's `present` call, so "Tiếp tục" looked like it did nothing.
    // 2. Dismissing this Modal *while the browser is still open on top of
    //    it* is invalid on iOS (a presenter can't be dismissed while its
    //    presented view controller is still up) and froze the app the
    //    moment the user closed the browser and control tried to return.
    // So the Modal's native presentation is left completely alone; only
    // its (transparent, now-empty) content changes, and the parent only
    // unmounts it via onClose() once the browser has actually closed —
    // by which point there's nothing left to flash back into view.
    setSubmitting(true);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        // Both failed — nothing more we can do; still fall through to close.
      }
    }
    onClose();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {submitting ? null : (
        <Reanimated.View entering={FadeIn.duration(180)} style={styles.backdropFill}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Reanimated.View entering={FadeIn.duration(220).delay(40).easing(Easing.out(Easing.quad))}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.space[5] }]}
          >
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.bgCardAlt }]}>
              <Icon name="external-link" size={20} color={theme.colors.textSecondary} />
            </View>
            <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
              {t('leaveApp')}
            </Text>
            <Text style={[theme.type.caption, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
              {t('externalLinkMessage', { host: hostOf(url) })}
            </Text>
            <View style={styles.row}>
              <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md }]}>
                <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('cancel')}</Text>
              </Pressable>
              <Pressable onPress={() => void handleContinue()} style={[styles.btn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}>
                <Text style={[theme.type.bodyStrong, { color: '#fff' }]}>{t('continue')}</Text>
              </Pressable>
            </View>
          </Pressable>
          </Reanimated.View>
        </Pressable>
        </Reanimated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropFill: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,24,34,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    width: '100%',
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
});
