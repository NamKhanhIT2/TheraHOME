import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { homeGlassColors, useTheme } from '@/theme';
import { heroFont } from '@/components/home/glass';
import { Icon } from '@/components/icons/Icon';
import type { ProductInfo } from '@/hooks/usePrograms';

export interface ProductDropdownProps {
  product: ProductInfo;
  products: ProductInfo[];
  onSelect: (id: string) => void;
  /** 'glass' is the dark roadmap's pill — a compact chip rather than a
   * full-width field. The light variant is what every other surface uses. */
  appearance?: 'light' | 'glass';
}

/** Mirrors the reference `ProductDropdown` — dropdown of a user's activated
 * products for the Home/Roadmap switcher. Uses a `Modal` instead of an
 * absolutely-positioned web overlay. */
export function ProductDropdown({ product, products, onSelect, appearance = 'light' }: ProductDropdownProps) {
  const glass = appearance === 'glass';
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  // With a single roadmap there is nothing to switch to: render the trigger
  // as a plain label — no chevron, no menu (owner request 2026-09-05).
  const single = products.length <= 1;
  const triggerRef = useRef<View>(null);
  const [menuFrame, setMenuFrame] = useState({ left: 20, top: 0, width: 0 });
  const menuAnim = useRef(new Animated.Value(0)).current;
  const chevronAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(chevronAnim, { toValue: open ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [open, chevronAnim]);

  function openMenu() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      // The glass chip is narrow; its menu needs more room than the chip
      // itself, and must stay on screen when the chip sits at the right edge.
      const menuWidth = Math.max(width, 190);
      setMenuFrame({ left: Math.max(14, x + width - menuWidth), top: y + height + 10, width: menuWidth });
      setOpen(true);
      menuAnim.setValue(0);
      Animated.spring(menuAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
    });
  }

  function closeMenu() {
    Animated.timing(menuAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => setOpen(false));
  }

  return (
    <View ref={triggerRef} collapsable={false}>
      <Pressable
        onPress={single ? undefined : openMenu}
        disabled={single}
        style={[
          styles.trigger,
          glass
            ? { backgroundColor: homeGlassColors.surfaceRaised, borderColor: homeGlassColors.hairline, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }
            : { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderInput, borderRadius: theme.radius.md },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: glass ? homeGlassColors.accent : theme.colors[product.accent] }]} />
        {/* Clamped and shrinkable: the trigger sits beside a screen title
         * in a space-between row, so an unclamped product name pushes the
         * title off a narrow phone instead of truncating itself. */}
        <Text
          numberOfLines={1}
          style={[
            glass ? [styles.glassLabel, heroFont('600')] : theme.type.bodyStrong,
            { color: glass ? homeGlassColors.text : theme.colors.textPrimary },
            glass ? styles.glassLabelShrink : { flex: 1 },
          ]}
        >
          {product.name}
        </Text>
        {single ? null : (
          <Animated.View style={{ transform: [{ rotate: chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Icon name="chevron-down" size={glass ? 15 : 18} color={glass ? homeGlassColors.textMuted : theme.colors.textSecondary} />
          </Animated.View>
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="none" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menuWrap,
              { left: menuFrame.left, top: menuFrame.top, width: menuFrame.width },
              {
                opacity: menuAnim,
                transform: [
                  { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
                  { scale: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.menu,
                // Only on the light ground: a drop shadow over the dark one is
                // invisible, and the glass branch below draws its own rim.
                glass ? null : theme.shadows.card,
                glass
                  ? { backgroundColor: homeGlassColors.toast, borderRadius: 16, borderWidth: 1, borderColor: homeGlassColors.hairline }
                  : { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.borderInput },
              ]}
            >
              {products.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    onSelect(p.id);
                    closeMenu();
                  }}
                  style={[
                    styles.menuItem,
                    {
                      backgroundColor:
                        p.id === product.id
                          ? glass
                            ? homeGlassColors.surfaceRaised
                            : theme.colors.bgCardAlt
                          : 'transparent',
                    },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: glass ? homeGlassColors.accent : theme.colors[p.accent] }]} />
                  <Text style={[theme.type.body, { color: glass ? homeGlassColors.text : theme.colors.textPrimary, flex: 1 }]}>
                    {p.name}
                  </Text>
                  {p.id === product.id ? (
                    <Icon name="check" size={16} color={glass ? homeGlassColors.accent : theme.colors[p.accent]} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  glassLabelShrink: {
    flexShrink: 1,
    minWidth: 0,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexShrink: 1,
    minWidth: 0,
  },
  glassLabel: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuWrap: {
    position: 'absolute',
  },
  menu: {
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
