import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { homeGlassColors, painColor, painScaleColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { smoothPath } from '@/lib/smoothPath';
import { GlassCard } from './GlassCard';
import { Reveal } from './ScrollFade';
import { heroFont } from './glass';

const RANGE_OPTIONS = [7, 14] as const;

// The prototype's plot box, in its own 340x200 viewBox. Width is measured at
// runtime instead — a fixed viewBox scaled to the device would letterbox on a
// narrow phone and stretch the dots on a wide one.
const H = 210;
const AXIS_WIDTH = 34;
const SIDE_PADDING = 24;
const PAD_TOP = 30;
const PAD_BOTTOM = 28;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;
const MAX_SCORE = 10;
const POINT_GAP = 48;

// The line and point rings use exact score colours. The filled region needs
// a softer continuous wash instead: score-by-score stops made its horizontal
// severity bands visible as layers. These broad intermediate hues blend the
// same red → violet → blue palette without hard boundaries.
const AREA_STOPS = [
  { offset: 0, color: '#EF2A5C', opacity: 0.4 },
  { offset: 0.24, color: '#B72A7A', opacity: 0.34 },
  { offset: 0.5, color: '#7032B5', opacity: 0.28 },
  { offset: 0.74, color: '#3A47D8', opacity: 0.2 },
  { offset: 1, color: '#17287D', opacity: 0.08 },
] as const;

export interface GlassPainCardProps {
  /** Logged check-ins, oldest first, with the real programme day they belong
   * to — the label is `day`, so a first log on day 2 reads "N2". */
  data: { day: number; score: number }[];
  /** Design-review only: raises one plotted day to 9 without writing it to
   * the customer's health history. */
  previewHighScore?: boolean;
}

/**
 * Home v3's discomfort chart — the prototype's `PainCard`.
 *
 * Two things the prototype does not have, because it runs on a fixed array:
 * an empty state for somebody who has not logged anything yet, and a window
 * that follows real day numbers rather than counting back from 14.
 */
export function GlassPainCard({ data, previewHighScore = false }: GlassPainCardProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  // See VerticalGradient: ':' is not safe inside a `url(#...)` reference.
  const uid = useId().replace(/\W/g, '');
  const areaGradientId = `painArea${uid}`;
  const lineGradientId = `painLine${uid}`;
  const [range, setRange] = useState<number>(7);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });
  const [width, setWidth] = useState(320);
  const scrollRef = useRef<ScrollView>(null);

  const windowSize = Math.min(range, data.length);
  const windowed = data.slice(data.length - windowSize);
  const isEmpty = windowed.length === 0;
  const scrollable = windowed.length > 7;
  const plotted = useMemo(() => {
    if (!previewHighScore || windowed.length === 0 || windowed.some((entry) => entry.score >= 8)) return windowed;
    const dayEleven = windowed.findIndex((entry) => entry.day === 11);
    const target = dayEleven >= 0 ? dayEleven : Math.floor(windowed.length / 2);
    return windowed.map((entry, index) => (index === target ? { ...entry, score: 9 } : entry));
  }, [previewHighScore, windowed]);

  // Preserve the old 14-day interaction: points stay 48pt apart and the
  // viewport scrolls horizontally instead of squeezing two weeks into the
  // width of the phone. Seven days retain the current centred layout.
  const viewportWidth = Math.max(40, width - AXIS_WIDTH);
  const contentWidth = scrollable
    ? SIDE_PADDING * 2 + POINT_GAP * (plotted.length - 1)
    : viewportWidth;
  const plotW = Math.max(40, contentWidth - SIDE_PADDING * 2);
  const points = useMemo<[number, number][]>(
    () =>
      plotted.map((entry, index) => [
        scrollable
          ? SIDE_PADDING + index * POINT_GAP
          : SIDE_PADDING + (plotW * (index + 0.5)) / plotted.length,
        PAD_TOP + PLOT_H * (1 - entry.score / MAX_SCORE),
      ]),
    [plotted, plotW, scrollable],
  );

  const linePath = smoothPath(points);
  const baseline = PAD_TOP + PLOT_H;
  const areaPath =
    points.length >= 2
      ? `${linePath} L ${points[points.length - 1][0]} ${baseline} L ${points[0][0]} ${baseline} Z`
      : '';

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollable) scrollRef.current?.scrollToEnd({ animated: false });
      else scrollRef.current?.scrollTo({ x: 0, animated: false });
    });
  }, [contentWidth, range, scrollable, windowed.length]);

  return (
    <>
      <GlassCard style={styles.card}>
      {/* The legend, the plot and the empty state each come and go on their
          own — see ScrollFade. A card is too tall to be one unit at the
          header's edge. */}
      <Reveal style={styles.header}>
        <View style={styles.bands}>
          <Text numberOfLines={1} style={[theme.type.captionSm, styles.bandLabel, heroFont('500'), { color: painScaleColors.low }]}>{t('mild')}</Text>
          <Text style={[theme.type.captionSm, heroFont('500'), { color: homeGlassColors.textFaint }]}>•</Text>
          <Text numberOfLines={1} style={[theme.type.captionSm, styles.bandLabel, heroFont('500'), { color: painScaleColors.mid }]}>{t('moderate')}</Text>
          <Text style={[theme.type.captionSm, heroFont('500'), { color: homeGlassColors.textFaint }]}>•</Text>
          <Text numberOfLines={1} style={[theme.type.captionSm, styles.bandLabel, heroFont('500'), { color: painScaleColors.high }]}>{t('severe')}</Text>
        </View>
        {!isEmpty ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: menuOpen }}
            accessibilityLabel={`${range} ${t('daysUnit')}`}
            hitSlop={8}
            onPress={(event) => {
              if (menuOpen) {
                setMenuOpen(false);
                return;
              }
              setMenuAnchor({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
              setMenuOpen(true);
            }}
            style={styles.rangeBtn}
          >
            <Text style={[theme.type.captionSm, heroFont('500'), { color: homeGlassColors.text }]}>
              {range} {t('daysUnit')}
            </Text>
            <Icon name="chevron-down" size={14} color={homeGlassColors.link} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </Reveal>

      {isEmpty ? (
        <Reveal style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: homeGlassColors.surfaceInset }]}>
            <Icon name="activity" size={20} color={homeGlassColors.accent} strokeWidth={2} />
          </View>
          <Text style={[theme.type.bodyStrong, heroFont('600'), styles.centered, { color: homeGlassColors.text }]}>
            {t('startTrackingToday')}
          </Text>
          <Text style={[theme.type.caption, heroFont('400'), styles.centered, { color: homeGlassColors.textMuted, lineHeight: 19 }]}>
            {t('startTrackingHint')}
          </Text>
        </Reveal>
      ) : (
        <View
          style={styles.plot}
          onLayout={(event) => {
            const next = Math.floor(event.nativeEvent.layout.width);
            if (next > 0 && next !== width) setWidth(next);
          }}
        >
          <Reveal style={[styles.fixedAxis, { width: AXIS_WIDTH, height: baseline + 8 }]} arrive={false}>
            <Svg width={AXIS_WIDTH} height={baseline + 8}>
              {[0, 2, 4, 6, 8, 10].map((score) => {
                const y = PAD_TOP + PLOT_H * (1 - score / MAX_SCORE);
                return (
                  <SvgText
                    key={score}
                    x={AXIS_WIDTH - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize={11.5}
                    fill={homeGlassColors.textSoft}
                  >
                    {score}
                  </SvgText>
                );
              })}
              <Line
                x1={AXIS_WIDTH - 1}
                x2={AXIS_WIDTH - 1}
                y1={PAD_TOP}
                y2={baseline}
                stroke={homeGlassColors.axis}
              />
            </Svg>
          </Reveal>

          <View style={styles.plotViewport}>
            <View pointerEvents="none" style={styles.fixedGrid}>
              <Svg width={viewportWidth} height={baseline + 8}>
                {[0, 2, 4, 6, 8, 10].map((score) => {
                  const y = PAD_TOP + PLOT_H * (1 - score / MAX_SCORE);
                  return (
                    <Line
                      key={score}
                      x1={0}
                      x2={viewportWidth}
                      y1={y}
                      y2={y}
                      stroke={homeGlassColors.gridLine}
                      strokeDasharray="3 4"
                    />
                  );
                })}
                <Line x1={0} x2={viewportWidth} y1={baseline} y2={baseline} stroke={homeGlassColors.axis} />
              </Svg>
            </View>

            <ScrollView
              ref={scrollRef}
              horizontal
              scrollEnabled={scrollable}
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              onContentSizeChange={() => {
                if (scrollable) scrollRef.current?.scrollToEnd({ animated: false });
              }}
            >
              <View style={{ width: contentWidth }}>
                <Reveal rasterize>
                  <Svg width={contentWidth} height={baseline + 2}>
                    <Defs>
                      <LinearGradient
                        id={lineGradientId}
                        x1="0"
                        y1={PAD_TOP}
                        x2="0"
                        y2={baseline}
                        gradientUnits="userSpaceOnUse"
                      >
                        {Array.from({ length: 11 }, (_, index) => 10 - index).map((score) => (
                          <Stop key={score} offset={(10 - score) / 10} stopColor={painColor(score)} />
                        ))}
                      </LinearGradient>
                      <LinearGradient
                        id={areaGradientId}
                        x1="0"
                        y1={PAD_TOP}
                        x2="0"
                        y2={baseline}
                        gradientUnits="userSpaceOnUse"
                      >
                        {AREA_STOPS.map((stop) => (
                          <Stop
                            key={stop.offset}
                            offset={stop.offset}
                            stopColor={stop.color}
                            stopOpacity={stop.opacity}
                          />
                        ))}
                      </LinearGradient>
                    </Defs>

                    {points.map(([x], index) => (
                      <Line
                        key={index}
                        x1={x}
                        x2={x}
                        y1={PAD_TOP}
                        y2={baseline}
                        stroke={homeGlassColors.gridLineFaint}
                        strokeDasharray="3 4"
                      />
                    ))}

                    {/* A lone reading has no curve to draw; the dropline is
                        what ties it to its day. */}
                    {points.length === 1 ? (
                      <Line
                        x1={points[0][0]}
                        x2={points[0][0]}
                        y1={points[0][1] + 10}
                        y2={baseline}
                        stroke={painColor(plotted[0].score)}
                        strokeWidth={1.5}
                        strokeDasharray="4 5"
                        strokeLinecap="round"
                      />
                    ) : null}

                    {areaPath ? <Path d={areaPath} fill={`url(#${areaGradientId})`} /> : null}
                    {linePath ? (
                      <Path
                        d={linePath}
                        fill="none"
                        stroke={`url(#${lineGradientId})`}
                        strokeWidth={2.8}
                        strokeLinecap="round"
                      />
                    ) : null}

                    {points.map(([x, y], index) => (
                      <React.Fragment key={index}>
                        <Circle
                          cx={x}
                          cy={y}
                          r={5.5}
                          fill={homeGlassColors.scrim}
                          stroke={painColor(plotted[index].score)}
                          strokeWidth={2.5}
                        />
                        <SvgText
                          x={x}
                          y={y - 12}
                          textAnchor="middle"
                          fontSize={14}
                          fontWeight="700"
                          fill={homeGlassColors.text}
                        >
                          {plotted[index].score}
                        </SvgText>
                      </React.Fragment>
                    ))}
                  </Svg>
                </Reveal>
                <Reveal style={styles.axisLabels} arrive={false}>
                  {points.map(([x], index) => (
                    <Text
                      key={plotted[index].day}
                      style={[
                        styles.axisLabel,
                        heroFont('400'),
                        { left: x - 22, color: homeGlassColors.textSoft },
                      ]}
                    >
                      {`${t('dayAbbrev')}${plotted[index].day}`}
                    </Text>
                  ))}
                </Reveal>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      </GlassCard>

      {/* A modal owns the whole screen, so a tap anywhere outside the menu
          closes it instead of being limited to the chart card's bounds. */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11yCloseList')}
          style={styles.menuBackdrop}
          onPress={() => setMenuOpen(false)}
        >
          <Pressable
            onPress={() => undefined}
            style={[
              styles.menu,
              {
                top: menuAnchor.y + 14,
                left: Math.max(12, Math.min(menuAnchor.x - 72, windowWidth - 116)),
                backgroundColor: homeGlassColors.menu,
                borderColor: homeGlassColors.hairline,
              },
            ]}
          >
            {RANGE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: option === range }}
                onPress={() => {
                  setRange(option);
                  setMenuOpen(false);
                }}
                style={[
                  styles.menuItem,
                  option === range ? { backgroundColor: homeGlassColors.surfaceNavActive } : null,
                ]}
              >
                <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.text }]}>
                  {option} {t('daysUnit')}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 0,
    paddingTop: 2,
    paddingBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  // `flexShrink` defaults to 0 in React Native, so these five labels would
  // not give way — at 320pt (and at 375pt in en/ms) they ran straight over
  // the 7/14-day button beside them (QA pass, 2026-10-30).
  bands: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bandLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
  rangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  plot: {
    marginTop: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fixedAxis: {
    flexShrink: 0,
    zIndex: 2,
  },
  plotViewport: {
    flex: 1,
    overflow: 'hidden',
  },
  fixedGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  axisLabels: {
    position: 'relative',
    height: PAD_BOTTOM - 2,
  },
  axisLabel: {
    position: 'absolute',
    top: 3,
    width: 44,
    textAlign: 'center',
    fontSize: 11.5,
    lineHeight: 16,
  },
  menu: {
    position: 'absolute',
    width: 104,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuBackdrop: {
    flex: 1,
  },
  menuItem: {
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: 7,
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  centered: {
    textAlign: 'center',
  },
});
