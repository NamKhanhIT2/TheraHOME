import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
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
//
// Two modes (per-product activation model, 2026-09-01):
//  * no params — first-time claim: binds the contact to this account and
//    unlocks every product CSKH listed that contact for
//    (claim_user_access_contact).
//  * productId/productName params (from a locked device card on the
//    Roadmap) — unlocks ONLY that product, matching the contact against
//    that product's own CSKH activation list (activate_product_by_contact),
//    so a second device registered under a different phone/email can be
//    redeemed without touching the account's main contact.
/**
 * Dialling codes for the markets this app serves. The market itself cannot
 * supply one — 'US' covers "UK · Anh / EU / Mỹ", which spans +44, +1 and the
 * EU codes — so the person entering the number picks it, and the market only
 * decides which entry starts selected.
 */
const DIALLING_CODES: { code: string; label: string }[] = [
  { code: '84', label: 'Việt Nam' },
  { code: '44', label: 'United Kingdom' },
  { code: '60', label: 'Malaysia' },
  { code: '1', label: 'US / Canada' },
];

/** Compose what the database stores: E.164, no separators. A domestic number's
 * leading trunk zero is dropped — it is not part of the international form, and
 * sending "+84 0912…" would store a number that matches no order. */
function toE164(diallingCode: string, typed: string): string {
  const digits = typed.replace(/[^0-9]/g, '').replace(/^0+/, '');
  return digits ? `+${diallingCode}${digits}` : '';
}

export default function ActivationScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { productId, productName } = useLocalSearchParams<{ productId?: string; productName?: string }>();
  const userId = session?.user.id;
  const [contact, setContact] = useState('');
  const [contactError, setContactError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEmail = contact.includes('@');
  const profile = useProfile(session?.user.id).data;
  // The market only preselects; 'US' spans several codes so the user decides.
  const defaultCode = profile?.country === 'MALAY' ? '60' : profile?.country === 'US' ? '44' : '84';
  const [diallingCode, setDiallingCode] = useState<string | null>(null);
  const activeCode = diallingCode ?? defaultCode;
  const [codePickerOpen, setCodePickerOpen] = useState(false);
  const submittedContact = useMemo(
    () => (isEmail ? contact.trim() : toE164(activeCode, contact)),
    [isEmail, contact, activeCode],
  );

  function handleClose() {
    if (submitting) return;
    router.back();
  }

  async function confirmContact() {
    if (!contact.trim() || submitting) return;
    setSubmitting(true);
    setContactError('');
    try {
      if (productId) {
        const { error } = await supabase.rpc('activate_product_by_contact', {
          p_product_id: productId,
          p_contact: submittedContact,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.rpc('claim_user_access_contact', {
          p_contact: submittedContact,
        });
        if (error) throw error;
        if (!data || data.length === 0) {
          setContactError(t('errContactVerify'));
          return;
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user_access_contact', userId] }),
        queryClient.invalidateQueries({ queryKey: ['user_programs', userId] }),
        queryClient.invalidateQueries({ queryKey: ['default_product_for_contact', userId] }),
      ]);
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (message.includes('contact_already_claimed')) {
        setContactError(t('errContactClaimed'));
      } else if (message.includes('account_already_has_contact')) {
        setContactError(t('errAccountHasContact'));
      } else if (message.includes('activation_contact_not_found')) {
        setContactError(t('errContactNotRegisteredProduct'));
      } else if (message.includes('order_contact_not_found')) {
        setContactError(t('errContactNotRegistered'));
      } else if (message.includes('invalid_contact')) {
        setContactError(t('errContactFormat'));
      } else {
        setContactError(t('errGeneric'));
      }
      if (__DEV__) console.warn('confirmContact failed:', e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <BackBar onBack={handleClose} />
      {/* The form is vertically centred (`body` is flexGrow + center), so
          without this the keyboard simply covered the contact field and the
          "Xác nhận" button — the content had no reason to move. Shrinking the
          scroll viewport re-centres it in what is left and makes the rest
          reachable by scrolling. Same behavior="padding" the chat composers
          and the post composer use. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={[styles.heroIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
          <Icon name="shield-check" size={30} color={theme.colors.primary} />
        </View>
        <Text style={[theme.type.display, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
          {t('confirmOrderInfo')}
        </Text>
        {productName ? (
          <Text style={[theme.type.bodyStrong, { color: theme.colors.primary, textAlign: 'center', marginTop: 8 }]}>
            {t('activateForProduct')} {productName}
          </Text>
        ) : null}
        <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }]}>
          {productId ? t('productLockedHint') : t('confirmOrderInfoHint')}
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
            {!isEmail ? (
              <Pressable onPress={() => setCodePickerOpen(true)} style={styles.codeBtn} hitSlop={6}>
                <Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>+{activeCode}</Text>
                <Icon name="chevron-down" size={14} color={theme.colors.textMuted} />
              </Pressable>
            ) : null}
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
            disabled={!submittedContact}
            loading={submitting}
            onPress={confirmContact}
          >
            {t('confirmAndUnlock')}
          </Button>
        </Card>

        <Modal visible={codePickerOpen} transparent animationType="fade" onRequestClose={() => setCodePickerOpen(false)}>
          <Pressable style={styles.codeOverlay} onPress={() => setCodePickerOpen(false)}>
            <Pressable onPress={() => undefined} style={[styles.codeSheet, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
              {DIALLING_CODES.map((entry) => {
                const selected = entry.code === activeCode;
                return (
                  <Pressable
                    key={entry.code}
                    onPress={() => { setDiallingCode(entry.code); setCodePickerOpen(false); }}
                    style={[styles.codeRow, { borderBottomColor: theme.colors.divider }]}
                  >
                    <Text style={[theme.type.bodyStrong, { color: selected ? theme.colors.primary : theme.colors.textPrimary, width: 56 }]}>+{entry.code}</Text>
                    <Text style={[theme.type.body, { color: selected ? theme.colors.primary : theme.colors.textSecondary, flex: 1 }]}>{entry.label}</Text>
                    {selected ? <Icon name="check" size={17} color={theme.colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>

        <View style={styles.footerNote}>
          <Icon name="lock" size={13} color={theme.colors.textMuted} />
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>
            {t('noDeviceCodeNeeded')} · {t('contactSecureNote')}
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  codeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9,17,28,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  codeSheet: {
    width: '100%',
    overflow: 'hidden',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  flex: { flex: 1 },
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
