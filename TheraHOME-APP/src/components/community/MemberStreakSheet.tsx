import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { useI18n } from '@/lib/i18n';
import type { CommunityHighlightRow } from '@/hooks/useCommunity';

export interface MemberStreakSheetProps {
  member: (CommunityHighlightRow & { rank: number }) | null;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}

/**
 * What the avatar strip is FOR (owner, 2026-10-26): the strip honours the
 * people who keep showing up, so tapping one shows how consistent they are —
 * deliberately NOT the community profile that tapping an author's avatar in
 * the feed opens. That screen is about what someone posted; this is about
 * what they have done.
 */
export function MemberStreakSheet({ member, onClose, onOpenProfile }: MemberStreakSheetProps) {
  const theme = useTheme();
  const { t } = useI18n();
  if (!member) return null;

  // A bare number has nothing to look at, so each stat carries its own
  // glyph and its own colour (owner, 2026-10-26). The rank is back as the
  // third one — "không bỏ ngày nào" reads as a badge under the name, not as
  // a tile with a tick where a number should be.
  const stats: { icon: string; tint: string; value: string; label: string }[] = [
    { icon: 'flame', tint: '#FB923C', value: String(member.currentStreak), label: t('streakDays') },
    { icon: 'dumbbell', tint: '#22D3EE', value: String(member.completedDays), label: t('sessionsDone') },
    { icon: 'crown', tint: '#FBBF24', value: `#${member.rank}`, label: t('topMembers') },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={[styles.sheet, { backgroundColor: homeGlassColors.menu, borderColor: homeGlassColors.hairline }]}
        >
          <View style={[styles.grabber, { backgroundColor: homeGlassColors.hairline }]} />

          <View style={styles.head}>
            <View style={[styles.photo, { borderColor: member.checkedInToday ? homeGlassColors.tick : homeGlassColors.purple, backgroundColor: homeGlassColors.surfaceRaised }]}>
              {member.avatarUrl ? (
                <RemoteImage uri={member.avatarUrl} contentFit="cover" style={styles.photoImage} />
              ) : (
                <Icon name="user" size={30} color={homeGlassColors.textFaint} />
              )}
            </View>
            <View style={styles.headText}>
              <Text numberOfLines={1} style={[theme.type.h2, { color: homeGlassColors.text }]}>{member.fullName}</Text>
              <Text numberOfLines={2} style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 2 }]}>
                {member.checkedInToday ? t('checkedInToday') : t('memberStreakHint')}
              </Text>

            </View>
          </View>

          <View style={styles.stats}>
            {stats.map((stat) => (
              <View key={stat.label} style={[styles.stat, { backgroundColor: homeGlassColors.surfaceRaised }]}>
                <Icon name={stat.icon} size={18} color={stat.tint} strokeWidth={2.2} />
                <Text style={[styles.statValue, { color: homeGlassColors.text }]}>{stat.value}</Text>
                <Text numberOfLines={1} style={[theme.type.captionSm, { color: homeGlassColors.textMuted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => onOpenProfile(member.userId)}
            style={({ pressed }) => [styles.link, pressed ? { opacity: 0.6 } : null]}
          >
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.purple }]}>{t('viewProfile')}</Text>
            <Icon name="chevron-right" size={18} color={homeGlassColors.purple} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8,6,16,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 18,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: 60,
    height: 60,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  stat: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 48,
    marginTop: 14,
  },
});
