import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

export interface ShareStoryModalProps {
  onClose: () => void;
  onSupport: () => void;
  onShare: () => void;
}

/** The composer-entry prompt on the Community tab.
 *
 * Dark-palette, because the only screen that opens it is the dark violet
 * Cộng đồng: on `theme.colors.bgCard` it came up as a white sheet in the
 * middle of a near-black screen (owner's contrast sweep, 2026-10-26). */
export function ShareStoryModal({ onClose, onSupport, onShare }: ShareStoryModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.overlayScrim }]} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.card, { backgroundColor: homeGlassColors.menu, borderRadius: 22, borderWidth: 1, borderColor: homeGlassColors.hairline, padding: theme.space[5] }]}
        >
          {/* hitSlop pads the touch target to ~56pt — the visible 32pt disc
              alone was below Apple's 44pt minimum and reported hard to hit. */}
          <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { backgroundColor: homeGlassColors.surfaceRaised }]}>
            <Icon name="x" size={16} color={homeGlassColors.textMuted} />
          </Pressable>
          <Text style={[theme.type.h2, { color: homeGlassColors.text, marginBottom: 8, paddingRight: 30 }]}>
            {t('shareWithCommunity')}
          </Text>
          <Text style={[theme.type.body, { color: homeGlassColors.textMuted, lineHeight: 21 }]}>
            {t('sharePrompt')}
          </Text>
          {/* Local buttons rather than `Button`: its secondary variant is a
              light-grey chip with dark text, which belongs to the old light
              screens, not to this sheet. */}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onSupport}
              style={({ pressed }) => [styles.action, { backgroundColor: homeGlassColors.surfaceRaised }, pressed ? { opacity: 0.7 } : null]}
            >
              <Text style={[theme.type.button, { color: homeGlassColors.text }]}>{t('needMoreSupport')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onShare}
              style={({ pressed }) => [styles.action, { backgroundColor: homeGlassColors.purpleStrong }, pressed ? { opacity: 0.8 } : null]}
            >
              <Text style={[theme.type.button, { color: '#FFFFFF' }]}>{t('share')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,6,16,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  actions: {
    gap: 10,
    marginTop: 20,
  },
  action: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
