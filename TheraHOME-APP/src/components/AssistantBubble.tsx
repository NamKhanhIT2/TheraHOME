import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homeGlassColors, useTheme } from '@/theme';
import { useSpecialistPresence } from '@/hooks/useChat';
import { TAB_BAR_BODY_HEIGHT, useTabBarInset } from '@/hooks/useTabBarInset';
import { Icon } from '@/components/icons/Icon';
import { MascotFace, type MascotCue, type MascotMood } from '@/components/home/MascotFace';
import { NeumorphicBox } from '@/components/home/NeumorphicBox';
import { useI18n } from '@/lib/i18n';

export interface AssistantBubbleProps {
  onOpenAIChat: () => void;
  onOpenSupportChat: () => void;
  /** Distance above the bottom safe-area inset — defaults to clearing the tab bar. */
  bottomOffset?: number;
  /** Admin/cskh accounts get "Chat" (→ the conversations list) instead of
   * the patient-facing "Chuyên gia TheraHOME" (→ their one specialist
   * thread) — see useWebRoles.ts. `onOpenSupportChat` still fires either
   * way; the caller decides which route it points to. */
  isStaff?: boolean;
  /**
   * 'floating' (the default) pins the button above the tab bar, which is what
   * every tab but Home wants. 'inline' drops the positioning so a caller can
   * place it themselves — Home v3 seats it in its own floating nav row.
   */
  placement?: 'floating' | 'inline';
  /** Window coordinates of the last touch on the host screen. The glass
   * mascot turns its head toward it. Ignored by the brand appearance. */
  lookAt?: { x: number; y: number } | null;
  /** A reaction to something that actually happened — the host screen owns
   * the data, so it decides what is worth reacting to. */
  cue?: MascotCue | null;
  /** What the mascot's idle loop should lean towards. */
  mood?: MascotMood;
  /**
   * 'brand' is the blue disc on a light screen. 'glass' is Home v3's
   * treatment: the same avatar in a translucent ring, so it belongs to the
   * nav bar beside it instead of punching a solid circle through the photo.
   */
  appearance?: 'brand' | 'glass';
}

const SIZE = 60;
const AI_ASSISTANT_IMAGE = require('../../assets/ai-assistant.png');
const SPECIALIST_IMAGE = require('../../assets/therahome-specialist.png');
/** Home v3's assistant FAB is the nurse, animated — see MascotFace, which
 * drives both of her 3x3 sheets. The still `ai-assistant.png` above is the
 * robot, and deliberately NOT the nurse: it sits next to
 * `therahome-specialist.png` in the picker below, and when both were the
 * same character the two rows were indistinguishable (owner, 2026-11-01).
 * The robot is the AI, the nurse on the badge is a human being. */
const MASCOT_SIZE = 46;

/** Floating action button + bottom-sheet chat picker — mirrors `AssistantBubble`. */
export function AssistantBubble({ onOpenAIChat, onOpenSupportChat, bottomOffset = TAB_BAR_BODY_HEIGHT + 12, isStaff = false, placement = 'floating', appearance = 'brand', lookAt = null, cue = null, mood = 'default' }: AssistantBubbleProps) {
  const theme = useTheme();
  const { t } = useI18n();
  // Two different measurements on purpose: the FAB rides on top of the tab
  // bar and follows its Android-only growth, while the sheet below keeps the
  // raw inset because nothing has reserved that space for it.
  const tabBarInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const glass = appearance === 'glass';
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const specialistOnline = useSpecialistPresence();
  const ringPulse = useRef(new Animated.Value(0)).current;
  const badgeGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(badgeGlow, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(badgeGlow, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(3600),
      ]),
    );
    ring.start();
    glow.start();
    return () => { ring.stop(); glow.stop(); };
  }, [badgeGlow, ringPulse]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        onPressIn={() => glass && setHeld(true)}
        onPressOut={() => glass && setHeld(false)}
        style={[
          styles.fab,
          glass ? styles.fabGlass : null,
          glass
            ? // The disc carries no shadow of its own — NeumorphicBox casts
              // both of them, in the same direction as the bar's.
              null
            : theme.shadows.fab,
          placement === 'inline'
            ? // Home v3 lays the button out itself, in its own nav row.
              { position: 'relative' }
            : {
                right: 16,
                // + tabBarInset: on Android the tab bar this is meant to
                // clear reserves the system navigation bar's height (see
                // (tabs)/_layout.tsx), so a fixed offset from the screen edge
                // lands the bubble on top of the Community tab instead of
                // above it. On iOS that inset is zero — the bar does not grow
                // there, and adding it lifted the bubble 34pt too high.
                bottom: bottomOffset + tabBarInset,
              },
          {
            backgroundColor: glass ? homeGlassColors.surfaceNav : theme.colors.primary,
            borderColor: glass ? homeGlassColors.hairlineNav : theme.dark ? theme.colors.bgApp : '#fff',
          },
        ]}
      >
        {/* Home v3 draws this as a plain glass disc with the assistant's
            outline glyph — no pulse ring, no photo. Everywhere else keeps the
            brand avatar and its breathing ring. */}
        {glass ? null : (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.aiPulseRing,
              {
                borderColor: theme.colors.primary,
                opacity: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.42] }),
                transform: [{ scale: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
              },
            ]}
          />
        )}
        {glass ? (
          <>
            {/* Same material and the same light as the bar beside it: a
                raised disc, not a glass ring (owner's spec, 2026-10-26). */}
            <NeumorphicBox
              color={homeGlassColors.surfaceNav}
              gradient={homeGlassColors.navSurface}
              lightColor={homeGlassColors.roadmapKnobLight}
              lightOpacity={0.05}
              lightBlur={8}
              shadeOpacity={0.5}
              radius={SIZE / 2}
              style={StyleSheet.absoluteFill}
            />
            <MascotFace size={MASCOT_SIZE} lookAt={lookAt} excited={held} cue={cue} mood={mood} />
          </>
        ) : (
          <Image source={AI_ASSISTANT_IMAGE} style={styles.fabImage} resizeMode="cover" />
        )}
        {glass ? null : (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.badgeGlow,
              {
                backgroundColor: theme.colors.success,
                opacity: badgeGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
                transform: [{ scale: badgeGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
              },
            ]}
          />
        )}
        {/* Home v3 draws a bare disc — no presence dot. Specialist
            availability still shows inside the picker sheet. */}
        {glass ? null : (
          <View style={[styles.badge, { backgroundColor: theme.colors.success, borderColor: theme.dark ? theme.colors.bgApp : '#fff' }]} />
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Dark sheet: the only thing that opens this is the disc in the
            dark nav row, where a light `bgCard` panel came up as a white
            slab (owner's contrast sweep, 2026-10-26). */}
        <Pressable style={[styles.backdrop, { backgroundColor: 'rgba(8,10,16,0.6)' }]} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: homeGlassColors.menu,
                borderWidth: 1,
                borderColor: homeGlassColors.hairline,
                borderTopLeftRadius: theme.radius.lg,
                borderTopRightRadius: theme.radius.lg,
                paddingBottom: 24 + insets.bottom,
              },
            ]}
          >
            <Text style={[theme.type.h2, { color: homeGlassColors.text, marginBottom: 14 }]}>
              {t('chatWithWho')}
            </Text>
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => {
                  setOpen(false);
                  onOpenAIChat();
                }}
                style={[styles.option, { backgroundColor: homeGlassColors.surfaceRaised, borderRadius: theme.radius.lg }]}
              >
                <Image source={AI_ASSISTANT_IMAGE} style={styles.optionAvatar} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>{t('aiAssistant')}</Text>
                  <Text style={[theme.type.caption, { color: homeGlassColors.textMuted }]}>
                    {t('instantReplies')}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color={homeGlassColors.textFaint} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setOpen(false);
                  onOpenSupportChat();
                }}
                style={[styles.option, { backgroundColor: homeGlassColors.surfaceRaised, borderRadius: theme.radius.lg }]}
              >
                <Image source={SPECIALIST_IMAGE} style={styles.optionAvatar} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>{isStaff ? 'Chat' : t('specialist')}</Text>
                  {isStaff ? (
                    <Text style={[theme.type.caption, { color: homeGlassColors.textMuted }]}>Danh sách hội thoại</Text>
                  ) : (
                    <OnlineIndicator online={specialistOnline} />
                  )}
                </View>
                <Icon name="chevron-right" size={16} color={homeGlassColors.textFaint} />
              </Pressable>
            </View>
            <Pressable onPress={() => setOpen(false)} style={styles.cancelBtn}>
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.textMuted }]}>{t('cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Specialist status indicator, reused by the FAB sheet and chat header. */
export function OnlineIndicator({ online }: { online: boolean }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.onlineRow}>
      {/* Both places this sits are on the dark palette now (the specialist
          thread's header and Trợ giúp), so it reads from the glass tokens. */}
      <View style={[styles.onlineDot, { backgroundColor: online ? homeGlassColors.dotDone : homeGlassColors.textFaint }]} />
      <Text style={[theme.type.caption, { color: online ? homeGlassColors.dotDone : homeGlassColors.textFaint }]}>
        {online ? t('online') : t('offlineReply')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fabGlass: { borderWidth: 0 },
  fabImage: { width: SIZE - 4, height: SIZE - 4, borderRadius: (SIZE - 4) / 2 },
  aiPulseRing: {
    position: 'absolute',
    width: SIZE + 8,
    height: SIZE + 8,
    borderRadius: (SIZE + 8) / 2,
    borderWidth: 1.5,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  badgeGlow: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionAvatar: { width: 40, height: 40, borderRadius: 20 },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cancelBtn: {
    width: '100%',
    marginTop: 14,
    paddingVertical: 6,
    alignItems: 'center',
  },
});
