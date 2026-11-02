import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { heroFont } from '@/components/home/glass';
import { useI18n } from '@/lib/i18n';
import type { DayRow } from '@/hooks/usePrograms';

const WEEKDAY_VI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

export interface TodayCardProps {
  day: DayRow;
  date: Date;
  productName: string;
  minutes: number;
  /** Vietnamese writes the weekday out; the other markets use the locale's
   * own long date, which already carries it. */
  language: string;
  onStart: () => void;
}

/** Today's session, pulled out of the calendar and given the whole card —
 * the one thing the roadmap exists to get someone to do (owner's
 * reference, 2026-10-27). */
export function TodayCard({ day, date, productName, minutes, language, onStart }: TodayCardProps) {
  const theme = useTheme();
  const { t } = useI18n();

  // "Giai đoạn 1 · Giảm khó chịu & làm quen" splits in two: the chip names
  // the phase, the headline carries what the phase is FOR. Running both
  // behind the day number made a line nobody reads to the end (owner,
  // 2026-10-27).
  const [phaseLabel, ...phaseRest] = day.phase.split('·').map((part) => part.trim());
  const phaseTheme = phaseRest.join(' · ');
  // The card used to read `day` for everything EXCEPT whether it was done,
  // so after finishing today's session it still showed the red "start" CTA
  // while the day screen said "Đã hoàn thành" and the list below drew a tick
  // (owner, 2026-11-01). Finished days stay openable — the session is worth
  // watching twice — so this changes what the card says, not what it does.
  const done = day.status === 'done';

  const dateLine =
    language === 'vi'
      ? `${WEEKDAY_VI[date.getDay()]}, ${date.getDate()} tháng ${date.getMonth() + 1}`
      : date.toLocaleDateString(language === 'ms' ? 'ms-MY' : 'en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });

  return (
    <View style={[styles.card, { backgroundColor: homeGlassColors.surface, borderColor: homeGlassColors.hairline }]}>
      <View style={styles.dateRow}>
        <View style={[styles.dot, { backgroundColor: done ? homeGlassColors.tick : homeGlassColors.focus }]} />
        <Text style={[theme.type.captionSm, styles.dateText, { color: homeGlassColors.textMuted }]}>
          {dateLine.toUpperCase()}
        </Text>
      </View>

      <Text style={[styles.title, heroFont('700'), { color: homeGlassColors.text }]}>
        {t('day')} {day.id}{phaseTheme ? ` · ${phaseTheme}` : ''}
      </Text>

      <View style={styles.chips}>
        {/* The phase is a glass chip — translucent, with the shadow doing
            the lifting. The duration beside it is bare: two framed pills in
            a row read as two buttons, and only one of these is even a
            label (owner, 2026-10-27). */}
        {phaseLabel ? (
          <View style={[styles.chip, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
            <Text numberOfLines={1} style={[theme.type.captionSm, { color: homeGlassColors.textMuted }]}>{phaseLabel}</Text>
          </View>
        ) : null}
        <View style={styles.chipRow}>
          <Icon name="clock" size={13} color={homeGlassColors.textMuted} />
          <Text style={[theme.type.captionSm, { color: homeGlassColors.textMuted }]}>
            {t('sessionMinutes', { count: minutes })}
          </Text>
        </View>
      </View>

      {done ? (
        <View style={styles.doneRow}>
          <Icon name="check" size={15} color={homeGlassColors.tick} strokeWidth={2.6} />
          <Text style={[theme.type.captionSm, { color: homeGlassColors.tick }]}>{t('sessionDone')}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onStart}
        style={({ pressed }) => [
          styles.cta,
          done
            ? { backgroundColor: homeGlassColors.surfaceRaised, borderWidth: 1, borderColor: homeGlassColors.hairline }
            : { backgroundColor: homeGlassColors.focus },
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        <Icon name="play" size={16} color={done ? homeGlassColors.text : '#FFFFFF'} strokeWidth={2.4} />
        <Text style={[styles.ctaLabel, heroFont('700'), done ? { color: homeGlassColors.text } : null]}>
          {done ? t('reviewSession') : t('startSession')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginTop: 14,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dateText: {
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    marginTop: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '60%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    borderRadius: 16,
    marginTop: 16,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21,
  },
});
