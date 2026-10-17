// The measuring stick for modules/therahome-pose.
//
// Not a feature. This screen exists to answer one question before the real
// one is built: how many frames a second does the detector manage on the
// phones customers actually hold, and does the skeleton land on the body?
// A Galaxy A12 is the floor we have to clear, and finding out AFTER writing
// the two-pane training screen would mean writing it twice.
//
// DEV BUILDS ONLY. It was briefly open to review accounts too, which was
// convenient and not worth it: a diagnostic screen with no entry point,
// reachable in a store binary by typing a URL, is the shape of thing
// Guideline 2.3.1 is about. Measuring a new handset means a local build
// (`expo run:ios --device` / `run:android`), which is what measuring an
// Android handset needs anyway.
//
// No entry point in the UI, so the way in is the deep link
// `therahome://dev-pose`.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { PoseSkeleton } from '@/components/pose/PoseSkeleton';
import { PoseCamera } from '@/components/pose/PoseCamera';
import {
  POSE_CONFIDENT,
  getCameraPermissionStatus,
  isPoseSupported,
  requestCameraPermission,
  type PoseFrame,
  type PosePoint,
  type PoseStatus,
} from '@/lib/pose';

export default function DevPoseScreen() {
  const theme = useTheme();
  const allowed = __DEV__;

  const [granted, setGranted] = useState(() => getCameraPermissionStatus() === 'granted');
  const [active, setActive] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [targetFps, setTargetFps] = useState(12);
  const [status, setStatus] = useState<PoseStatus | null>(null);
  const [points, setPoints] = useState<PosePoint[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Measured, not assumed: frames counted on a ref so counting them cannot
  // itself cost a render, and published once a second.
  const [fps, setFps] = useState(0);
  const frames = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setFps(frames.current);
      frames.current = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const onPose = useCallback((frame: PoseFrame) => {
    frames.current += 1;
    setPoints(frame.points ?? []);
  }, []);

  const onStatus = useCallback((event: { state: PoseStatus }) => setStatus(event.state), []);

  async function toggle() {
    if (active) {
      setActive(false);
      return;
    }
    if (!granted) {
      const ok = await requestCameraPermission();
      setGranted(ok);
      if (!ok) return;
    }
    setActive(true);
  }

  if (!allowed) {
    return (
      <ScreenContainer>
        <BackBar onBack={() => router.back()} title="Pose" />
        <View style={styles.center}>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary }]}>Không khả dụng.</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!isPoseSupported()) {
    return (
      <ScreenContainer>
        <BackBar onBack={() => router.back()} title="Pose" />
        <View style={styles.center}>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
            Bản build này chưa có module therahome-pose. Cần build lại app.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const confident = points.filter((p) => p.c >= POSE_CONFIDENT).length;

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title="Pose (dev)" />

      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize({ w: width, h: height });
        }}
        style={[styles.frame, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.lg }]}
      >
        <PoseCamera
          active={active}
          facing={facing}
          targetFps={targetFps}
          onPose={onPose}
          onPoseStatus={onStatus}
          style={StyleSheet.absoluteFill}
        />
        <PoseSkeleton points={points} width={size.w} height={size.h} />
        {!active ? (
          <View style={styles.center}>
            <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>Camera đang tắt</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.readout}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>
          {fps} fps · {confident}/{points.length} điểm rõ
        </Text>
        <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>
          trạng thái: {status ?? '—'} · {facing} · mục tiêu {targetFps} fps
        </Text>
      </View>

      <View style={styles.controls}>
        <Btn label={active ? 'Dừng' : 'Bật camera'} onPress={toggle} primary />
        <Btn label={facing === 'front' ? 'Sau' : 'Trước'} onPress={() => setFacing(facing === 'front' ? 'back' : 'front')} />
        <Btn label={`${targetFps} fps`} onPress={() => setTargetFps(targetFps === 12 ? 20 : targetFps === 20 ? 8 : 12)} />
      </View>
    </ScreenContainer>
  );
}

function Btn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.btn,
        {
          backgroundColor: primary ? theme.colors.primary : theme.colors.bgCardAlt,
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <Text style={[theme.type.button, { color: primary ? '#fff' : theme.colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, margin: 20, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  readout: { paddingHorizontal: 20, gap: 2 },
  controls: { flexDirection: 'row', gap: 10, padding: 20 },
  btn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
});
