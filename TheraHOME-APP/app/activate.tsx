import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

const BENEFIT_KEYS = ['benefitFullRoadmap', 'benefitDailySync'] as const;

// Reached from the Roadmap tab's own gate (see roadmap.tsx) once the user is
// already fully signed in and onboarded — activation is opt-in, not part of
// the sign-up flow anymore, so this screen no longer needs to sign anyone
// out on cancel or worry about `router.back()` having nowhere to go.
export default function ActivationScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  const [contact, setContact] = useState('');
  const [contactError, setContactError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEmail = contact.includes('@');

  function handleClose() {
    if (submitting) return;
    router.back();
  }

  async function confirmContact() {
    if (!contact.trim() || submitting) return;
    setSubmitting(true);
    setContactError('');
    try {
      const { data, error } = await supabase.rpc('claim_user_access_contact', {
        p_contact: contact.trim(),
      });
      if (error) throw error;
      if (!data || data.length === 0) {
        setContactError('Không thể xác nhận thông tin này. Vui lòng kiểm tra lại.');
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user_access_contact', userId] }),
        queryClient.invalidateQueries({ queryKey: ['user_programs', userId] }),
      ]);
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (message.includes('contact_already_claimed')) {
        setContactError('Số điện thoại/email này đã được sử dụng bởi một tài khoản khác.');
      } else if (message.includes('account_already_has_contact')) {
        setContactError('Tài khoản này đã liên kết với một số điện thoại/email khác.');
      } else if (message.includes('order_contact_not_found')) {
        setContactError('Không tìm thấy đơn hàng với số điện thoại/email này. Vui lòng kiểm tra lại.');
      } else if (message.includes('invalid_contact')) {
        setContactError('Số điện thoại/email không đúng định dạng.');
      } else {
        setContactError('Có lỗi xảy ra, vui lòng thử lại.');
      }
      if (__DEV__) console.warn('confirmContact failed:', e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <BackBar onBack={handleClose} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={[styles.heroIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
          <Icon name="shield-check" size={30} color={theme.colors.primary} />
        </View>
        <Text style={[theme.type.display, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
          {t('confirmOrderInfo')}
        </Text>
        <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }]}>
          {t('confirmOrderInfoHint')}
        </Text>

        <View style={styles.benefitList}>
          {BENEFIT_KEYS.map((key) => (
            <View key={key} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: theme.colors.successTint }]}>
                <Icon name="check" size={13} color={theme.colors.success} strokeWidth={3} />
              </View>
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary, flex: 1 }]}>{t(key)}</Text>
            </View>
          ))}
        </View>

        <Card style={{ width: '100%', marginTop: 24 }}>
          <View
            style={[
              styles.inputWrap,
              {
                borderColor: contactError ? theme.colors.error : theme.colors.borderInput,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.bgCardAlt,
              },
            ]}
          >
            <Icon name={isEmail ? 'mail' : 'smartphone'} size={19} color={theme.colors.textMuted} />
            <TextInput
              value={contact}
              onChangeText={(v) => {
                setContact(v);
                if (contactError) setContactError('');
              }}
              placeholder={t('contactInputPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={isEmail ? 'email-address' : 'default'}
              style={[styles.input, { color: theme.colors.textPrimary }]}
            />
          </View>
          {contactError ? (
            <Text style={[theme.type.caption, { color: theme.colors.error, marginTop: 8 }]}>{contactError}</Text>
          ) : null}
          <Button
            style={{ width: '100%', marginTop: 16 }}
            disabled={!contact.trim()}
            loading={submitting}
            onPress={confirmContact}
          >
            {t('confirmAndUnlock')}
          </Button>
        </Card>

        <View style={styles.footerNote}>
          <Icon name="lock" size={13} color={theme.colors.textMuted} />
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>
            {t('noDeviceCodeNeeded')} · {t('contactSecureNote')}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  benefitList: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    fontSize: 16,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
});
