import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { Icon } from '@/components/icons/Icon';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n';

/** Locked-device card on the Roadmap with the activation input INLINE (per
 * explicit request — no detour through /activate): enter the phone/email
 * CSKH registered for THIS device and it unlocks in place via
 * activate_product_by_contact. The screen-level KeyboardAvoidingView in
 * roadmap.tsx keeps the input above the keyboard. The /activate screen
 * still handles the account's FIRST activation (global gate). */
export function ProductActivateCard({ productId }: { productId: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEmail = contact.includes('@');

  async function submit() {
    if (!contact.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('activate_product_by_contact', {
        p_product_id: productId,
        p_contact: contact.trim(),
      });
      if (rpcError) throw rpcError;
      // The refetched user_programs row makes roadmap.tsx swap this card
      // out for the day list — no navigation needed.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user_programs', userId] }),
        queryClient.invalidateQueries({ queryKey: ['default_product_for_contact', userId] }),
        // First activation also binds the contact to the account (see the
        // RPC) — refresh anything keyed on it.
        queryClient.invalidateQueries({ queryKey: ['user_access_contact', userId] }),
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (message.includes('contact_already_claimed')) {
        setError('Số điện thoại/email này đã được sử dụng bởi một tài khoản khác.');
      } else if (message.includes('activation_contact_not_found')) {
        setError('Số điện thoại/email này chưa được đăng ký kích hoạt cho sản phẩm này. Vui lòng liên hệ CSKH.');
      } else if (message.includes('invalid_contact')) {
        setError('Số điện thoại/email không đúng định dạng.');
      } else {
        setError('Có lỗi xảy ra, vui lòng thử lại.');
      }
      if (__DEV__) console.warn('activate_product_by_contact failed:', e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.cardPadding }]}>
      <View style={[styles.lockedIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
        <Icon name="lock" size={22} color={theme.colors.primary} />
      </View>
      <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center', marginTop: 4 }]}>
        {t('productLockedTitle')}
      </Text>
      <Text style={[theme.type.caption, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 19 }]}>
        {t('productLockedHint')}
      </Text>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor: error ? theme.colors.error : theme.colors.borderInput,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.bgCardAlt,
          },
        ]}
      >
        <Icon name={isEmail ? 'mail' : 'smartphone'} size={19} color={theme.colors.textMuted} />
        <TextInput
          value={contact}
          onChangeText={(value) => {
            setContact(value);
            if (error) setError('');
          }}
          placeholder={t('contactInputPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={isEmail ? 'email-address' : 'default'}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          style={[styles.input, { color: theme.colors.textPrimary }]}
        />
      </View>
      {error ? (
        <Text style={[theme.type.caption, { color: theme.colors.error, marginTop: 8, alignSelf: 'stretch' }]}>{error}</Text>
      ) : null}
      <Button
        style={{ width: '100%', marginTop: 14 }}
        disabled={!contact.trim()}
        loading={submitting}
        onPress={() => void submit()}
      >
        {t('confirmAndUnlock')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
  },
  lockedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 13,
    fontSize: 15.5,
  },
});
