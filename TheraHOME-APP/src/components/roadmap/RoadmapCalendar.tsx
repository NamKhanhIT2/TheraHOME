import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { heroFont } from '@/components/home/glass';
import { useI18n } from '@/lib/i18n';
import type { DayRow } from '@/hooks/usePrograms';

/** Monday-first, as every Vietnamese calendar is. */
const WEEKDAY_KEYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/**
 * The grid is always exactly five rows TALL, whatever month is showing.
 *
 * Letting the row count follow the month meant a six-row month — November
 * 2026 is one — grew the card by a whole row and pushed "Bắt đầu buổi chăm
 * sóc" off the bottom of the screen (owner, 2026-11-01). Rendering only
 * five rows of DATES would have been the other way to keep the height, but
 * it hides real days: in November 2026 the sixth row is where the 1st and
 * the 30th live. So a six-row month keeps all six and compresses them into
 * the height of five, and a four-row month is padded out with a dimmed
 * trailing week. The card's height never changes, and nothing is lost.
 */
const GRID_ROWS = 5;
const ROW_HEIGHT = 52;
/** Reserved under each date for the tick / ring / dot. */
const MARKER_HEIGHT = 14;
const MAX_CIRCLE = 32;

function startOfDay(value: Date): Date {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(value: Date, days: number): Date {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Monday = 0 … Sunday = 6. `getDay()` puts Sunday first. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export interface RoadmapCalendarProps {
  days: DayRow[];
  /** When the programme was activated — day 1 falls on this date. */
  activatedAt: string | null | undefined;
  /** Days actually done, and the total the roadmap reaches. */
  doneCount: number;
  totalDays: number;
  onSelectDay: (day: DayRow) => void;
}

/**
 * The roadmap as a month, not as a list (owner's reference, 2026-10-27).
 *
 * A programme day's date is derived, never stored: day 1 is the activation
 * date and day N is N-1 days after it — the same arithmetic
 * `useProgramDays` already does in reverse to decide which day is today
 * (`daysSinceLocal(activatedAt) + 1`). Changing one without the other would
 * put the tick on the wrong square.
 */
export function RoadmapCalendar({ days, activatedAt, doneCount, totalDays, onSelectDay }: RoadmapCalendarProps) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  /** date-key → the programme day that falls on it. */
  const dayByDate = useMemo(() => {
    const map = new Map<string, DayRow>();
    if (!activatedAt) return map;
    const first = startOfDay(new Date(activatedAt));
    for (const day of days) {
      const date = addDays(first, day.id - 1);
      map.set(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`, day);
    }
    return map;
  }, [days, activatedAt]);

  const { cells, rowHeight, circleSize } = useMemo(() => {
    const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = mondayIndex(firstOfMonth);
    const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    // The neighbouring months' dates fill the ends of the first and last
    // rows, dimmed — the reference keeps them, and a half-empty row reads
    // as a mistake.
    const rows = Math.max(Math.ceil((lead + length) / 7), GRID_ROWS);
    const gridStart = addDays(firstOfMonth, -lead);
    const height = (ROW_HEIGHT * GRID_ROWS) / rows;
    return {
      cells: Array.from({ length: rows * 7 }, (_, index) => addDays(gridStart, index)),
      rowHeight: height,
      circleSize: Math.min(MAX_CIRCLE, Math.floor(height - MARKER_HEIGHT)),
    };
  }, [month]);

  // Vietnamese numbers its months, English and Malay name them. Passing the
  // NUMBER into both strings printed "10 2026" for en/ms (QA pass,
  // 2026-10-30).
  const monthLabel =
    language === 'vi'
      ? t('monthOf', { month: month.getMonth() + 1, year: month.getFullYear() })
      : t('monthOf', {
          month: month.toLocaleDateString(language === 'ms' ? 'ms-MY' : 'en-US', { month: 'long' }),
          year: month.getFullYear(),
        });

  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const progress = totalDays > 0 ? Math.min(1, doneCount / totalDays) : 0;

  return (
    <View style={[styles.card, { backgroundColor: homeGlassColors.surface, borderColor: homeGlassColors.hairline }]}>
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          style={({ pressed }) => [styles.monthArrow, pressed ? { opacity: 0.55 } : null]}
        >
          <Icon name="chevron-left" size={20} color={homeGlassColors.textMuted} strokeWidth={2.2} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.monthLabel, styles.monthShrink, heroFont('700'), { color: homeGlassColors.text }]}>
          {monthLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          style={({ pressed }) => [styles.monthArrow, pressed ? { opacity: 0.55 } : null]}
        >
          <Icon name="chevron-right" size={20} color={homeGlassColors.textMuted} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.monthSpacer} />
        {/* Hidden while it would do nothing — a button that cannot change
            anything is noise. */}
        {isCurrentMonth ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
            style={({ pressed }) => [styles.todayPill, { borderColor: homeGlassColors.tick }, pressed ? { opacity: 0.6 } : null]}
          >
            <Text style={[theme.type.captionSm, { color: homeGlassColors.tick }]}>{t('today')}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_KEYS.map((label) => (
          <Text key={label} style={[theme.type.captionSm, styles.weekday, { color: homeGlassColors.textFaint }]}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date) => {
          const inMonth = date.getMonth() === month.getMonth();
          const day = dayByDate.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
          const isToday = sameDay(date, today);
          const done = day?.status === 'done';
          // A day that came and went without being done is NOT the same as
          // one that has not arrived yet, and the calendar was drawing both
          // as the same faint dot — so the thing a person most needs to see
          // on this screen had no mark at all (owner, 2026-10-28).
          const missed = !!day && !done && !isToday && date < today;
          const upcoming = !!day && !done && !isToday && !missed;

          return (
            <Pressable
              key={date.toISOString()}
              disabled={!day}
              accessibilityRole={day ? 'button' : undefined}
              accessibilityLabel={day ? `${t('day')} ${day.id}` : undefined}
              onPress={() => day && onSelectDay(day)}
              style={({ pressed }) => [styles.cell, { height: rowHeight }, pressed && day ? { opacity: 0.6 } : null]}
            >
              <View
                style={[
                  styles.cellNumber,
                  { width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
                  isToday ? { backgroundColor: homeGlassColors.focus } : null,
                ]}
              >
                <Text
                  style={[
                    styles.cellText,
                    heroFont(isToday ? '700' : '400'),
                    {
                      color: isToday
                        ? '#FFFFFF'
                        : inMonth
                          ? homeGlassColors.text
                          : homeGlassColors.textFaint,
                    },
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
              <View style={styles.marker}>
                {done ? (
                  <View style={[styles.cellTick, { backgroundColor: homeGlassColors.tick }]}>
                    <Icon name="check" size={9} color="#FFFFFF" strokeWidth={4} />
                  </View>
                ) : missed ? (
                  // A ring, not a disc: the day is outlined and empty, which
                  // is what it is.
                  <View style={[styles.cellRing, { borderColor: homeGlassColors.dotMissed }]} />
                ) : upcoming ? (
                  <View style={[styles.cellDot, { backgroundColor: homeGlassColors.textMuted }]} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* No "Hôm nay" entry: the filled red circle under today's date says
          so by itself, and dropping it gives the other three room (owner,
          2026-10-30). */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendTick, { backgroundColor: homeGlassColors.tick }]}>
            <Icon name="check" size={9} color="#FFFFFF" strokeWidth={4} />
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[theme.type.captionSm, styles.legendLabel, { color: homeGlassColors.textMuted }]}>{t('completed')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendRing, { borderColor: homeGlassColors.dotMissed }]} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[theme.type.captionSm, styles.legendLabel, { color: homeGlassColors.textMuted }]}>{t('notCompleted')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: homeGlassColors.textMuted }]} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[theme.type.captionSm, styles.legendLabel, { color: homeGlassColors.textMuted }]}>{t('upcomingShort')}</Text>
        </View>
      </View>

      <View style={[styles.progressRow, { borderTopColor: homeGlassColors.hairline }]}>
        <Text style={[styles.progressValue, heroFont('700'), { color: homeGlassColors.text }]}>
          {t('daysOfTotal', { done: doneCount, total: totalDays })}
        </Text>
        <Text style={[theme.type.captionSm, { color: homeGlassColors.textMuted }]}>{t('roadmapProgress')}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: homeGlassColors.surfaceRaised }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: homeGlassColors.tick }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginTop: 12,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  monthArrow: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  monthShrink: {
    flexShrink: 1,
    minWidth: 0,
  },
  monthSpacer: {
    flex: 1,
  },
  todayPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  weekRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellNumber: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 15,
    lineHeight: 20,
  },
  // Always rendered, even when the day carries no marker: the row's height
  // must not depend on what happens to be in it.
  marker: {
    height: MARKER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellRing: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.8,
  },
  cellTick: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  // One line, always. The fourth entry pushed this onto a second row and
  // took ~25pt of the pre-scroll screen with it (owner, 2026-10-28) — the
  // labels shrink to fit instead.
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  legendLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  legendTick: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 14,
  },
  progressValue: {
    fontSize: 17,
    lineHeight: 22,
  },
  track: {
    height: 7,
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
