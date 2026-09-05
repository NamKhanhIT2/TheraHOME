import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import type { ProductInfo } from '@/hooks/usePrograms';

export interface ProductDropdownProps {
  product: ProductInfo;
  products: ProductInfo[];
  onSelect: (id: string) => void;
}

/** Mirrors the reference `ProductDropdown` — dropdown of a user's activated
 * products for the Home/Roadmap switcher. Uses a `Modal` instead of an
 * absolutely-positioned web overlay. */
export function ProductDropdown({ product, products, onSelect }: ProductDropdownProps) {
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
      setMenuFrame({ left: x, top: y + height + 10, width });
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
          { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderInput, borderRadius: theme.radius.md },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: theme.colors[product.accent] }]} />
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{product.name}</Text>
        {single ? null : (
          <Animated.View style={{ transform: [{ rotate: chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Icon name="chevron-down" size={18} color={theme.colors.textSecondary} />
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
                theme.shadows.card,
                { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md },
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
                    { backgroundColor: p.id === product.id ? theme.colors.bgCardAlt : 'transparent' },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: theme.colors[p.accent] }]} />
                  <Text style={[theme.type.body, { color: theme.colors.textPrimary, flex: 1 }]}>{p.name}</Text>
                  {p.id === product.id ? <Icon name="check" size={16} color={theme.colors[p.accent]} /> : null}
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
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
