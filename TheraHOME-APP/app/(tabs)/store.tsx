import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type FlatList } from 'react-native';
import Reanimated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { storeColors, useTheme } from '@/theme';
import { HomeGlassNav, NAV_BODY_HEIGHT, navBottomOffset } from '@/components/home/HomeGlassNav';
import { HomeMascot } from '@/components/home/HomeMascot';
import { VerticalGradient } from '@/components/home/VerticalGradient';
import { heroFont } from '@/components/home/glass';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/icons/Icon';
import { ExpandableText } from '@/components/community/ExpandableText';
import { OrderFormModal } from '@/components/store/OrderFormModal';
import { StoreCartModal } from '@/components/store/StoreCartModal';
import { ScalePressable } from '@/components/motion/ScalePressable';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { useI18n } from '@/lib/i18n';
import { useTabFocusFade } from '@/hooks/useTabFocusFade';
import { useStoreCategories, type StoreItemRow } from '@/hooks/useStore';
import { useMarket } from '@/hooks/useMarket';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { formatStorePrice, storePrice } from '@/lib/storePricing';
import { useStoreCart } from '@/store/useStoreCart';

const COMBO_IMAGE = require('../../assets/store/combo-theraneck.jpg');
const THERANECK_IMAGE = require('../../assets/store/theraneck-plus.png');
const PILLOW_IMAGE = require('../../assets/store/ergonomic-pillow.png');
const HEAT_PATCH_IMAGE = require('../../assets/store/vinh-gia-heat-patch.png');

/** How fast the copy gives way as the pager moves. At 2.6 it has gone by the
 * time the swipe is halfway, which is the moment the text underneath is
 * swapped — so the old words are never seen turning into the new ones. */
const COPY_FADE = 2.6;

function bundledImage(item: StoreItemRow): number | null {
  const name = item.name.toLocaleLowerCase('vi');
  if (item.id === 'item-1789442043284-vn' || name.includes('combo')) return COMBO_IMAGE;
  if (item.id === 'neck-plus') return THERANECK_IMAGE;
  if (item.id === 'item-1789440963558-vn') return PILLOW_IMAGE;
  if (item.id === 'vinh-gia-heat-patch-vn') return HEAT_PATCH_IMAGE;
  if (name.includes('gối') || name.includes('pillow')) return PILLOW_IMAGE;
  if (name.includes('miếng dán') || name.includes('heat patch')) return HEAT_PATCH_IMAGE;
  if (name.includes('theraneck')) return THERANECK_IMAGE;
  return null;
}

/** One product, flattened out of its category — the category title becomes
 * the line under the name, where the reference carries a tagline. */
interface PageProduct {
  item: StoreItemRow;
  categoryTitle: string;
}

function ProductImage({ item, size }: { item: StoreItemRow; size: number }) {
  const local = bundledImage(item);
  const style = { width: size, height: size };
  if (item.imageUrl) return <RemoteImage uri={item.imageUrl} priority="high" contentFit="contain" style={style} />;
  if (local) return <Image source={local} contentFit="contain" transition={160} style={style} />;
  return (
    <View style={[style, styles.imageFallback]}>
      <Icon name="shopping-bag" size={34} color={storeColors.textFaint} />
    </View>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === active && styles.dotActive,
            { backgroundColor: index === active ? storeColors.dotActive : storeColors.dot },
          ]}
        />
      ))}
    </View>
  );
}

function StoreMessage({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.messageBox}>
      <Text style={[theme.type.h2, { color: storeColors.panelText, textAlign: 'center' }]}>{title}</Text>
      <Text style={[theme.type.caption, { color: storeColors.panelMuted, textAlign: 'center', marginTop: 8 }]}>{body}</Text>
      {action}
    </View>
  );
}

export default function StoreScreen() {
  const { t } = useI18n();
  const market = useMarket();
  const { session } = useSession();
  const profile = useProfile(session?.user.id);
  const [orderProduct, setOrderProduct] = useState<StoreItemRow | null>(null);
  const [cartVisible, setCartVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<PageProduct>>(null);
  // The copy scroller. It only scrolls when a product's words outgrow the
  // panel, and when it does it has come up already scrolled — the title's
  // top line cut off by the panel's edge (Android 16 emulator, 2026-11-05).
  // Whatever decides that offset, the top of the name is the one thing this
  // panel must open on, so it is pinned there whenever the tab is entered or
  // the product changes.
  const copyRef = useRef<ScrollView>(null);

  const cartProductIds = useStoreCart((state) => state.productIds);
  const addCartProduct = useStoreCart((state) => state.addProduct);
  const removeCartProduct = useStoreCart((state) => state.removeProduct);
  const clearCart = useStoreCart((state) => state.clearCart);

  const storeQuery = useStoreCategories();
  const { data: categories, isPending } = storeQuery;

  const products = useMemo<PageProduct[]>(
    () => (categories ?? []).flatMap((category) => category.items.map((item) => ({ item, categoryTitle: category.title }))),
    [categories],
  );
  const cartItems = useMemo(() => {
    const itemsById = new Map(products.map((product) => [product.item.id, product.item]));
    return cartProductIds.flatMap((id) => {
      const item = itemsById.get(id);
      return item ? [item] : [];
    });
  }, [cartProductIds, products]);

  const focusFadeStyle = useTabFocusFade();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const available = height - insets.top;
  // A third of the screen for the photo left the longest product — two-line
  // name, description, member card — scrolling its own panel. The photo
  // loses less by being smaller than the copy does by being cut.
  const heroHeight = Math.round(Math.max(180, available * 0.28));
  // The bar's own height, not the staff tab bar's: `TAB_BAR_BODY_HEIGHT` is
  // 64 on Android and 84 on iOS, and minus the 10pt fudge that left 54 here,
  // the buy button lost its bottom 6pt under the bar on every Android phone
  // (Android 16 emulator, 2026-11-05) while iOS had 14pt to spare. 14 is that
  // iOS gap kept as the deliberate one, now on both.
  const navClearance = navBottomOffset(insets.bottom) + NAV_BODY_HEIGHT + 14;

  // The pager's offset drives both the fade and the swap, so the copy is
  // always at its faintest exactly when it changes.
  const scrollX = useSharedValue(0);
  const settledPage = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
    const next = Math.round(event.contentOffset.x / width);
    if (next !== settledPage.value) {
      settledPage.value = next;
      runOnJS(setIndex)(next);
    }
  });
  const copyStyle = useAnimatedStyle(() => {
    const page = scrollX.value / width;
    const distance = Math.abs(page - Math.round(page));
    return { opacity: Math.max(0, 1 - distance * COPY_FADE) };
  });

  useFocusEffect(useCallback(() => {
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      copyRef.current?.scrollTo({ y: 0, animated: false });
    });
    setIndex(0);
    settledPage.value = 0;
    scrollX.value = 0;
    return () => cancelAnimationFrame(frame);
  }, [scrollX, settledPage]));

  // Swiping to another product swaps the words inside the same scroller, so
  // a long product left scrolled would hand the next one its offset.
  useEffect(() => {
    copyRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  const current = products[index] ?? null;
  const activeItem = current?.item ?? null;
  const price = activeItem ? storePrice(activeItem.priceText, market, activeItem.discountPercent) : null;
  const memberPrice = price ? formatStorePrice(price.discounted, market) : activeItem?.priceText ?? '';
  const saving = price && price.saving > 0 ? formatStorePrice(price.saving, market) : '';

  return (
    <View style={[styles.root, { backgroundColor: storeColors.panel }]}>
      <StatusBar style="dark" />
      <VerticalGradient stops={STORE_STOPS} style={{ height: heroHeight + insets.top + 130 }} />
      <SafeAreaView edges={['top']} style={styles.root}>
        <Reanimated.View style={[styles.root, focusFadeStyle]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {/* No "SẢN PHẨM" title: the tab bar already says which tab this
                  is, and stacking a title above the tag made the corner
                  crowded. The discount changes with the copy, not with the
                  product photo. */}
              <Reanimated.View style={copyStyle}>
                {activeItem && activeItem.discountPercent > 0 ? (
                  <View style={[styles.discountTag, { backgroundColor: storeColors.panel }]}>
                    <Text style={[styles.discountTagText, { color: storeColors.actionText }]}>−{activeItem.discountPercent}%</Text>
                  </View>
                ) : null}
              </Reanimated.View>
            </View>
            <ScalePressable
              accessibilityRole="button"
              accessibilityLabel={t('storeCartTitle')}
              onPress={() => setCartVisible(true)}
              style={[styles.chipButton, { backgroundColor: storeColors.chip }]}
            >
              <Icon name="shopping-cart" size={20} color={storeColors.text} strokeWidth={2} />
              {cartItems.length > 0 ? (
                <View style={[styles.cartBadge, { backgroundColor: storeColors.action }]}>
                  <Text style={styles.cartBadgeText}>{Math.min(cartItems.length, 99)}</Text>
                </View>
              ) : null}
            </ScalePressable>
          </View>

          {isPending ? (
            <StoreSkeleton heroHeight={heroHeight} navClearance={navClearance} />
          ) : storeQuery.isError ? (
            <StoreMessage
              title={t('homeLoadErrorTitle')}
              body={t('checkNetworkRetry')}
              action={<Button style={styles.retryButton} loading={storeQuery.isFetching} onPress={() => { void storeQuery.refetch(); }}>{t('retry')}</Button>}
            />
          ) : products.length === 0 ? (
            <StoreMessage title={t('homeNoProductsTitle')} body={t('homeNoCatalog')} />
          ) : (
            <>
              {/* Only the product travels. */}
              <Reanimated.FlatList
                ref={listRef as never}
                data={products}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                keyExtractor={(product) => (product as PageProduct).item.id}
                getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
                style={styles.pager}
                renderItem={({ item: product }) => (
                  <View style={[styles.hero, { width, height: heroHeight }]}>
                    <ProductImage item={(product as PageProduct).item} size={Math.min(width * 0.72, heroHeight * 0.92)} />
                  </View>
                )}
              />

              <Dots count={products.length} active={index} />

              <View style={[styles.panel, { backgroundColor: storeColors.panel, paddingBottom: navClearance }]}>
                {/* Fixed furniture; only the words inside cross-fade.
                    The copy scrolls rather than pushing: a product with a
                    two-line name AND a description AND a member card is
                    taller than the panel on a short screen, and with the
                    button laid out after it, every pixel of overflow came
                    off the button (owner, 2026-11-01 — twice: first it was
                    pushed under the nav bar, then it was touching the
                    card). Now the button owns its row and the copy gets
                    whatever is left. */}
                <ScrollView
                  ref={copyRef}
                  style={styles.copyScroll}
                  contentContainerStyle={styles.copyScrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                <Reanimated.View style={copyStyle}>
                  {/* Name and price used to share one row, and they fought
                      over it: "Combo Phục hồi toàn diện" broke across two
                      lines while the struck-through original price landed
                      level with the second one, so the middle of the panel
                      read as a crowd (owner, 2026-11-02). The name now owns
                      the full width — most names then fit on one line — and
                      the two prices sit together on their own row, where
                      being on one baseline is what makes the discount
                      legible at a glance. */}
                  <Text style={[styles.productName, heroFont('700'), { color: storeColors.panelText }]} numberOfLines={2}>
                    {activeItem?.name ?? ''}
                  </Text>
                  <Text style={[styles.tagline, { color: storeColors.panelMuted }]} numberOfLines={1}>
                    {current?.categoryTitle ?? ''}
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.price, heroFont('700'), { color: storeColors.panelText }]}>{memberPrice}</Text>
                    {saving ? (
                      <Text style={[styles.strike, { color: storeColors.panelFaint }]}>{activeItem?.priceText}</Text>
                    ) : null}
                  </View>

                  {activeItem?.description ? (
                    <ExpandableText
                      key={activeItem.id}
                      text={activeItem.description}
                      collapsedLines={2}
                      toggleColor={storeColors.panelAccent}
                      style={[styles.description, { color: storeColors.panelMuted }]}
                    />
                  ) : null}

                  {saving ? (
                    <View style={styles.savingRow}>
                      <Icon name="sparkles" size={14} color={storeColors.panelAccent} />
                      <Text style={[styles.savingText, { color: storeColors.panelAccent }]}>{t('storeSaving', { amount: saving })}</Text>
                    </View>
                  ) : null}

                  {activeItem && activeItem.discountPercent > 0 ? (
                    <View style={[styles.memberCard, { backgroundColor: storeColors.panelTrack }]}>
                      <View style={[styles.memberIcon, { backgroundColor: storeColors.panelAction }]}>
                        <Icon name="crown" size={15} color={storeColors.actionText} />
                      </View>
                      <View style={styles.memberCopy}>
                        <Text style={[styles.memberEyebrow, { color: storeColors.panelAccent }]}>{t('storeDiscountBadge')}</Text>
                        <Text style={[styles.memberTitle, { color: storeColors.panelText }]}>
                          {t('storeDiscountOffer', { percent: activeItem.discountPercent })}
                        </Text>
                        <Text style={[styles.memberBody, { color: storeColors.panelMuted }]}>{t('storeDiscountBody')}</Text>
                      </View>
                    </View>
                  ) : null}
                </Reanimated.View>
                </ScrollView>

                <ScalePressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (!activeItem) return;
                    addCartProduct(activeItem.id);
                    setOrderProduct(activeItem);
                  }}
                  style={[styles.buyButton, { backgroundColor: storeColors.panelAction }]}
                >
                  <Text style={[styles.buyButtonText, { color: storeColors.actionText }]}>{t('buyNow')}</Text>
                </ScalePressable>
              </View>
            </>
          )}
        </Reanimated.View>
      </SafeAreaView>

      <HomeGlassNav active="store" onNavigate={(route) => router.navigate(route as '/store')} trailing={<HomeMascot cue={null} mood="default" isStaff={false} />} />

      <StoreCartModal
        visible={cartVisible}
        items={cartItems}
        market={market}
        onClose={() => setCartVisible(false)}
        onRemove={removeCartProduct}
        onClear={clearCart}
        onOrder={(item) => {
          setCartVisible(false);
          setOrderProduct(item);
        }}
      />

      <OrderFormModal
        product={orderProduct}
        market={market}
        initialName={profile.data?.fullName}
        initialPhone={profile.data?.phone}
        onClose={() => setOrderProduct(null)}
        onOrderPlaced={removeCartProduct}
      />
    </View>
  );
}

function StoreSkeleton({ heroHeight, navClearance }: { heroHeight: number; navClearance: number }) {
  return (
    <>
      <View style={[styles.hero, { height: heroHeight }]}>
        <View style={[styles.skeletonBlock, styles.skeletonImage]} />
      </View>
      <View style={styles.dots} />
      <View style={[styles.panel, { backgroundColor: storeColors.panel, paddingBottom: navClearance }]}>
        <View style={[styles.skeletonBlock, styles.skeletonDark, { width: '62%', height: 26 }]} />
        <View style={[styles.skeletonBlock, styles.skeletonDark, { width: '38%', height: 14, marginTop: 10 }]} />
        <View style={[styles.skeletonBlock, styles.skeletonDark, { width: '100%', height: 12, marginTop: 18 }]} />
        <View style={[styles.skeletonBlock, styles.skeletonDark, { width: '100%', height: 54, marginTop: 30, borderRadius: 27 }]} />
      </View>
    </>
  );
}

const STORE_STOPS = [
  { offset: storeColors.skyStops[0], color: storeColors.sky[0] },
  { offset: storeColors.skyStops[1], color: storeColors.sky[1] },
  { offset: storeColors.skyStops[2], color: storeColors.sky[2] },
];

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 2,
    zIndex: 2,
  },
  headerLeft: { minHeight: 49, justifyContent: 'center', alignItems: 'flex-start', gap: 4 },
  chipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: storeColors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: storeColors.actionText, fontSize: 10, fontWeight: '700' },

  pager: { flexGrow: 0 },
  hero: { alignItems: 'center', justifyContent: 'center' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, height: 34 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { width: 9, height: 9, borderRadius: 5 },

  panel: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  productName: { fontSize: 25, lineHeight: 30 },
  tagline: { fontSize: 15, marginTop: 2 },
  // One baseline, so the eye reads "now" and "was" as a single statement
  // instead of two stacked numbers.
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  price: { fontSize: 26, lineHeight: 31 },
  strike: { fontSize: 15, textDecorationLine: 'line-through' },

  description: { fontSize: 15, lineHeight: 22, marginTop: 14 },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  savingText: { fontSize: 13, fontWeight: '600' },

  discountTag: { paddingHorizontal: 10, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  discountTagText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },

  copyScroll: { flexShrink: 1 },
  // The buy button's `marginTop: 'auto'` collapses to nothing on a product
  // whose copy fills the panel, which left the member card touching the
  // button. This is the gap that cannot collapse.
  copyScrollContent: { paddingBottom: 20 },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, marginTop: 18 },
  memberIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  memberCopy: { flex: 1 },
  memberEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  memberTitle: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  memberBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },

  buyButton: { marginTop: 'auto', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  buyButtonText: { fontSize: 17, fontWeight: '700' },

  messageBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  retryButton: { marginTop: 18, minWidth: 180 },

  skeletonBlock: { backgroundColor: storeColors.stepperTrack, borderRadius: 10 },
  skeletonDark: { backgroundColor: storeColors.panelTrack },
  skeletonImage: { width: '62%', height: '72%', borderRadius: 24 },
});
