import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Circle, Text as SvgText, Stop } from 'react-native-svg';
import Reanimated, { Easing as REasing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { painColor, painScaleColors } from '@/theme/colors';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const AnimatedSvgText = Reanimated.createAnimatedComponent(SvgText);

/** One data point's dot + value label — a separate component (not inline in
 * a `.map()`) because each needs its own `useSharedValue`, and the number of
 * points varies between renders (7 vs 14-day range, new logs arriving).
 * Tweens to its new x/y when the same range's data shifts (a new log
 * arrives, the rolling window moves) instead of snapping; `skipAnimation`
 * is set on the render where `range` itself just changed, since the
 * existing curtain-reveal already owns that transition. */
function AnimatedChartPoint({ x, y, value, skipAnimation }: { x: number; y: number; value: number; skipAnimation: boolean }) {
  const cx = useSharedValue(x);
  const cy = useSharedValue(y);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current || skipAnimation) {
      cx.value = x;
      cy.value = y;
      mounted.current = true;
      return;
    }
    cx.value = withTiming(x, { duration: 500, easing: REasing.out(REasing.cubic) });
    cy.value = withTiming(y, { duration: 500, easing: REasing.out(REasing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, skipAnimation]);

  const circleProps = useAnimatedProps(() => ({ cx: cx.value, cy: cy.value }));
  const textProps = useAnimatedProps(() => ({ x: cx.value, y: cy.value - 12 }));

  return (
    <>
      <AnimatedCircle animatedProps={circleProps} r={5} fill="#fff" stroke={painColor(value)} strokeWidth={3} />
      <AnimatedSvgText animatedProps={textProps} textAnchor="middle" fontSize={11} fontWeight="700" fill={painColor(value)}>
        {value}
      </AnimatedSvgText>
    </>
  );
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export interface PainChartProps {
  data: number[];
}

const RANGE_OPTIONS = [7, 14] as const;

export function PainChart({ data }: PainChartProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [range, setRange] = useState<number>(7);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [chartWidth, setChartWidth] = useState(300);
  const revealAnim = useRef(new Animated.Value(0)).current;
  const lastRangeRef = useRef(range);
  const rangeJustChanged = lastRangeRef.current !== range;
  lastRangeRef.current = range;

  const total = data.length;
  const windowSize = Math.min(range, total);
  const start = total - windowSize;
  const windowData = data.slice(start);
  const isEmpty = windowData.length === 0;
  const labels = windowData.map((_, i) => `N${start + i + 1}`);
  const scrollable = windowSize > 7;

  const H = 130;
  const pad = 8;
  const max = 10;
  const W = scrollable ? pad * 2 + 48 * (windowData.length - 1) : chartWidth;
  const step = scrollable ? 48 : (W - pad * 2) / Math.max(windowData.length - 1, 1);

  const pts = useMemo<[number, number][]>(
    () =>
      windowData.map((v, i) => [
        windowData.length === 1 ? W / 2 : pad + i * step,
        pad + (1 - v / max) * (H - pad * 2),
      ]),
    [windowData, step, W],
  );
  const linePath = smoothPath(pts);
  const areaPath =
    pts.length >= 2
      ? `${linePath} L ${pts[pts.length - 1][0]} ${H - pad} L ${pts[0][0]} ${H - pad} Z`
      : '';

  React.useEffect(() => {
    if (scrollable && scrollRef.current) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    }
  }, [windowData.length, W, range, scrollable]);

  // Left-to-right reveal on mount and on every 7/14-day toggle — a curtain
  // mask (not a width-clip) so it works the same whether the chart is
  // scrolled to the end already (14-day view) or not (7-day view).
  React.useEffect(() => {
    revealAnim.setValue(0);
    const anim = Animated.timing(revealAnim, {
      toValue: 1,
      duration: 900,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [range]);

  const chart = (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="painVGrad" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={painScaleColors.high} />
          <Stop offset="50%" stopColor={painScaleColors.mid} />
          <Stop offset="100%" stopColor={painScaleColors.low} />
        </LinearGradient>
        <LinearGradient id="painAreaGrad" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={painScaleColors.high} stopOpacity={0.22} />
          <Stop offset="50%" stopColor={painScaleColors.mid} stopOpacity={0.16} />
          <Stop offset="100%" stopColor={painScaleColors.low} stopOpacity={0.12} />
        </LinearGradient>
      </Defs>
      {[0, 2, 4, 6, 8, 10].map((g) => {
        const y = pad + (1 - g / max) * (H - pad * 2);
        return (
          <Line
            key={g}
            x1={pad}
            x2={W - pad}
            y1={y}
            y2={y}
            stroke={theme.colors.borderLight}
            strokeWidth={1}
            strokeDasharray="3,3"
          />
        );
      })}
      {areaPath ? <Path d={areaPath} fill="url(#painAreaGrad)" stroke="none" /> : null}
      {linePath ? (
        <Path d={linePath} fill="none" stroke="url(#painVGrad)" strokeWidth={3} strokeLinecap="round" />
      ) : null}
      {pts.map((p, i) => (
        <AnimatedChartPoint key={i} x={p[0]} y={p[1]} value={windowData[i]} skipAnimation={rangeJustChanged} />
      ))}
    </Svg>
  );

  const axisLabels = (
    <View style={[styles.axisRow, { width: W }]}> 
      {labels.map((l, i) => (
        <Text
          key={i}
          style={[
            theme.type.captionSm,
            {
              color: theme.colors.textMuted,
              position: 'absolute',
              left: pts[i][0] - 22,
              width: 44,
              textAlign: 'center',
            },
          ]}
        >
          {l}
        </Text>
      ))}
    </View>
  );

  return (
    <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.space[5] }]}> 
      <View style={styles.headerRow}>
        <Text style={[theme.type.h2, { color: theme.colors.textPrimary }]}>{t('healthChart')}</Text>
        {!isEmpty ? <View>
          <Pressable onPress={() => setMenuOpen((o) => !o)} style={styles.rangeBtn}>
            <Text style={[theme.type.caption, { fontFamily: theme.fontFamily.semiBold, color: theme.colors.primary }]}>
              {range} {t('daysUnit')}
            </Text>
            <Icon name="chevron-down" size={14} color={theme.colors.primary} />
          </Pressable>
          {menuOpen ? (
            <View
              style={[
                styles.menu,
                theme.shadows.card,
                { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md },
              ]}
            >
              {RANGE_OPTIONS.map((o) => (
                <Pressable
                  key={o}
                  onPress={() => {
                    setRange(o);
                    setMenuOpen(false);
                  }}
                  style={[styles.menuItem, { backgroundColor: o === range ? theme.colors.bgCardAlt : 'transparent' }]}
                >
                  <Text style={[theme.type.caption, { color: theme.colors.textPrimary }]}>{o} {t('daysUnit')}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View> : <View style={[styles.previewPill, { backgroundColor: theme.colors.primaryTint10 }]}>
          <Icon name="sparkles" size={13} color={theme.colors.primary} />
          <Text style={[theme.type.captionSm, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>{t('chartPreview')}</Text>
        </View>}
      </View>
      {!isEmpty ? <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginBottom: 10 }]}> 
        {t('scoreScale')} · {windowSize} {t('daysUnit')}{scrollable ? ` · ${t('swipeChart')}` : ''}
      </Text> : null}
      <View
        style={styles.chartViewport}
        onLayout={(event) => {
          const width = Math.floor(event.nativeEvent.layout.width);
          if (width > 0 && width !== chartWidth) setChartWidth(width);
        }}
      >
      {isEmpty ? (
        <View style={[styles.emptyState, { backgroundColor: theme.colors.primaryTint05, borderColor: theme.colors.primaryTint10 }]}> 
          <View style={styles.emptyGraph}>
            <Svg width="100%" height={88} viewBox="0 0 300 88" preserveAspectRatio="none">
              {[18, 42, 66].map((y) => <Line key={y} x1={4} x2={296} y1={y} y2={y} stroke={theme.colors.borderLight} strokeWidth={1} strokeDasharray="4,5" />)}
              <Path d="M 10 64 C 54 62, 62 48, 101 51 S 157 35, 192 42 S 244 21, 290 25" fill="none" stroke={theme.colors.primary} strokeWidth={3} strokeLinecap="round" strokeDasharray="7,6" opacity={0.62} />
              {[10, 101, 192, 290].map((x, index) => <Circle key={x} cx={x} cy={[64, 51, 42, 25][index]} r={4} fill="#fff" stroke={theme.colors.primary} strokeWidth={2} />)}
            </Svg>
          </View>
          <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primary }]}>
            <Icon name="activity" size={21} color="#fff" />
          </View>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{t('startTrackingToday')}</Text>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 19 }]}>{t('startTrackingHint')}</Text>
        </View>
      ) : scrollable ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View style={{ width: W }}>
            {chart}
            {axisLabels}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.revealMask,
                {
                  left: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0, W] }),
                  backgroundColor: theme.colors.bgCard,
                },
              ]}
            />
          </View>
        </ScrollView>
      ) : (
        <View style={{ width: W }}>
          {chart}
          {axisLabels}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.revealMask,
              {
                left: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0, W] }),
                backgroundColor: theme.colors.bgCard,
              },
            ]}
          />
        </View>
      )}
      </View>
      {!isEmpty ? <View style={[styles.legendRow, { borderTopColor: theme.colors.divider }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: painScaleColors.low }]} />
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{t('mild')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: painScaleColors.mid }]} />
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{t('moderate')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: painScaleColors.high }]} />
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{t('severe')}</Text>
        </View>
      </View> : null}
      {!isEmpty ? <Text style={[theme.type.bodyStrong, { color: theme.colors.primary, marginTop: 12 }]}>{t('doingGreat')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  chartViewport: {
    width: '100%',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    overflow: 'hidden',
    minWidth: 96,
    zIndex: 40,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  axisRow: {
    marginTop: -4,
    height: 16,
    position: 'relative',
  },
  revealMask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
  },
  emptyState: {
    minHeight: 214,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  emptyGraph: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 34,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
