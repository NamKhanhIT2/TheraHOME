import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n';

export interface ShareStoryModalProps {
  onClose: () => void;
  onSupport: () => void;
  onShare: () => void;
}

/** Mirrors `ShareStoryModal` — the composer-entry prompt on the Community tab. */
export function ShareStoryModal({ onClose, onSupport, onShare }: ShareStoryModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.space[5] }]}
        >
          {/* hitSlop pads the touch target to ~56pt — the visible 32pt disc
              alone was below Apple's 44pt minimum and reported hard to hit. */}
          <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { backgroundColor: theme.colors.bgCardAlt }]}>
            <Icon name="x" size={16} color={theme.colors.textSecondary} />
          </Pressable>
          <Text style={[theme.type.h2, { color: theme.colors.textPrimary, marginBottom: 8, paddingRight: 30 }]}>
            {t('shareWithCommunity')}
          </Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, lineHeight: 21 }]}>
            {t('sharePrompt')}
          </Text>
          <View style={styles.actions}>
            <Button variant="secondary" style={{ width: '100%' }} onPress={onSupport}>
              {t('needMoreSupport')}
            </Button>
            <Button style={{ width: '100%' }} onPress={onShare}>
              {t('share')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,24,34,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
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
});
