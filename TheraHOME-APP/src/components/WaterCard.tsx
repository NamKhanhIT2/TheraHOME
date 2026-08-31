import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

export interface WaterCardProps {
  value: number;
  goal: number;
  onChange: (v: number) => void;
}

const MAX_CUPS = 12;
const RING_SIZE = 110;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Mirrors `WaterCard` — RN has no `conic-gradient`, so the progress ring is
 * approximated with a plain tinted ring background (no partial-arc fill);
 * the count itself remains the primary readout. */
export function WaterCard({ value, goal, onChange }: WaterCardProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const progress = useRef(new Animated.Value(Math.min(value / goal, 1))).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progress, {
        toValue: Math.min(value / goal, 1),
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 120, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      ]),
    ]).start();
  }, [goal, progress, pulse, value]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });
  return (
    <View
      style={[
        styles.card,
        theme.shadows.card,
        { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.cardPadding + 4 },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name="droplet" size={20} color={theme.colors.primary} />
          <Text style={[theme.type.h2, { color: theme.colors.textPrimary }]}>{t('water')}</Text>
        </View>
        <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{t('goalCups', { count: goal })}</Text>
      </View>
      <View style={styles.controlsRow}>
        <Pressable
          onPress={() => onChange(Math.max(0, value - 1))}
          style={[styles.roundBtn, { backgroundColor: theme.colors.bgCardAlt }]}
        >
          <Icon name="minus" size={20} color={theme.colors.textSecondary} />
        </Pressable>
        <Animated.View style={[styles.ring, { transform: [{ scale: pulse }] }]}> 
          <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={theme.colors.primaryTint10}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={theme.colors.primary}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={dashOffset}
              fill="none"
              rotation={-90}
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>
          <View
            style={[
              styles.ringInner,
              {
                backgroundColor: theme.colors.bgCard,
              },
            ]}
          >
            <Icon name="droplet" size={16} color={theme.colors.primary} />
            <Text style={[theme.type.display, { fontSize: 24, color: theme.colors.textPrimary }]}>{value}</Text>
            <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>/{goal} {t('cupsUnit')}</Text>
          </View>
        </Animated.View>
        <Pressable
          onPress={() => onChange(Math.min(MAX_CUPS, value + 1))}
          disabled={value >= MAX_CUPS}
          style={[styles.roundBtn, { backgroundColor: theme.colors.primary, opacity: value >= MAX_CUPS ? 0.4 : 1 }]}
        >
          <Icon name="plus" size={20} color="#fff" />
        </Pressable>
      </View>
      <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, textAlign: 'center', fontStyle: 'italic' }]}>
        * {t('waterTip')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
    marginVertical: 22,
  },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
