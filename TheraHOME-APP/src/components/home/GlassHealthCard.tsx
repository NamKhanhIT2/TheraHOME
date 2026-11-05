import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { homeGlassColors, useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { hapticConfirm, hapticSelect } from '@/lib/haptics';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Icon } from '@/components/icons/Icon';
import { useHealthActivity } from '@/hooks/useHealthActivity';
import { GlassCard } from './GlassCard';
import { Reveal } from './ScrollFade';
import { heroFont, tabularNums } from './glass';
import { NeumorphicSurface } from './NeumorphicSurface';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const BOX = 116;
const STROKE = 11;
/** Outermost first, the way Apple nests them. */
const RADII = [BOX / 2 - STROKE / 2 - 1, BOX / 2 - STROKE * 1.65, BOX / 2 - STROKE * 2.8];
const FILL_MS = 950;
/** A phone with no Watch has no Move goal to borrow, and Apple sets no step
 * goal at all. Ten thousand is the number everyone already has in their head. */
const STEP_GOAL = 10000;

function Ring({
  radius,
  color,
  value,
  goal,
  grow,
}: {
  radius: number;
  color: string;
  value: number;
  goal: number;
  grow: SharedValue<number>;
}) {
  const circumference = Math.PI * 2 * radius;
  const share = goal > 0 ? Math.min(1, value / goal) : 0;
  const props = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - share * grow.value),
  }));
  return (
    <G rotation={-90} origin={`${BOX / 2}, ${BOX / 2}`}>
      <Circle
        cx={BOX / 2}
        cy={BOX / 2}
        r={radius}
        fill="none"
        stroke={homeGlassColors.ringTrack}
        strokeWidth={STROKE}
      />
      <AnimatedCircle
        cx={BOX / 2}
        cy={BOX / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={[circumference, circumference]}
        animatedProps={props}
      />
    </G>
  );
}

function Metric({
  color,
  label,
  value,
  goal,
  unit,
}: {
  color: string;
  label: string;
  value: string | number;
  goal: string | number;
  unit: string;
}) {
  const theme = useTheme();
  return (
    <View>
      <Text style={[theme.type.captionSm, heroFont('500'), { color: homeGlassColors.textMuted }]}>{label}</Text>
      <View style={styles.metricValue}>
        <Text style={[styles.number, tabularNums, heroFont('600'), { color }]}>{value}</Text>
        <Text style={[theme.type.captionSm, tabularNums, heroFont('400'), { color: homeGlassColors.textFaint }]}>
          /{goal} {unit}
        </Text>
      </View>
    </View>
  );
}

/**
 * Today's activity, in place of the roadmap dot grid the owner dropped from
 * Home (2026-10-25).
 *
 * Renders nothing on Android and on any device with no Health app — Health
 * Connect is a separate library and a separate Play declaration.
 */
export function GlassHealthCard({ userId }: { userId: string | undefined }) {
  const theme = useTheme();
  const { t } = useI18n();
  const reduceMotion = useReduceMotion();
  const { status, activity, connect } = useHealthActivity(userId);
  const grow = useSharedValue(0);
  // Pressing "Kết nối" hands the screen to iOS's own sheet, so the tick on
  // the press is only half the story — the part worth feeling is Health
  // actually answering. Only a `ready` counts: a denial and an empty Health
  // app both land on `empty`, and congratulating somebody for saying no is
  // worse than saying nothing.
  const asking = useRef(false);
  const askToConnect = useCallback(() => {
    hapticSelect();
    asking.current = true;
    void connect();
  }, [connect]);
  useEffect(() => {
    if (!asking.current || status === 'loading') return;
    if (status === 'ready') hapticConfirm();
    asking.current = false;
  }, [status]);
  // Cached as a bitmap for the scroll, but only once the rings have stopped
  // filling — caching something mid-animation re-draws it every frame.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (status !== 'ready') return;
    if (reduceMotion) {
      grow.value = 1;
      setSettled(true);
      return;
    }
    grow.value = 0;
    grow.value = withDelay(120, withTiming(1, { duration: FILL_MS, easing: Easing.out(Easing.cubic) }));
    const timer = setTimeout(() => setSettled(true), FILL_MS + 320);
    return () => clearTimeout(timer);
  }, [grow, reduceMotion, status]);

  if (status === 'unsupported') return null;

  const rings = activity?.rings ?? null;

  return (
    <GlassCard style={styles.card}>
      <Reveal style={styles.header}>
        <View>
          <View style={styles.title}>
            <Icon name="flame" size={17} color={homeGlassColors.ringMove} strokeWidth={2.2} />
            <Text style={[styles.titleText, heroFont('600'), { color: homeGlassColors.text }]}>
              {t('healthActivity')}
            </Text>
          </View>
          {/* Guideline 2.5.1: an app that links HealthKit must say so in its
              own UI, not only in the permission sheet. The card is the one
              place these numbers are shown, so the attribution belongs here
              — in every state, including before anyone has connected.
              Profile › Apple Health carries the full explanation, and is
              reachable on an iPad, where HealthKit does not exist and this
              card renders nothing (App Review, 2026-11-04). */}
          <View style={styles.source}>
            <Icon name="heart" size={11} color={homeGlassColors.textFaint} strokeWidth={2.4} />
            <Text style={[theme.type.captionSm, heroFont('400'), { color: homeGlassColors.textFaint }]}>
              {t('healthSource')}
            </Text>
          </View>
        </View>
        <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.textFaint }]}>
          {t('today')}
        </Text>
      </Reveal>

      {status === 'ready' && activity ? (
        <Reveal style={styles.body} rasterize={settled}>
          <Svg width={BOX} height={BOX}>
            {rings ? (
              <>
                <Ring radius={RADII[0]} color={homeGlassColors.ringMove} value={rings.move} goal={rings.moveGoal} grow={grow} />
                <Ring radius={RADII[1]} color={homeGlassColors.ringExercise} value={rings.exercise} goal={rings.exerciseGoal} grow={grow} />
                <Ring radius={RADII[2]} color={homeGlassColors.ringStand} value={rings.stand} goal={rings.standGoal} grow={grow} />
              </>
            ) : (
              // One ring, for the one thing a phone on its own can count well.
              <Ring radius={RADII[0]} color={homeGlassColors.ringMove} value={activity.steps} goal={STEP_GOAL} grow={grow} />
            )}
          </Svg>
          <View style={styles.metrics}>
            {rings ? (
              <>
                <Metric color={homeGlassColors.ringMove} label={t('healthMove')} value={rings.move} goal={rings.moveGoal} unit={t('healthKcal')} />
                <Metric color={homeGlassColors.ringExercise} label={t('healthExercise')} value={rings.exercise} goal={rings.exerciseGoal} unit={t('healthMinutes')} />
                <Metric color={homeGlassColors.ringStand} label={t('healthStand')} value={rings.stand} goal={rings.standGoal} unit={t('healthHours')} />
                <Text style={[theme.type.caption, tabularNums, heroFont('400'), styles.steps, { color: homeGlassColors.textSoft }]}>
                  {t('healthSteps', { count: activity.steps.toLocaleString('vi-VN') })}
                </Text>
              </>
            ) : (
              <>
                <Metric
                  color={homeGlassColors.ringMove}
                  label={t('healthStepsLabel')}
                  value={activity.steps.toLocaleString('vi-VN')}
                  goal={STEP_GOAL.toLocaleString('vi-VN')}
                  unit=""
                />
                <Metric color={homeGlassColors.ringExercise} label={t('healthDistance')} value={activity.distance} goal={5} unit={t('healthKm')} />
                <Metric color={homeGlassColors.ringStand} label={t('healthFlights')} value={activity.flights} goal={10} unit={t('healthFloors')} />
              </>
            )}
          </View>
        </Reveal>
      ) : status === 'needsPermission' ? (
        <Reveal style={styles.prompt}>
          <Text style={[theme.type.caption, heroFont('400'), styles.centered, { color: homeGlassColors.textMuted, lineHeight: 20 }]}>
            {t('healthConnectHint')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={askToConnect}
            style={({ pressed }) => [
              styles.connect,
              { backgroundColor: homeGlassColors.surfaceAction },
              pressed && { opacity: 0.75 },
            ]}
          >
            <NeumorphicSurface radius={999} />
            <Text style={[theme.type.captionSm, heroFont('600'), { color: homeGlassColors.text }]}>
              {t('healthConnect')}
            </Text>
          </Pressable>
        </Reveal>
      ) : status === 'empty' ? (
        <Reveal style={styles.prompt}>
          <Text style={[theme.type.caption, heroFont('600'), styles.centered, { color: homeGlassColors.textSoft }]}>
            {t('healthEmpty')}
          </Text>
          <Text style={[theme.type.captionSm, heroFont('400'), styles.centered, { color: homeGlassColors.textFaint, lineHeight: 18 }]}>
            {t('healthEmptyHint')}
          </Text>
          {/* Asking again is cheap and is usually all it needs: iOS only
              shows the sheet for types it has not already decided. */}
          <Pressable
            accessibilityRole="button"
            onPress={askToConnect}
            style={({ pressed }) => [
              styles.connect,
              { backgroundColor: homeGlassColors.surfaceAction },
              pressed && { opacity: 0.75 },
            ]}
          >
            <NeumorphicSurface radius={999} />
            <Text style={[theme.type.captionSm, heroFont('600'), { color: homeGlassColors.text }]}>
              {t('healthRetry')}
            </Text>
          </Pressable>
        </Reveal>
      ) : (
        <Reveal style={styles.prompt}>
          <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.textFaint }]}>
            {t('loading')}
          </Text>
        </Reveal>
      )}

      {/* No footnote about the missing rings. An iPhone on its own counts
          steps, distance and floors, and that is what the card shows; if an
          Apple Watch ever starts writing activity summaries, `read()` picks
          them up on the next foreground and the three rings appear on their
          own. Nothing to explain and nothing to switch on. */}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop: 2,
    paddingBottom: 2,
  },
  header: {
    flexDirection: 'row',
    // The title block is two lines now; the date keeps its line with the
    // first of them rather than floating to the middle of the pair.
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    marginLeft: 1,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    // Centred as a pair rather than pinned left: with no card behind it, a
    // left-hugging group left a dead half on the right (owner, 2026-10-25).
    justifyContent: 'center',
    gap: 26,
    marginTop: 14,
  },
  metrics: {
    gap: 8,
  },
  metricValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  number: {
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: -0.4,
  },
  steps: {
    marginTop: 3,
  },
  centered: {
    textAlign: 'center',
  },
  prompt: {
    marginTop: 12,
    gap: 12,
    alignItems: 'center',
  },
  connect: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
});
