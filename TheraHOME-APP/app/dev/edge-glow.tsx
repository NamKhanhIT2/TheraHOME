import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { EdgeGlowSurface, screenCornerRadius } from '@/components/motion/SiriEdgeGlow';
import { DEFAULT_EDGE_GLOW_TUNING, type EdgeGlowTuning } from '@/components/motion/edgeGlowShader';

const TIMES = [0, 70, 160, 290, 660, 1160, 2100, 3600, 7100];
type Background = 'reference' | 'therahome' | 'dark' | 'light';
type TuningKey = 'radius' | 'coreWidth' | 'haloSigma' | 'exposure' | 'noiseAmp' | 'speed' | 'anchorShift';

function timeFromParam(value?: string) {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) ? Math.max(0, Math.min(20_000, parsed)) : 290;
}

export default function EdgeGlowDebugScreen() {
  const params = useLocalSearchParams<{ time?: string; clean?: string; background?: Background }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [background, setBackground] = useState<Background>(() =>
    params.background && ['reference', 'therahome', 'dark', 'light'].includes(params.background)
      ? params.background : 'reference');
  const [controls, setControls] = useState(() => params.clean !== '1');
  const [playing, setPlaying] = useState(false);
  const [fixedTime, setFixedTime] = useState(() => timeFromParam(params.time));
  const [timeInput, setTimeInput] = useState(() => String(timeFromParam(params.time)));
  const [guides, setGuides] = useState(false);
  const [tuning, setTuning] = useState<EdgeGlowTuning>(() => ({
    ...DEFAULT_EDGE_GLOW_TUNING,
    radius: screenCornerRadius(width, height),
  }));
  const timeMs = useSharedValue(fixedTime);
  const clock = useFrameCallback((frame) => {
    'worklet';
    timeMs.value += Math.min(frame.timeSincePreviousFrame ?? 0, 50);
  }, false);

  useEffect(() => {
    const next = timeFromParam(params.time);
    timeMs.value = next;
    setFixedTime(next);
    setTimeInput(String(next));
    setPlaying(false);
    setControls(params.clean !== '1');
    if (params.background && ['reference', 'therahome', 'dark', 'light'].includes(params.background)) {
      setBackground(params.background);
    }
  }, [params.background, params.clean, params.time, timeMs]);

  useEffect(() => {
    clock.setActive(playing);
    return () => clock.setActive(false);
  }, [clock, playing]);

  function seek(ms: number) {
    const next = Math.max(0, Math.min(20_000, Math.round(ms)));
    setPlaying(false);
    setFixedTime(next);
    setTimeInput(String(next));
    timeMs.value = next;
  }

  function adjust(key: TuningKey, amount: number, minimum = 0) {
    setTuning((current) => ({
      ...current,
      [key]: Math.max(minimum, Math.round((current[key] + amount) * 100) / 100),
    }));
  }

  function toggleLayer(index: number) {
    setTuning((current) => {
      const layers: [number, number, number, number] = [...current.layers];
      layers[index] = layers[index] ? 0 : 1;
      return { ...current, layers };
    });
  }

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <View style={[styles.root, { backgroundColor: background === 'light' ? '#fff' : '#101522' }]}>
      {background === 'reference' ? (
        <Image source={require('../../assets/debug/siri-pre-glow.png')} style={StyleSheet.absoluteFill} contentFit="fill" />
      ) : null}
      {background === 'therahome' ? (
        <Image source={require('../../assets/debug/therahome-home.jpg')} style={StyleSheet.absoluteFill} contentFit="fill" />
      ) : null}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <EdgeGlowSurface width={width} height={height} timeMs={timeMs} tuning={tuning} />
        {guides ? <View style={[styles.guide, { borderRadius: tuning.radius }]} /> : null}
      </View>

      <Pressable style={[styles.toggle, { top: insets.top + 8 }]} onPress={() => setControls(!controls)}>
        <Text style={styles.buttonText}>{controls ? 'Ẩn bảng chỉnh' : 'Hiện bảng chỉnh'}</Text>
      </Pressable>

      {controls ? (
        <ScrollView style={[styles.controls, { bottom: insets.bottom + 8 }]} contentContainerStyle={styles.content}>
          <Text style={styles.title}>Edge glow · {playing ? 'đang phát' : `${fixedTime} ms`}</Text>
          <View style={styles.row}>
            <Pill label="Replay intro" onPress={() => {
              setTuning((x) => ({ ...x, exposure: x.exposure || 1 }));
              seek(0);
              setPlaying(true);
            }} />
            <Pill label={playing ? 'Tạm dừng' : 'Phát'} onPress={() => setPlaying(!playing)} />
            <Pill label={tuning.exposure > 0 ? 'Tắt' : 'Bật'} onPress={() => {
              setTuning((x) => ({ ...x, exposure: x.exposure > 0 ? 0 : 1 }));
            }} />
          </View>
          <View style={styles.row}>
            {TIMES.map((ms) => <Pill key={ms} label={`${ms}`} active={!playing && fixedTime === ms} onPress={() => seek(ms)} />)}
          </View>
          <View style={styles.row}>
            <TextInput
              value={timeInput}
              onChangeText={setTimeInput}
              onSubmitEditing={() => seek(Number(timeInput) || 0)}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="ms"
              placeholderTextColor="#9aa5b8"
            />
            <Pill label="Tua đến mốc" onPress={() => seek(Number(timeInput) || 0)} />
            <Pill label="Mask / crop" active={guides} onPress={() => setGuides(!guides)} />
            <Pill label="Chỉ mask" active={!!tuning.debugMask} onPress={() => setTuning((x) => ({ ...x, debugMask: x.debugMask ? 0 : 1 }))} />
          </View>
          <View style={styles.row}>
            {(['reference', 'therahome', 'dark', 'light'] as Background[]).map((name) => (
              <Pill key={name} label={name} active={background === name} onPress={() => setBackground(name)} />
            ))}
          </View>
          <View style={styles.row}>
            {(['Core', 'Band', 'Halo', 'Wash'] as const).map((name, index) => (
              <Pill key={name} label={name} active={!!tuning.layers[index]} onPress={() => toggleLayer(index)} />
            ))}
          </View>
          <Control label="Radius" value={tuning.radius} less={() => adjust('radius', -1, 1)} more={() => adjust('radius', 1)} />
          <Control label="Core width" value={tuning.coreWidth} less={() => adjust('coreWidth', -0.1, 0.5)} more={() => adjust('coreWidth', 0.1)} />
          <Control label="Halo sigma" value={tuning.haloSigma} less={() => adjust('haloSigma', -1, 2)} more={() => adjust('haloSigma', 1)} />
          <Control label="Exposure" value={tuning.exposure} less={() => adjust('exposure', -0.1)} more={() => adjust('exposure', 0.1)} />
          <Control label="Noise" value={tuning.noiseAmp} less={() => adjust('noiseAmp', -0.2)} more={() => adjust('noiseAmp', 0.2)} />
          <Control label="Speed" value={tuning.speed} less={() => adjust('speed', -0.1)} more={() => adjust('speed', 0.1)} />
          <Control label="Color anchors" value={tuning.anchorShift} less={() => adjust('anchorShift', -0.02, -0.5)} more={() => adjust('anchorShift', 0.02)} />
        </ScrollView>
      ) : null}
    </View>
  );
}

function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Control({ label, value, less, more }: { label: string; value: number; less: () => void; more: () => void }) {
  return (
    <View style={styles.controlRow}>
      <Text style={styles.controlLabel}>{label}: {value}</Text>
      <Pill label="−" onPress={less} />
      <Pill label="+" onPress={more} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  guide: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: '#fff', borderStyle: 'dashed' },
  toggle: { position: 'absolute', right: 12, zIndex: 3, backgroundColor: '#111a28df', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  controls: { position: 'absolute', left: 8, right: 8, maxHeight: '54%', backgroundColor: '#111827ed', borderRadius: 16, zIndex: 2 },
  content: { padding: 12, gap: 9 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#334155' },
  pillActive: { backgroundColor: '#2869bc' },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  input: { minWidth: 68, color: '#fff', borderWidth: 1, borderColor: '#74839a', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  controlLabel: { flex: 1, color: '#e5e7eb', fontSize: 13 },
});
