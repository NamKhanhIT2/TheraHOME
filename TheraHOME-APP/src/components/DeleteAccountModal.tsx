import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { Icon } from '@/components/icons/Icon';

export interface DeleteAccountModalProps {
  onCancel: () => void;
}

/** Mirrors `DeleteAccountModal`. Calls the real `delete_account` RPC (Phase
 * 6) — soft-deletes/scrubs the profile and hard-deletes program/progress
 * data, matching this modal's own copy below and the decision recorded in
 * CLAUDE.md — then ends the Supabase session, which flips the root layout's
 * auth guard back to onboarding. */
export function DeleteAccountModal({ onCancel }: DeleteAccountModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const selectProduct = useAppStore((s) => s.selectProduct);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('delete_account');
      if (error) throw error;
      await supabase.auth.signOut();
      selectProduct(null);
    } catch (e) {
      setSubmitting(false);
      if (__DEV__) console.warn('delete_account failed:', e);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.space[5] }]}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.errorTint }]}>
            <Icon name="lock" size={20} color={theme.colors.error} />
          </View>
          <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{t('deleteConfirmTitle')}</Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
            {t('deleteConfirmBody')}
          </Text>
          <View style={styles.row}>
            <Pressable
              onPress={onCancel}
              disabled={submitting}
              style={[styles.btn, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md, opacity: submitting ? 0.5 : 1 }]}
            >
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={submitting}
              style={[styles.btn, { backgroundColor: theme.colors.error, borderRadius: theme.radius.md, opacity: submitting ? 0.7 : 1 }]}
            >
              <Text style={[theme.type.bodyStrong, { color: '#fff' }]}>{submitting ? t('deleting') : t('deleteAction')}</Text>
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
    backgroundColor: 'rgba(20,24,34,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
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
