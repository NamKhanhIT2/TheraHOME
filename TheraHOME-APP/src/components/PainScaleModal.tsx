import React, { useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '@/theme';
import { painColor } from '@/theme/colors';
import { MoodFace } from '@/components/MoodFace';
import { Button } from '@/components/ui/Button';
import { useI18n, type TranslationKey } from '@/lib/i18n';

export interface PainScaleModalProps {
  dayId: number;
  onCancel: () => void;
  onConfirm: (value: number) => void;
  submitting?: boolean;
}

function moodLabelKey(v: number): TranslationKey {
  if (v === 0) return 'noDiscomfort';
  if (v <= 3) return 'mildDiscomfort';
  if (v <= 7) return 'moderateDiscomfort';
  return 'highDiscomfort';
}

/** Discrete 0–10 slider built on PanResponder (no slider package is installed,
 * and this app doesn't need one elsewhere, so a small self-contained
 * implementation is used in place of `<input type="range">`).
 *
 * The thumb/fill position is driven by an `Animated.Value` that's updated
 * directly from touch coordinates on every move event, completely outside
 * React state — so dragging stays smooth no matter how heavy the sibling
 * re-render is (`MoodFace` restarts a bounce/tilt spring on every step).
 * The discrete 0–10 `value` is only committed (and thus only triggers that
 * re-render) when the touch crosses into a new step, throttled slightly so
 * a fast flick across the whole track doesn't fire 10 commits in one frame. */
function PainSlider({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const containerRef = useRef<View>(null);
  const widthRef = useRef(1);
  const pageXRef = useRef(0);
  const lastValueRef = useRef(value);
  lastValueRef.current = value;
  const pctAnim = useRef(new Animated.Value(value / 10)).current;
  const lastCommitAtRef = useRef(0);
  const COMMIT_THROTTLE_MS = 40;

  // `locationX` is relative to whichever native view actually caught the
  // touch — when a drag starts right on the thumb (an absolutely-positioned
  // child), that's the thumb's own small frame, not the track, which is
  // what snapped the value to ~0 on touch-down and made it jitter mid-drag
  // as the touched view kept changing. `pageX` is always relative to the
  // screen, so it stays consistent regardless of which child is underneath.
  const updateFromPageX = (pageX: number, isFinal: boolean) => {
    const x = pageX - pageXRef.current;
    const pct = Math.max(0, Math.min(1, x / widthRef.current));
    pctAnim.setValue(pct);

    const nextValue = Math.round(pct * 10);
    if (nextValue === lastValueRef.current) return;
    const now = Date.now();
    if (!isFinal && now - lastCommitAtRef.current < COMMIT_THROTTLE_MS) return;
    lastCommitAtRef.current = now;
    lastValueRef.current = nextValue;
    onChange(nextValue);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => updateFromPageX(e.nativeEvent.pageX, false),
      onPanResponderMove: (e) => updateFromPageX(e.nativeEvent.pageX, false),
      // Guarantees the exact final position is committed even if the last
      // move landed inside the throttle window.
      onPanResponderRelease: (e) => updateFromPageX(e.nativeEvent.pageX, true),
      onPanResponderTerminate: (e) => updateFromPageX(e.nativeEvent.pageX, true),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    containerRef.current?.measure((_x, _y, _width, _height, pageX) => {
      pageXRef.current = pageX;
    });
  };

  const pctPercent = pctAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View>
      <View
        ref={containerRef}
        onLayout={onLayout}
        {...panResponder.panHandlers}
        style={styles.sliderHitArea}
      >
        <View style={[styles.sliderTrack, { backgroundColor: theme.colors.borderLight }]} />
        <Animated.View style={[styles.sliderFill, { width: pctPercent, backgroundColor: color }]} />
        <Animated.View style={[styles.sliderThumb, { left: pctPercent, backgroundColor: color, borderColor: '#fff' }]} />
      </View>
      <View style={styles.sliderLabels}>
        <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>0 · {t('noDiscomfort')}</Text>
        <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>10 · {t('veryUncomfortable')}</Text>
      </View>
    </View>
  );
}

/** Full-screen pain-scale prompt shown before opening a `current` roadmap day
 * that hasn't been logged yet — mirrors `PainScaleModal`. */
export function PainScaleModal({ dayId, onCancel, onConfirm, submitting }: PainScaleModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [value, setValue] = useState(3);
  const color = painColor(value);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={submitting ? undefined : onCancel}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.space[5] }]}
        >
          <Text style={[theme.type.h2, { color: theme.colors.textPrimary }]}>
            {t('day')} {dayId} · {t('discomfortToday')}
          </Text>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 4, marginBottom: 18 }]}>
            {t('swipePain')}
          </Text>
          <View style={styles.faceCol}>
            <MoodFace value={value} />
            <Text style={[theme.type.h1, { color, marginTop: 6 }]}>{value}</Text>
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t(moodLabelKey(value))}</Text>
          </View>
          <View style={{ marginTop: 20 }}>
            <PainSlider value={value} onChange={setValue} color={color} />
          </View>
          <Button style={{ width: '100%', marginTop: 18 }} loading={submitting} onPress={() => onConfirm(value)}>
            {t('continue')}
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,24,34,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
  },
  faceCol: {
    alignItems: 'center',
    gap: 4,
  },
  sliderHitArea: {
    height: 44,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 7,
    borderRadius: 4,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 18.5,
    height: 6,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    marginLeft: -10,
    top: 12,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
});
