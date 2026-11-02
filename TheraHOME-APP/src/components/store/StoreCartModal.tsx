import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { ScalePressable } from '@/components/motion/ScalePressable';
import { useI18n } from '@/lib/i18n';
import { formatStorePrice, storePrice } from '@/lib/storePricing';
import type { StoreItemRow } from '@/hooks/useStore';
import type { StoreMarket } from '@/hooks/useMarket';

interface StoreCartModalProps {
  visible: boolean;
  items: StoreItemRow[];
  market: StoreMarket;
  onClose: () => void;
  onOrder: (item: StoreItemRow) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
}

export function StoreCartModal({ visible, items, market, onClose, onOrder, onRemove, onClear }: StoreCartModalProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* The scrim is a sibling BEHIND the sheet, not its parent, and the
          * sheet is a plain View rather than a stopPropagation Pressable.
          * That exact shape — Pressable scrim wrapping a Pressable sheet
          * wrapping a ScrollView — held the touch responder on drag in
          * OrderFormModal, so its form could not be scrolled at all. The cart
          * shows one row per catalogue product, so with four it never
          * outgrows maxHeight; a longer catalogue would hit the same wall
          * (2026-11-01). */}
        <Pressable
          accessibilityLabel={t('close')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlayScrim }]}
        />
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
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{t('storeCartTitle')}</Text>
              {items.length > 0 ? <Text style={styles.subtitle}>{t('storeCartSaved', { count: items.length })}</Text> : null}
            </View>
            <ScalePressable accessibilityLabel={t('close')} onPress={onClose} style={styles.closeButton}>
              <Icon name="x" size={20} color={homeGlassColors.textSoft} />
            </ScalePressable>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="shopping-cart" size={30} color={homeGlassColors.accent} />
              </View>
              <Text style={styles.emptyText}>{t('storeCartEmpty')}</Text>
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.listScroll} contentContainerStyle={styles.list}>
                {items.map((item) => {
                  const price = storePrice(item.priceText, market, item.discountPercent);
                  const discounted = price ? formatStorePrice(price.discounted, market) : item.priceText;
                  return (
                    <View key={item.id} style={styles.item}>
                      <View style={styles.itemCopy}>
                        <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
                        <View style={styles.priceRow}>
                          <Text style={styles.oldPrice}>{item.priceText}</Text>
                          <Text style={styles.price}>{discounted}</Text>
                        </View>
                      </View>
                      <View style={styles.actions}>
                        <ScalePressable accessibilityLabel={t('storeCartRemove')} onPress={() => onRemove(item.id)} style={styles.removeButton}>
                          <Icon name="trash-2" size={18} color={homeGlassColors.textMuted} />
                        </ScalePressable>
                        <ScalePressable onPress={() => onOrder(item)} style={styles.orderButton}>
                          <Text style={styles.orderButtonText}>{t('storeCartOrder')}</Text>
                        </ScalePressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <ScalePressable onPress={onClear} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>{t('storeCartClear')}</Text>
              </ScalePressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '78%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, overflow: 'hidden', shadowColor: homeGlassColors.shadow, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.42, shadowRadius: 24, elevation: 20 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: homeGlassColors.hairlineNav, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  headerCopy: { flex: 1 },
  title: { color: homeGlassColors.text, fontSize: 23, lineHeight: 29, fontWeight: '700', letterSpacing: -0.35 },
  subtitle: { color: homeGlassColors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: homeGlassColors.surfaceNavActive },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 42 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: homeGlassColors.surfaceNavActive },
  emptyText: { color: homeGlassColors.textMuted, fontSize: 15, lineHeight: 21, marginTop: 15, textAlign: 'center' },
  /** React Native defaults flexShrink to 0, so without this the ScrollView keeps its full content height, the sheet's maxHeight simply clips it, and there is nothing left to scroll (2026-11-01). */
  listScroll: { flexShrink: 1 },
  list: { paddingHorizontal: 20, gap: 10, paddingBottom: 10 },
  item: { borderRadius: 18, borderWidth: 1, borderColor: homeGlassColors.hairlineNav, backgroundColor: homeGlassColors.surfaceNavActive, padding: 13 },
  itemCopy: { minWidth: 0 },
  itemName: { color: homeGlassColors.text, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 5 },
  oldPrice: { color: homeGlassColors.textFaint, fontSize: 12, lineHeight: 16, textDecorationLine: 'line-through' },
  price: { color: homeGlassColors.accent, fontSize: 17, lineHeight: 21, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 9, marginTop: 11 },
  removeButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: homeGlassColors.surfaceNav },
  orderButton: { minHeight: 40, minWidth: 112, paddingHorizontal: 16, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: homeGlassColors.tick },
  orderButtonText: { color: homeGlassColors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  clearButton: { alignSelf: 'center', paddingHorizontal: 18, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  clearButtonText: { color: homeGlassColors.textMuted, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
