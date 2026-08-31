import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useSpecialistPresence } from '@/hooks/useChat';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

export interface AssistantBubbleProps {
  onOpenAIChat: () => void;
  onOpenSupportChat: () => void;
  /** Distance from the bottom of the screen — defaults to clearing the tab bar. */
  bottomOffset?: number;
  /** Admin/cskh accounts get "Chat" (→ the conversations list) instead of
   * the patient-facing "Chuyên gia TheraHOME" (→ their one specialist
   * thread) — see useWebRoles.ts. `onOpenSupportChat` still fires either
   * way; the caller decides which route it points to. */
  isStaff?: boolean;
}

const SIZE = 60;
const AI_ASSISTANT_IMAGE = require('../../assets/ai-assistant.png');
const SPECIALIST_IMAGE = require('../../assets/therahome-specialist.png');

/** Floating action button + bottom-sheet chat picker — mirrors `AssistantBubble`. */
export function AssistantBubble({ onOpenAIChat, onOpenSupportChat, bottomOffset = 96, isStaff = false }: AssistantBubbleProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
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
        style={[
          styles.fab,
          theme.shadows.fab,
          {
            right: 16,
            bottom: bottomOffset,
            backgroundColor: theme.colors.primary,
            borderColor: theme.dark ? theme.colors.bgApp : '#fff',
          },
        ]}
      >
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
        <Image source={AI_ASSISTANT_IMAGE} style={styles.fabImage} resizeMode="cover" />
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
        <View style={[styles.badge, { backgroundColor: theme.colors.success, borderColor: theme.dark ? theme.colors.bgApp : '#fff' }]} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.bgCard,
                borderTopLeftRadius: theme.radius.lg,
                borderTopRightRadius: theme.radius.lg,
                paddingBottom: 24 + insets.bottom,
              },
            ]}
          >
            <Text style={[theme.type.h2, { color: theme.colors.textPrimary, marginBottom: 14 }]}>
              {t('chatWithWho')}
            </Text>
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => {
                  setOpen(false);
                  onOpenAIChat();
                }}
                style={[styles.option, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.lg }]}
              >
                <Image source={AI_ASSISTANT_IMAGE} style={styles.optionAvatar} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('aiAssistant')}</Text>
                  <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>
                    {t('instantReplies')}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color={theme.colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setOpen(false);
                  onOpenSupportChat();
                }}
                style={[styles.option, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.lg }]}
              >
                <Image source={SPECIALIST_IMAGE} style={styles.optionAvatar} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{isStaff ? 'Chat' : t('specialist')}</Text>
                  {isStaff ? (
                    <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>Danh sách hội thoại</Text>
                  ) : (
                    <OnlineIndicator online={specialistOnline} />
                  )}
                </View>
                <Icon name="chevron-right" size={16} color={theme.colors.textMuted} />
              </Pressable>
            </View>
            <Pressable onPress={() => setOpen(false)} style={styles.cancelBtn}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textSecondary }]}>{t('cancel')}</Text>
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
      <View style={[styles.onlineDot, { backgroundColor: online ? theme.colors.success : theme.colors.textMuted }]} />
      <Text style={[theme.type.caption, { color: online ? theme.colors.success : theme.colors.textMuted }]}>
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
    backgroundColor: 'rgba(20,24,34,0.45)',
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
