import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { homeGlassColors, useTheme } from '@/theme';
import { GlassCard } from './GlassCard';
import { Reveal } from './ScrollFade';
import { useI18n } from '@/lib/i18n';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useAppStore } from '@/store/useAppStore';
import { scheduleWaterReminders } from '@/lib/pushNotifications';
import { useWaterArrived } from './waterArrival';
import { hapticSelect } from '@/lib/haptics';
import { GLASS_CARD_PADDING, heroFont, tabularNums } from './glass';
import { WaterGlassFace } from './WaterGlassFace';

/** The header drop keeps its original shape and scale. */
const DROP = 'M100,40 C100,40 89,53.5 89,61 A11,11 0 0,0 111,61 C111,53.5 100,40 100,40 Z';

export interface WaterDialProps {
  cups: number;
  goal: number;
  onSet: (cups: number) => void;
}

function DropMark({ size, color, filled }: { size: number; color: string; filled?: boolean }) {
  return (
    <Svg width={size} height={(size * 36) / 26} viewBox="87 38 26 36">
      <Path
        d={DROP}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : 2.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * The two knobs. Their ring is a dashed circle, not a border: the reference
 * breaks it at the four diagonals, which is what stops a plain circle from
 * reading as a flat outline.
 */
function Knob({
  size,
  tone,
  disabled,
  label,
  onPress,
}: {
  size: number;
  tone: 'minus' | 'plus';
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const stroke = 2;
  const r = (size - stroke) / 2 - 1;
  const circumference = Math.PI * 2 * r;
  const gap = circumference * 0.055;
  const dash = circumference / 4 - gap;
  const glyph = size * 0.3;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        { width: size, height: size },
        styles.knob,
        { opacity: disabled ? 0.32 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={`knobFace${tone}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop
              offset="0"
              stopColor={tone === 'plus' ? homeGlassColors.dialBlueLight : '#20262C'}
            />
            <Stop
              offset="1"
              stopColor={tone === 'plus' ? homeGlassColors.dialBlueDeep : '#0A0D11'}
            />
          </LinearGradient>
          {/* Brushed metal: light at the top-left, shadow at the bottom-right,
              with a second highlight three-quarters round so the ring looks
              turned rather than painted. */}
          <LinearGradient id={`knobRing${tone}`} x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={homeGlassColors.dialMetalHi} />
            <Stop offset="0.3" stopColor={homeGlassColors.dialMetalMid} />
            <Stop offset="0.55" stopColor={homeGlassColors.dialMetalLo} />
            <Stop offset="0.8" stopColor={homeGlassColors.dialMetalMid} />
            <Stop offset="1" stopColor={homeGlassColors.dialMetalLo} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r - 1} fill={`url(#knobFace${tone})`} />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#knobRing${tone})`}
            strokeWidth={stroke}
            strokeDasharray={[dash, gap]}
            strokeDashoffset={dash / 2}
          />
        </G>
      </Svg>
      <View style={styles.knobGlyph} pointerEvents="none">
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <Line x1="4" y1="12" x2="20" y2="12" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
          {tone === 'plus' ? (
            <Line x1="12" y1="4" x2="12" y2="20" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
          ) : null}
        </Svg>
      </View>
    </Pressable>
  );
}

export function WaterDial({ cups, goal, onSet }: WaterDialProps) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const remindersOn = useAppStore((state) => state.waterRemindersOn);
  const setRemindersOn = useAppStore((state) => state.setWaterRemindersOn);
  // Shown only after a refusal: iOS asks once, and a switch that springs
  // back with no explanation reads as a bug.
  const [permissionRefused, setPermissionRefused] = useState(false);
  const reduceMotion = useReduceMotion();
  // Read here rather than passed in: the parent would have to hold it in
  // state, and that state changes mid-scroll. See waterArrival.ts.
  const active = useWaterArrived();
  const { width: windowWidth } = useWindowDimensions();

  // Shown locally the moment you press, then reconciled: `onSet` goes through
  // a mutation and the query cache before it comes back as a new `cups`, and
  // waiting for that round trip is what made the buttons feel slow.
  const [shown, setShown] = useState(cups);
  useEffect(() => {
    setShown(cups);
  }, [cups]);

  const knob = 52;
  const panelInner = windowWidth - 28 - GLASS_CARD_PADDING * 2;
  const size = Math.max(130, Math.min(176, panelInner - knob * 2 - 44));

  const target = goal > 0 ? Math.max(0, Math.min(1, shown / goal)) : 0;
  const turn = useSharedValue(0);

  useEffect(() => {
    // Held at zero until the section is on screen. The existing spring now
    // raises the water surface instead of sweeping a needle.
    if (!active) return;
    if (reduceMotion) {
      turn.value = target;
      return;
    }
    // Keep the original timing and motion profile.
    turn.value = withSpring(target, { damping: 17, stiffness: 140, mass: 0.9 });
  }, [active, reduceMotion, target, turn]);

  const full = shown >= goal;
  const remaining = Math.max(0, goal - shown);

  const step = (next: number) => {
    const clamped = Math.max(0, Math.min(goal, next));
    if (clamped === shown) return;
    // After the guard above, so `−` on an empty glass and `+` on a full one
    // stay silent.
    hapticSelect();
    setShown(clamped);
    onSet(clamped);
  };

  return (
    <GlassCard style={styles.panel}>
      {/* Four rows, four reveals: the title, the glass, the sentence under it
          and the rule — they arrive in that order and leave in it too. */}
      <Reveal style={styles.header}>
        <View style={styles.title}>
          <DropMark size={17} color={homeGlassColors.dialBlue} filled />
          <Text style={[styles.titleText, heroFont('700'), { color: homeGlassColors.text }]}>
            {t('water')}
          </Text>
        </View>
        <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.textFaint }]}>
          {t('goalCups', { count: goal })}
        </Text>
      </Reveal>

      <Reveal style={styles.row}>
        <Knob
          size={knob}
          tone="minus"
          disabled={shown <= 0}
          label={t('water')}
          onPress={() => step(shown - 1)}
        />

        <WaterGlassFace
          size={size}
          cups={shown}
          goal={goal}
          unit={t('cupsUnit')}
          progress={turn}
        />

        <Knob
          size={knob}
          tone="plus"
          disabled={full}
          label={t('water')}
          onPress={() => step(shown + 1)}
        />
      </Reveal>

      <Reveal>
      <Text
        style={[
          theme.type.caption,
          tabularNums,
          heroFont('400'),
          styles.status,
          { color: homeGlassColors.textMuted },
        ]}
      >
        {full ? t('waterGoalReached') : t('waterRemaining', { count: remaining })}
      </Text>
      </Reveal>

      <Reveal style={styles.remind}>
        <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.textMuted }]}>
          {t('waterRemind')}
        </Text>
        <Switch
          value={remindersOn}
          onValueChange={(next) => {
            // Optimistic, then corrected by what the OS actually allows.
            setRemindersOn(next);
            setPermissionRefused(false);
            void scheduleWaterReminders(next, language).then((on) => {
              setRemindersOn(on);
              if (next && !on) setPermissionRefused(true);
            });
          }}
          trackColor={{ false: homeGlassColors.ringTrack, true: homeGlassColors.dialBlue }}
          thumbColor={homeGlassColors.text}
          ios_backgroundColor={homeGlassColors.ringTrack}
        />
      </Reveal>

      {permissionRefused ? (
        <Reveal>
          <Text style={[theme.type.captionSm, heroFont('400'), styles.refused, { color: homeGlassColors.textFaint }]}>
            {t('waterRemindOff')}
          </Text>
        </Reveal>
      ) : null}

      {/* A hairline, nothing written on it: the "HÔM NAY" caption read as a
          label for the section below rather than a divider (owner,
          2026-10-25). */}
      <Reveal style={styles.footer}>
        <View style={[styles.rule, { backgroundColor: homeGlassColors.hairline }]} />
      </Reveal>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: 0,
    paddingTop: 2,
    paddingBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  knob: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobGlyph: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    marginTop: 12,
    textAlign: 'center',
  },
  remind: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 2,
  },
  refused: {
    marginTop: 6,
    lineHeight: 17,
  },
  footer: {
    marginTop: 16,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});
