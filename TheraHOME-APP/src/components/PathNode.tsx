import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import type { ProgramDay } from '@/lib/mockData';
import { useI18n } from '@/lib/i18n';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { heroFont } from '@/components/home/glass';
import { RoadmapKnob } from '@/components/roadmap/RoadmapKnob';

export interface PathNodeProps {
  day: ProgramDay;
  /** True when this row is today's calendar day — today keeps the "Hôm
   * nay" label even after it's been watched (the circle still turns into
   * the check). */
  isToday?: boolean;
  /** App Review accounts: locked/upcoming days ARE openable for them, so
   * render those rows as open (day number instead of a lock, full opacity)
   * rather than contradicting the tap. */
  unrestricted?: boolean;
  /** A day inside a phase the user HAS bought, still inside the 49-hour
   * post-purchase wait: the row stays shut but says "Có thể xem sau 2 ngày
   * nữa" rather than the calendar's "Mở khoá vào 0h" (owner 2026-09-25). */
  opensIn24h?: boolean;
  /** Last row of its phase: nothing continues past it, so no line. */
  isLast?: boolean;
  onPress: (id: number) => void;
}

const CIRCLE = 44;

/**
 * One day on the roadmap, in the owner's dark design (2026-10-25).
 *
 * Today's row is red, as the owner's design has it — but the rim is thin and
 * the surface is a 7% wash, with no glow behind it. The first pass copied the
 * design's neon ring and was told it was "loè loẹt"; the second went blue and
 * lost the point. This is the colour they asked for, at the weight they
 * asked for (2026-10-25).
 *
 * The one-time animations stay: the circle fills as a day is completed, its
 * check pops in, the line below fills downward, and the next day's node
 * gives a short pop as it becomes current.
 */
export function PathNode({
  day,
  isToday = false,
  unrestricted = false,
  opensIn24h = false,
  isLast = false,
  onPress,
}: PathNodeProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const reduceMotion = useReduceMotion();
  const isDone = day.status === 'done';
  const isCurrent = day.status === 'current';
  const isMissed = day.status === 'missed';
  const isUpcoming = day.status === 'upcoming';
  const isLocked = day.status === 'locked';
  const isPreview = day.status === 'preview';
  const openOverride = unrestricted && (isLocked || isUpcoming);
  const shut = (isLocked || isUpcoming) && !openOverride;
  /** The row to act on: today, or anything else that is open and unfinished. */
  const live = (isToday && !isDone) || (isCurrent && !isDone);

  const previousStatus = useRef(day.status);
  const connectorFill = useSharedValue(isDone ? 1 : 0);
  const nodeScale = useSharedValue(1);

  useEffect(() => {
    if (isCurrent && !reduceMotion) {
      nodeScale.value = withDelay(
        400,
        withSequence(withTiming(1.08, { duration: 140 }), withSpring(1, { damping: 10, stiffness: 220 })),
      );
    }
    // Mount-only: the one-time "current day enters view" cue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const wasCurrent = previousStatus.current === 'current';
    const wasLockedOrPreview = previousStatus.current === 'locked' || previousStatus.current === 'preview';
    const justCompleted = wasCurrent && isDone;
    const justUnlocked = wasLockedOrPreview && isCurrent;

    if (reduceMotion) {
      connectorFill.value = isDone ? 1 : 0;
    } else if (justCompleted) {
      connectorFill.value = withDelay(280, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    } else {
      connectorFill.value = isDone ? 1 : 0;
    }
    if (justUnlocked && !reduceMotion) {
      nodeScale.value = withDelay(
        500,
        withSequence(withTiming(1.1, { duration: 140 }), withSpring(1, { damping: 9, stiffness: 220 })),
      );
    }
    previousStatus.current = day.status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.status, reduceMotion]);

  const nodeStyle = useAnimatedStyle(() => ({ transform: [{ scale: nodeScale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: connectorFill.value }] }));

  const status = isToday
    ? t('today')
    : isDone
      ? t('completed')
      : isMissed
        ? t('notCompleted')
        : unrestricted
          ? t('dayReadyReview')
          : opensIn24h
            ? t('unlockAfterWait')
            : isUpcoming
              ? t('unlockAtMidnight')
              : isPreview
                ? t('preview')
                : t('locked');

  /** The line that arrives at this node from the row above. */
  const connector = (
    <View style={styles.connector} pointerEvents="none">
      {isDone ? (
        <>
          <View style={[styles.line, { backgroundColor: homeGlassColors.hairline }]} />
          <Reanimated.View
            style={[styles.line, fillStyle, { backgroundColor: homeGlassColors.tick, transformOrigin: 'top' }]}
          />
        </>
      ) : (
        // Dots rather than a dashed border: React Native's dashed borders
        // render differently on each platform and at each radius.
        <View style={styles.dots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: homeGlassColors.hairline }]} />
          ))}
        </View>
      )}
    </View>
  );

  if (day.type === 'rest') {
    return (
      <View style={styles.row}>
        {!isLast ? connector : null}
        <RoadmapKnob size={CIRCLE}>
          <Icon name="moon" size={16} color={homeGlassColors.textFaint} />
        </RoadmapKnob>
        <View style={styles.text}>
          <Text style={[styles.title, heroFont('600'), { color: homeGlassColors.textMuted }]}>
            {t('day')} {day.id}
          </Text>
          <Text style={[theme.type.caption, styles.status, heroFont('400'), { color: homeGlassColors.textFaint }]}>
            {t('restDay')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(day.id)}
      style={({ pressed }) => [styles.row, pressed && !shut ? { opacity: 0.65 } : null]}
    >
      {!isLast ? connector : null}
      <View
        style={[
          styles.live,
          live
            ? {
                backgroundColor: 'rgba(229,72,77,0.06)',
                borderColor: homeGlassColors.focusSoft,
              }
            : null,
        ]}
        pointerEvents="none"
      />
      <Reanimated.View
        style={[
          styles.circle,
          nodeStyle,
          {
            opacity: shut ? 0.75 : 1,
          },
        ]}
      >
        <RoadmapKnob size={CIRCLE}>
          {isDone ? (
            <Reanimated.View entering={ZoomIn.duration(260).delay(260)}>
              <Icon name="check" size={20} color={homeGlassColors.tick} strokeWidth={3} />
            </Reanimated.View>
          ) : (
            <Text
              style={[
                styles.number,
                heroFont('600'),
                { color: live ? homeGlassColors.text : homeGlassColors.textFaint },
              ]}
            >
              {day.id}
            </Text>
          )}
        </RoadmapKnob>
      </Reanimated.View>

      <View style={styles.text}>
        <Text
          style={[
            styles.title,
            heroFont('600'),
            { color: shut ? homeGlassColors.textMuted : homeGlassColors.text },
          ]}
        >
          {t('day')} {day.id}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            theme.type.caption,
            styles.status,
            heroFont('400'),
            {
              color: live
                ? homeGlassColors.focus
                : isMissed
                  ? homeGlassColors.dotMissed
                  : homeGlassColors.textFaint,
            },
          ]}
        >
          {status}
        </Text>
      </View>

      <RoadmapKnob size={38} style={styles.action}>
        <Icon
          name={live ? 'play' : shut ? 'lock' : 'chevron-right'}
          size={live ? 16 : 16}
          color={live ? homeGlassColors.focus : homeGlassColors.roadmapKnobIcon}
          strokeWidth={2.2}
        />
      </RoadmapKnob>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  // The line lives behind the node, running from this row's top edge to its
  // bottom, so consecutive rows join up.
  // From the bottom of this node to the top of the next one. It used to run
  // from centre to centre, and since a node's fill is translucent the line
  // showed straight through the circle and across the tick (owner's
  // screenshot, 2026-10-25).
  connector: {
    position: 'absolute',
    left: 10 + CIRCLE / 2 - 1.5,
    top: CIRCLE + 9,
    bottom: -9,
    width: 3,
    borderRadius: 1.5,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  dots: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  dot: {
    width: 2,
    height: 3,
    borderRadius: 1,
  },
  live: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    flexShrink: 0,
  },
  number: {
    fontSize: 15,
    lineHeight: 20,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  // One step up for readability (owner, 2026-10-26). Deliberately NOT
  // bigger than that: the row is a fixed 44pt circle + 38pt action with the
  // text between them, so the status line has ~245pt on a 375pt screen and
  // nothing may wrap.
  title: {
    fontSize: 17.5,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  status: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  action: {
    flexShrink: 0,
  },
});
