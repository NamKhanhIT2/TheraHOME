import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { Easing, ZoomIn, interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import type { ProgramDay } from '@/lib/mockData';
import { useI18n } from '@/lib/i18n';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export interface PathNodeProps {
  day: ProgramDay;
  /** True when this row is today's calendar day — today keeps the "Hôm
   * nay" label even after it's been watched (the circle still turns into
   * the green check). */
  isToday?: boolean;
  /** App Review accounts: locked/upcoming days ARE openable for them, so
   * render those rows as open ("Sẵn sàng để xem", day number instead of a
   * lock/clock icon, full opacity) rather than contradicting the tap. */
  unrestricted?: boolean;
  onPress: (id: number) => void;
}

function stageOf(status: ProgramDay['status']): number {
  return status === 'done' ? 2 : status === 'current' ? 1 : 0;
}

/** Roadmap timeline row — mirrors `PathNode`, including the connecting
 * vertical line behind each node. Animates the "just completed a day"
 * moment: circle fills to success green, the checkmark pops in, the
 * connector line fills downward, then (in the next day's own instance) that
 * node gets a brief emphasize pop as it becomes current — a lucide icon
 * can't be stroke-drawn like a hand-authored SVG check, so the pop-in is
 * the closest equivalent. */
export function PathNode({ day, isToday = false, unrestricted = false, onPress }: PathNodeProps) {
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

  const previousStatus = useRef(day.status);
  const stage = useSharedValue(stageOf(day.status));
  const connectorFill = useSharedValue(isDone ? 1 : 0);
  const nodeScale = useSharedValue(1);

  useEffect(() => {
    if (isCurrent && !reduceMotion) {
      nodeScale.value = withDelay(400, withSequence(withTiming(1.1, { duration: 140 }), withSpring(1, { damping: 10, stiffness: 220 })));
    }
    // Deliberately mount-only — this is the one-time "current day enters
    // view, emphasize once, then stay still" cue, not a per-render effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const wasCurrent = previousStatus.current === 'current';
    const wasLockedOrPreview = previousStatus.current === 'locked' || previousStatus.current === 'preview';
    const justCompleted = wasCurrent && isDone;
    const justUnlocked = wasLockedOrPreview && isCurrent;

    if (reduceMotion) {
      stage.value = stageOf(day.status);
      connectorFill.value = isDone ? 1 : 0;
    } else if (justCompleted) {
      stage.value = withTiming(stageOf(day.status), { duration: 380, easing: Easing.out(Easing.cubic) });
      connectorFill.value = withDelay(280, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    } else {
      stage.value = stageOf(day.status);
      connectorFill.value = isDone ? 1 : 0;
    }
    if (justUnlocked && !reduceMotion) {
      nodeScale.value = withDelay(500, withSequence(withTiming(1.12, { duration: 140 }), withSpring(1, { damping: 9, stiffness: 220 })));
    }
    previousStatus.current = day.status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.status, reduceMotion]);

  const circleAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(stage.value, [0, 1, 2], [theme.colors.bgCard, theme.colors.primary, theme.colors.success]),
    borderColor: interpolateColor(stage.value, [0, 1, 2], [theme.colors.borderInput, theme.colors.primary, theme.colors.success]),
    transform: [{ scale: nodeScale.value }],
  }));
  const connectorAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: connectorFill.value }] }));

  if (day.type === 'rest') {
    return (
      <View style={[styles.row, { opacity: 0.6 }]}>
        <View style={[styles.connector, { backgroundColor: theme.colors.borderLight }]} />
        <View
          style={[
            styles.circle,
            {
              backgroundColor: theme.colors.bgCardAlt,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: theme.colors.borderInput,
            },
          ]}
        >
          <Icon name="moon" size={15} color={theme.colors.textMuted} />
        </View>
        <View>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textSecondary }]}>{t('day')} {day.id}</Text>
          <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{t('restDay')}</Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(day.id)}
      style={[styles.row, { opacity: (isLocked || isUpcoming) && !openOverride ? 0.72 : 1 }]}
    >
      <View style={[styles.connector, { backgroundColor: theme.colors.borderLight }]} />
      <Reanimated.View style={[styles.connector, connectorAnimatedStyle, { backgroundColor: theme.colors.success, transformOrigin: 'top' }]} />
      <Reanimated.View
        style={[
          styles.circle,
          { borderWidth: 2 },
          circleAnimatedStyle,
          isCurrent
            ? { shadowColor: theme.colors.primary, shadowOpacity: 0.25, shadowRadius: 5, elevation: 2 }
            : null,
        ]}
      >
        {isDone ? (
          <Reanimated.View entering={ZoomIn.duration(260).delay(260)}>
            <Icon name="check" size={17} color="#fff" />
          </Reanimated.View>
        ) : isLocked && !openOverride ? (
          <Icon name="lock" size={15} color={theme.colors.textMuted} />
        ) : isUpcoming && !openOverride ? (
          <Icon name="clock" size={15} color={theme.colors.textMuted} />
        ) : (
          <Text style={{ color: isPreview || isMissed || openOverride ? theme.colors.primary : '#fff', fontWeight: '700', fontSize: 14 }}>{day.id}</Text>
        )}
      </Reanimated.View>
      <View>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('day')} {day.id}</Text>
        <Text style={[theme.type.caption, { color: isMissed ? theme.colors.error : theme.colors.textMuted }]}>
          {isToday || (isCurrent && !unrestricted)
            ? t('today')
            : isDone
              ? t('completed')
              : isMissed
                ? t('notCompleted')
                : unrestricted
                  ? // Review accounts: any not-done day is simply openable —
                    // "Hôm nay" belongs only to the row isToday points at.
                    t('dayReadyReview')
                  : isUpcoming
                    ? t('unlockAtMidnight')
                    : isPreview
                      ? t('preview')
                      : t('locked')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 9,
  },
  connector: {
    position: 'absolute',
    left: 19,
    top: -9,
    bottom: -9,
    width: 2,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
