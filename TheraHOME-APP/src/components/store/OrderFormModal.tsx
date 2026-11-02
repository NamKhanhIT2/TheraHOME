import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { ScalePressable } from '@/components/motion/ScalePressable';
import { useI18n } from '@/lib/i18n';
import { formatStorePrice, storePrice } from '@/lib/storePricing';
import { usePlaceStoreOrder, type StoreItemRow } from '@/hooks/useStore';
import type { StoreMarket } from '@/hooks/useMarket';

interface OrderFormModalProps {
  product: StoreItemRow | null;
  market: StoreMarket;
  initialName?: string | null;
  initialPhone?: string | null;
  onClose: () => void;
  onOrderPlaced?: (productId: string) => void;
}

function FieldLabel({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{children}</Text>
      {trailing}
    </View>
  );
}

export function OrderFormModal({ product, market, initialName, initialPhone, onClose, onOrderPlaced }: OrderFormModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const placeOrder = usePlaceStoreOrder();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    setName(initialName?.trim() ?? '');
    setPhone(initialPhone?.trim() ?? '');
    setAddress('');
    setNote('');
    setQuantity(1);
    setValidationError(null);
    setReference(null);
    placeOrder.reset();
    // `reset` is stable in TanStack Query. Depending on the whole mutation
    // object would re-run this effect on every mutation state transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialName, initialPhone, product?.id]);

  const price = useMemo(
    () => product ? storePrice(product.priceText, market, product.discountPercent) : null,
    [market, product],
  );
  const discountedText = price ? formatStorePrice(price.discounted, market) : product?.priceText ?? '';
  const totalText = price ? formatStorePrice(price.discounted * quantity, market) : product?.priceText ?? '';

  const submit = async () => {
    if (!product || placeOrder.isPending) return;
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();
    if (cleanName.length < 2 || cleanAddress.length < 8) {
      setValidationError(t('storeRequiredFields'));
      return;
    }
    const phoneDigits = cleanPhone.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setValidationError(t('storeInvalidPhone'));
      return;
    }
    setValidationError(null);
    try {
      const result = await placeOrder.mutateAsync({
        storeItemId: product.id,
        customerName: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        quantity,
        note: note.trim() || undefined,
      });
      setReference(result.reference);
      onOrderPlaced?.(product.id);
    } catch {
      setValidationError(t('storeOrderFailed'));
    }
  };

  return (
    <Modal visible={!!product} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* The scrim is a sibling BEHIND the sheet, not its parent. As a
         * parent Pressable it kept the touch responder on drag, so the form's
         * ScrollView never scrolled and "Đặt hàng" stayed off screen. */}
        <Pressable
          accessibilityLabel={t('close')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlayScrim }]}
        />
        <KeyboardAvoidingView
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboard}
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 18),
                backgroundColor: homeGlassColors.surfaceNav,
                borderColor: homeGlassColors.hairlineNav,
              },
            ]}
          >
            {reference ? (
              <View style={styles.successWrap}>
                <View style={[styles.successIcon, { backgroundColor: theme.colors.successTint }]}>
                  <Icon name="check" size={34} color={theme.colors.success} strokeWidth={2.4} />
                </View>
                <Text style={[styles.successTitle, { color: homeGlassColors.text }]}>{t('storeOrderSuccessTitle')}</Text>
                <Text style={[styles.successBody, { color: homeGlassColors.textMuted }]}>{t('storeOrderSuccessBody')}</Text>
                <View style={[styles.referencePill, { backgroundColor: homeGlassColors.surfaceNavActive }]}>
                  <Text style={[styles.referenceText, { color: homeGlassColors.accent }]}>
                    {t('storeOrderReference', { code: reference })}
                  </Text>
                </View>
                <ScalePressable onPress={onClose} style={[styles.primaryButton, { backgroundColor: homeGlassColors.tick }]}>
                  <Text style={styles.primaryButtonText}>{t('storeContinueShopping')}</Text>
                </ScalePressable>
              </View>
            ) : (
              <>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetHeaderCopy}>
                    <Text style={[styles.sheetTitle, { color: homeGlassColors.text }]}>{t('storeOrderTitle')}</Text>
                    <Text style={[styles.sheetSubtitle, { color: homeGlassColors.textMuted }]}>
                      {t('storeOrderSubtitle', { percent: product?.discountPercent ?? 0 })}
                    </Text>
                  </View>
                  <ScalePressable accessibilityLabel={t('close')} onPress={onClose} style={styles.closeButton}>
                    <Icon name="x" size={20} color={homeGlassColors.textSoft} />
                  </ScalePressable>
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.formScroll}
                  contentContainerStyle={styles.formContent}
                >
                  <View style={[styles.productSummary, { backgroundColor: homeGlassColors.surfaceNavActive }]}>
                    <View style={styles.summaryIcon}>
                      <Icon name="shopping-bag" size={21} color={homeGlassColors.accent} />
                    </View>
                    <View style={styles.summaryCopy}>
                      <Text numberOfLines={2} style={[styles.summaryName, { color: homeGlassColors.text }]}>{product?.name}</Text>
                      <View style={styles.summaryPriceRow}>
                        <Text style={[styles.summaryOldPrice, { color: homeGlassColors.textFaint }]}>{product?.priceText}</Text>
                        <Text style={[styles.summaryNewPrice, { color: homeGlassColors.accent }]}>{discountedText}</Text>
                      </View>
                    </View>
                    <View style={[styles.discountPill, { backgroundColor: theme.colors.successTint }]}>
                      <Text style={[styles.discountPillText, { color: theme.colors.success }]}>-{product?.discountPercent}%</Text>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <FieldLabel>{t('storeFullName')}</FieldLabel>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      autoComplete="name"
                      textContentType="name"
                      returnKeyType="next"
                      placeholder={t('storeFullName')}
                      placeholderTextColor={homeGlassColors.textFaint}
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <FieldLabel>{t('storePhone')}</FieldLabel>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      placeholder={t('storePhone')}
                      placeholderTextColor={homeGlassColors.textFaint}
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <FieldLabel>{t('storeAddress')}</FieldLabel>
                    <TextInput
                      value={address}
                      onChangeText={setAddress}
                      autoCapitalize="sentences"
                      autoComplete="street-address"
                      textContentType="fullStreetAddress"
                      multiline
                      maxLength={500}
                      placeholder={t('storeAddress')}
                      placeholderTextColor={homeGlassColors.textFaint}
                      style={[styles.input, styles.multilineInput]}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <FieldLabel trailing={<Text style={[styles.optional, { color: homeGlassColors.textFaint }]}>{t('storeNoteOptional')}</Text>}>
                      {t('storeNote')}
                    </FieldLabel>
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      multiline
                      maxLength={500}
                      placeholder={t('storeNote')}
                      placeholderTextColor={homeGlassColors.textFaint}
                      style={[styles.input, styles.multilineInput]}
                    />
                  </View>

                  <View style={styles.quantityRow}>
                    <Text style={styles.fieldLabel}>{t('storeQuantity')}</Text>
                    <View style={[styles.stepper, { backgroundColor: homeGlassColors.surfaceNavActive }]}>
                      <ScalePressable
                        accessibilityLabel={t('quantityDown')}
                        disabled={quantity <= 1}
                        onPress={() => setQuantity((value) => Math.max(1, value - 1))}
                        style={[styles.stepperButton, quantity <= 1 && styles.disabled]}
                      >
                        <Icon name="minus" size={18} color={homeGlassColors.textSoft} />
                      </ScalePressable>
                      <Text style={[styles.quantityText, { color: homeGlassColors.text }]}>{quantity}</Text>
                      <ScalePressable
                        accessibilityLabel={t('quantityUp')}
                        disabled={quantity >= 10}
                        onPress={() => setQuantity((value) => Math.min(10, value + 1))}
                        style={[styles.stepperButton, quantity >= 10 && styles.disabled]}
                      >
                        <Icon name="plus" size={18} color={homeGlassColors.textSoft} />
                      </ScalePressable>
                    </View>
                  </View>

                  <View style={[styles.totals, { borderTopColor: homeGlassColors.hairline }]}>
                    <Text style={[styles.totalsTitle, { color: homeGlassColors.text }]}>{t('storeOrderSummary')}</Text>
                    <View style={styles.totalRow}>
                      <Text style={[styles.totalLabel, { color: homeGlassColors.textMuted }]}>{t('storeListPrice')}</Text>
                      <Text style={[styles.totalValue, { color: homeGlassColors.textSoft }]}>{product?.priceText}</Text>
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={[styles.totalLabel, { color: theme.colors.success }]}>{t('storeAppDiscount')}</Text>
                      <Text style={[styles.totalValue, { color: theme.colors.success }]}>-{product?.discountPercent}%</Text>
                    </View>
                    <View style={[styles.totalRow, styles.grandTotalRow]}>
                      <Text style={[styles.grandTotalLabel, { color: homeGlassColors.text }]}>{t('storeTotal')}</Text>
                      <Text style={[styles.grandTotalValue, { color: homeGlassColors.accent }]}>{totalText}</Text>
                    </View>
                  </View>

                  {validationError ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{validationError}</Text> : null}

                  <ScalePressable
                    disabled={placeOrder.isPending}
                    onPress={() => void submit()}
                    style={[styles.primaryButton, { backgroundColor: homeGlassColors.tick }, placeOrder.isPending && styles.disabled]}
                  >
                    <Icon name="shopping-bag" size={19} color={homeGlassColors.text} />
                    <Text style={styles.primaryButtonText}>{placeOrder.isPending ? '…' : t('storePlaceOrder')}</Text>
                  </ScalePressable>
                  <View style={styles.secureNote}>
                    <Icon name="shield-check" size={15} color={homeGlassColors.textFaint} />
                    <Text style={[styles.secureText, { color: homeGlassColors.textFaint }]}>{t('storeSecureDetails')}</Text>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  keyboard: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: homeGlassColors.shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
    elevation: 20,
  },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: homeGlassColors.hairlineNav, alignSelf: 'center', marginTop: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  sheetHeaderCopy: { flex: 1, paddingRight: 12 },
  sheetTitle: { fontSize: 23, lineHeight: 29, fontWeight: '700', letterSpacing: -0.35 },
  sheetSubtitle: { marginTop: 3, fontSize: 14, lineHeight: 20 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: homeGlassColors.surfaceNavActive },
  /** Without flexShrink the ScrollView keeps its full content height, the
   * sheet's maxHeight simply clips it, and "Đặt hàng" sits below the screen
   * with nothing to scroll (iPhone 17 Pro, 2026-11-01). */
  formScroll: { flexShrink: 1 },
  formContent: { paddingHorizontal: 20, paddingBottom: 8 },
  productSummary: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 12, marginBottom: 18 },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: homeGlassColors.surfaceActionNeumorphic },
  summaryCopy: { flex: 1, paddingHorizontal: 11 },
  summaryName: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  summaryPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  summaryOldPrice: { fontSize: 12, textDecorationLine: 'line-through' },
  summaryNewPrice: { fontSize: 15, fontWeight: '700' },
  discountPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  discountPillText: { fontSize: 12, fontWeight: '800' },
  fieldGroup: { marginBottom: 14 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  fieldLabel: { color: homeGlassColors.textSoft, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  optional: { fontSize: 12, lineHeight: 17 },
  input: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: homeGlassColors.hairlineNav,
    backgroundColor: homeGlassColors.surfaceNavActive,
    color: homeGlassColors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 21,
  },
  multilineInput: { minHeight: 74, textAlignVertical: 'top' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 1, marginBottom: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, overflow: 'hidden' },
  stepperButton: { width: 42, height: 40, alignItems: 'center', justifyContent: 'center' },
  quantityText: { minWidth: 32, textAlign: 'center', fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totals: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 17 },
  totalsTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', marginBottom: 10 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  totalLabel: { fontSize: 14, lineHeight: 20 },
  totalValue: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  grandTotalRow: { marginTop: 13 },
  grandTotalLabel: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  grandTotalValue: { fontSize: 22, lineHeight: 27, fontWeight: '800', fontVariant: ['tabular-nums'] },
  errorText: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 13 },
  primaryButton: { minHeight: 52, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 18, paddingHorizontal: 18 },
  primaryButtonText: { color: homeGlassColors.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  secureNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 11 },
  secureText: { flexShrink: 1, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  disabled: { opacity: 0.48 },
  successWrap: { paddingHorizontal: 28, paddingTop: 42, paddingBottom: 22, alignItems: 'center' },
  successIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center', marginTop: 19 },
  successBody: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  referencePill: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8, marginTop: 18 },
  referenceText: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.3 },
});
