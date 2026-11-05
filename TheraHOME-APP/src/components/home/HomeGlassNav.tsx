import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homeGlassColors } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { hapticSelect } from '@/lib/haptics';
import { NeumorphicBox } from './NeumorphicBox';
import { glanceAt } from './glanceStore';
import { VerticalGradient } from './VerticalGradient';

/** The four bottom-tab destinations, in the order the prototype draws them. */
const ITEMS: { key: 'home' | 'roadmap' | 'store' | 'community'; icon: string; route: string }[] = [
  { key: 'home', icon: 'home', route: '/home' },
  { key: 'roadmap', icon: 'calendar', route: '/roadmap' },
  { key: 'store', icon: 'shopping-cart', route: '/store' },
  { key: 'community', icon: 'users-round', route: '/community' },
];

export interface HomeGlassNavProps {
  /** Which tab to light up — always 'home' while this bar is on screen, but
   * passed in rather than assumed so the bar stays a dumb component. */
  active: string;
  onNavigate: (route: string) => void;
  /** The assistant button that sits outside the pill, to its right. */
  trailing?: React.ReactNode;
}

/**
 * Home v3's floating bottom bar.
 *
 * The shared white tab bar in `app/(tabs)/_layout.tsx` hides itself while
 * Home is focused and this takes its place, because the design's bar is a
 * translucent pill over the photograph and the shared one is an opaque strip
 * under it. The other three tabs keep the shared bar until their own
 * redesigns land, so navigating away swaps the bar back.
 */
/**
 * How far the floating bar sits off the bottom of the screen.
 *
 * The prototype floats it 24pt off a frame whose home indicator lives at 8.
 * Real devices vary: a gesture-nav Android has almost no inset, a
 * three-button one has ~48. Sitting just outside the inset keeps the same
 * optical gap on all of them. Raised on 2026-10-25 after the owner compared
 * it with Shopify's, then let back down twice the same evening — 4pt, then
 * another 2 — to where they wanted it.
 *
 * Exported because anything that has to clear the bar — Home's scroll mask,
 * its bottom padding — must use the same number rather than repeat it.
 */
export function navBottomOffset(bottomInset: number): number {
  return Math.max(16, bottomInset);
}

/**
 * The floating bar's own body: the 50pt tab row plus the pill's 5pt padding
 * top and bottom. Together with `navBottomOffset` it is where the bar's top
 * edge lands, so anything that must not disappear under the bar adds both.
 *
 * It is NOT `TAB_BAR_BODY_HEIGHT` (`src/hooks/useTabBarInset.ts`), which
 * belongs to the staff layout's platform tab bar — 64 on Android, 84 on iOS.
 * The Store screen reserved its buy button's room with that number minus a
 * fudge, which happens to be 14pt too much on iOS and 6pt too little on
 * Android, and 6pt is exactly how much of the button the bar ate there
 * (seen on the Android 16 emulator, 2026-11-05).
 */
export const NAV_BODY_HEIGHT = 60;

/** One tab. Its own component so the swap between resting and selected can
 * be animated per tab: the well fades in, the lit icon crosses over the
 * quiet one, both in 200ms, and a press takes the icon to 0.97 without
 * moving anything in the layout. */
function NavTab({
  icon,
  label,
  isActive,
  onPress,
}: {
  icon: string;
  label: string;
  isActive: boolean;
  onPress: (at: { x: number; y: number }) => void;
}) {
  const lit = useSharedValue(isActive ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    lit.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive, lit]);

  const wellStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  const litIconStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  const quietIconStyle = useAnimatedStyle(() => ({ opacity: 1 - lit.value }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.03 }] }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      onPress={(event) => onPress({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY })}
      onPressIn={() => { press.value = withTiming(1, { duration: 90 }); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      style={styles.tab}
    >
      <Reanimated.View style={[styles.well, wellStyle]} pointerEvents="none">
        <NeumorphicBox color={homeGlassColors.surfaceNavActive} radius={18} well style={StyleSheet.absoluteFill} />
      </Reanimated.View>
      <Reanimated.View style={pressStyle}>
        <Reanimated.View style={quietIconStyle}>
          <Icon name={icon} size={26} color={homeGlassColors.navIcon} strokeWidth={1.8} />
        </Reanimated.View>
        <Reanimated.View style={[StyleSheet.absoluteFill, styles.litIcon, litIconStyle]}>
          <Icon name={icon} size={26} color={homeGlassColors.navIconActive} strokeWidth={2} />
        </Reanimated.View>
      </Reanimated.View>
    </Pressable>
  );
}

export function HomeGlassNav({ active, onNavigate, trailing }: HomeGlassNavProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bottom = navBottomOffset(insets.bottom);

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      {/* The ground the bar is cast from, blended into the screen rather
          than laid on it as a block: the same colour, fading out upward. A
          raised surface needs something of its own kind underneath or the
          shade below it has nothing to fall on. */}
      <VerticalGradient
        style={styles.ground}
        stops={[
          { offset: 0, color: homeGlassColors.navGround, opacity: 0 },
          { offset: 0.55, color: homeGlassColors.navGround, opacity: 0.72 },
          { offset: 1, color: homeGlassColors.navGround, opacity: 0.92 },
        ]}
      />
      <NeumorphicBox
        color={homeGlassColors.surfaceNav}
        gradient={homeGlassColors.navSurface}
        lightColor={homeGlassColors.roadmapKnobLight}
        lightOpacity={0.05}
        lightBlur={8}
        shadeOpacity={0.5}
        radius={999}
        style={styles.pill}
      >
        {ITEMS.map((item) => (
          <NavTab
            key={item.key}
            icon={item.icon}
            label={t(item.key as TranslationKey)}
            isActive={item.key === active}
            onPress={(at) => {
              // One tick per actual move. The tab you are already on is not
              // a move — `router.navigate` makes it a no-op, and a buzz for
              // a screen that does not change is noise.
              if (item.key !== active) hapticSelect();
              // Every tab is to the mascot's left, so this reads as it
              // turning to watch what the customer just did. The glance
              // store already drives its head; this is one more source.
              glanceAt(at.x, at.y);
              onNavigate(item.route);
            }}
          />
        ))}
      </NeumorphicBox>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 30,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 999,
    padding: 5,
  },
  // Extends well past the bar on every side: a shadow must not be clipped
  // by the thing that blends the ground behind it.
  ground: {
    position: 'absolute',
    left: -26,
    right: -26,
    top: -56,
    bottom: -70,
  },
  well: {
    position: 'absolute',
    width: 58,
    height: 44,
  },
  litIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 50 + the pill's 5pt padding = the 60pt bar every screen's scroll mask
  // and bottom padding is measured against. The material changed; the
  // layout did not (owner's spec, 2026-10-26).
  tab: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
