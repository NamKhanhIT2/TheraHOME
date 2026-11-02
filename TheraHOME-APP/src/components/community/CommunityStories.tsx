import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { useI18n } from '@/lib/i18n';
import type { CommunityHighlightRow } from '@/hooks/useCommunity';

const RING = 68;
const RING_WIDTH = 2.4;
const RING_WIDTH_LIT = 3.4;
/** The photo inside the ring, with a gap so the ring reads as a ring. */
const PHOTO = RING - RING_WIDTH * 2 - 6;

/**
 * Ring colours, cycled by position. The reference gives every member a
 * different one, which is the only thing that makes a row of circles read as
 * a row rather than as a pattern — so they are assigned by INDEX, not by a
 * hash of the user: the strip is ordered, and the top member should always
 * get the same ring.
 */
const RINGS: [string, string][] = [
  ['#A78BFA', '#EC4899'],
  ['#22D3EE', '#3B82F6'],
  ['#FBBF24', '#F97316'],
  ['#34D399', '#14B8A6'],
  ['#F472B6', '#8B5CF6'],
  ['#60A5FA', '#A78BFA'],
];

function Ring({ index, lit, children }: { index: number; lit?: boolean; children: React.ReactNode }) {
  const [from, to] = RINGS[index % RINGS.length];
  const id = `ring${index % RINGS.length}`;
  return (
    // `lit` is someone who has checked in today: the ring thickens, and
    // that is all. It used to glow as well, which on a dark ground read as
    // a smear around the avatar rather than as a highlight (owner,
    // 2026-10-26).
    <View style={styles.ring}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING / 2 - (lit ? RING_WIDTH_LIT : RING_WIDTH) / 2}
          stroke={`url(#${id})`}
          strokeWidth={lit ? RING_WIDTH_LIT : RING_WIDTH}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}

function Photo({ uri }: { uri: string | null | undefined }) {
  return (
    <View style={[styles.photo, { backgroundColor: homeGlassColors.surfaceRaised }]}>
      {uri ? (
        <RemoteImage uri={uri} priority="high" contentFit="cover" style={styles.photoImage} />
      ) : (
        <Icon name="user" size={PHOTO * 0.46} color={homeGlassColors.textFaint} />
      )}
    </View>
  );
}

export interface CommunityStoriesProps {
  myAvatarUrl: string | null | undefined;
  members: CommunityHighlightRow[];
  /** Today's own check-in — the first circle wears the tick instead of the
   * plus once it is done. */
  checkedIn: boolean;
  onAdd: () => void;
  onOpenMember: (userId: string) => void;
}

/**
 * The strip above the composer: you first, then the members who have
 * trained the hardest (owner's reference, 2026-10-26).
 *
 * It is NOT a stories feature — nothing expires and there is nothing to
 * watch. The first circle opens the composer and the rest open profiles,
 * which is what the circles already meant everywhere else in this app.
 */
export function CommunityStories({ myAvatarUrl, members, checkedIn, onAdd, onOpenMember }: CommunityStoriesProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('createPost')}
        onPress={onAdd}
        style={({ pressed }) => [styles.item, pressed ? { opacity: 0.65 } : null]}
      >
        <Ring index={0} lit={checkedIn}>
          <Photo uri={myAvatarUrl} />
          <View
            style={[
              styles.addBadge,
              {
                backgroundColor: checkedIn ? homeGlassColors.tick : homeGlassColors.purpleStrong,
                borderColor: homeGlassColors.purpleSky[1],
              },
            ]}
          >
            <Icon name={checkedIn ? 'check' : 'plus'} size={13} color="#FFFFFF" strokeWidth={3} />
          </View>
        </Ring>
        <Text numberOfLines={1} style={[theme.type.captionSm, styles.label, { color: homeGlassColors.text }]}>
          {t('yourStory')}
        </Text>
      </Pressable>

      {members.map((member, index) => (
        <Pressable
          key={member.userId}
          accessibilityRole="button"
          accessibilityLabel={member.fullName}
          onPress={() => onOpenMember(member.userId)}
          style={({ pressed }) => [styles.item, pressed ? { opacity: 0.65 } : null]}
        >
          <Ring index={index + 1} lit={member.checkedInToday}>
            <Photo uri={member.avatarUrl} />
            {member.checkedInToday ? (
              <View style={[styles.doneBadge, { backgroundColor: homeGlassColors.tick, borderColor: homeGlassColors.purpleSky[1] }]}>
                <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
              </View>
            ) : null}
          </Ring>
          <Text numberOfLines={1} style={[theme.type.captionSm, styles.label, { color: homeGlassColors.textMuted }]}>
            {member.fullName}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Bleeds past the list's own 14pt padding so the strip runs off the edge
  // of the screen the way the reference does, instead of stopping short.
  scroll: {
    marginHorizontal: -14,
    marginTop: 14,
  },
  row: {
    paddingHorizontal: 14,
    gap: 12,
  },
  item: {
    width: RING,
    alignItems: 'center',
    gap: 6,
  },
  ring: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: PHOTO,
    height: PHOTO,
  },
  addBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    maxWidth: RING,
    textAlign: 'center',
  },
});
