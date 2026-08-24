import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ActivationScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  const [contact, setContact] = useState('');
  const [contactError, setContactError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // OAuth can complete through a redirect that replaces the navigator's
  // history. In that case `router.back()` has no destination and React
  // Navigation emits GO_BACK was not handled. Leaving this screen also has
  // to end the newly-created Google/Apple session; otherwise the global
  // access guard would immediately send the user back to /activate.
  async function returnToLogin() {
    if (submitting) return;
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      queryClient.removeQueries({ queryKey: ['user_access_contact', userId] });
      queryClient.removeQueries({ queryKey: ['user_programs', userId] });
      router.replace('/login');
    } catch (e) {
      setContactError('Không thể quay lại màn hình đăng nhập. Vui lòng thử lại.');
      if (__DEV__) console.warn('returnToLogin failed:', e);
    }
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
      <BackBar onBack={returnToLogin} />
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={{ width: '100%' }}>
          <Text style={[theme.type.h1, { color: theme.colors.textPrimary }]}>Xác nhận tài khoản</Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, marginTop: 6 }]}> 
            Nhập số điện thoại hoặc email đã dùng khi đặt hàng. Mỗi thông tin chỉ được liên kết với một tài khoản.
          </Text>
          <TextInput
            value={contact}
            onChangeText={setContact}
            placeholder="Số điện thoại hoặc email"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            keyboardType={contact.includes('@') ? 'email-address' : 'default'}
            style={[
              styles.input,
              {
                borderColor: theme.colors.borderInput,
                borderRadius: theme.radius.md,
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.bgCard,
                marginTop: 20,
              },
            ]}
          />
          {contactError ? (
            <Text style={[theme.type.caption, { color: theme.colors.error, marginTop: 8 }]}>{contactError}</Text>
          ) : null}
          <Button
            style={{ width: '100%', marginTop: 16 }}
            disabled={!contact.trim()}
            loading={submitting}
            onPress={confirmContact}
          >
            Xác nhận và xem tất cả lộ trình
          </Button>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 14 }]}> 
            Không cần mã kích hoạt thiết bị.
          </Text>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
  },
});
