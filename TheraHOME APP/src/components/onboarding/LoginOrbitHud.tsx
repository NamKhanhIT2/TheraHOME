// Login screen hero visual. Rewritten per an explicit "premium futuristic
// AI HUD" brief (see CLAUDE.md) — 8 concentric layers (outer orbit guides
// → particles → orbiting icon nodes → segmented ring → gradient energy
// arcs → radial tick ring → scanner → center logo), each animating on its
// own independent reanimated shared value so nothing reads as "the whole
// HUD spinning like one spinner." No percent/caption (pre-auth — nothing
// is actually being analyzed); the logo is static, everything else moves.
//
// Motion, slowest to fastest (all withRepeat(withTiming(...,{easing:
// linear})), UI thread, so 0°/360° render identically — no visible reset):
//   tick ring (~70s) < energy arcs (~34s) < segmented ring (~46s, counter)
//   < outer icon orbit (20s, clockwise) < middle icon orbit (15s,
//   counter-clockwise) < particles (5-7s) < scanner (4s, fastest)
//
// Entrance: logo → inner ring cluster → outer ring cluster → icon nodes,
// staggered fade (SVG layers) / fade+scale-pop (logo, icon badges) over a
// ~680ms window; each layer's continuous animation only starts once its
// own fade-in finishes, per the brief's "stagger then continuous" spec.
import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Icon } from '@/components/icons/Icon';

const AnimatedG = Animated.createAnimatedComponent(G);

const BRAND_MARK = require('../../../assets/brandmark-glow.png');

const CONTAINER = 416;
const CENTER = CONTAINER / 2;

// Radii, innermost to outermost — kept close together on purpose (the
// brief explicitly asks for a dense, unified cluster rather than a
// circular menu with generous spacing).
const INNER_FRAME_R = 51;
const SCANNER_R = 51;
const TICK_RING_R = 64;
const ENERGY_ARC_R = 79;
const SEGMENTED_RING_R = 95;
const MIDDLE_ORBIT_R = 115;
const OUTER_ORBIT_R = 140;
const OUTER_TRACK_R = 159;

const BADGE_SIZE = 40;
const BADGE_R = BADGE_SIZE / 2;

// Exact color system per CLAUDE.md's "THERAHOME FUTURISTIC LOGIN" spec —
// every value below is copied verbatim from that doc, not approximated.
function withAlpha(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.substring(0, 2), 16);
  const g = parseInt(n.substring(2, 4), 16);
  const b = parseInt(n.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const BG_DEEP = '#061126';
const HUD_GLOW = '#0A4F9E';

const ORBIT_DIM = '#1C5793';
const ORBIT_BRIGHT = '#168BFF';
const INNER_RING = '#165EA8';
const TICK_COLOR = '#168BFF';

const ELECTRIC_BLUE = '#078BFF';
const BRIGHT_BLUE = '#00A8FF';
const CYAN = '#00E5FF';
const HIGHLIGHT = '#BDEEFF';
const BLUE_GLOW = '#008CFF';

const PARTICLE_BLUE = '#53C8FF';
const PARTICLE_WHITE = '#E7F7FF';
const PARTICLE_BRIGHT = '#00E5FF';

const LOGO_INNER_GLOW = '#55C7FF';
const LOGO_OUTER_GLOW = '#008CFF';

// Node colors — assigned exactly as specified (settings/data, layers,
// brain, activity, spine, checklist), not rebalanced for "less violet."
const NODE_DATA = '#00E5FF';
const NODE_LAYERS = '#1597FF';
const NODE_BRAIN = '#8B5CFF';
const NODE_ACTIVITY = '#FF9D00';
const NODE_SPINE = '#00D7E8';
const NODE_CHECKLIST = '#9B5CFF';

const TICK_COUNT = 72;
const ENERGY_ARC_CIRCUMFERENCE = 2 * Math.PI * ENERGY_ARC_R;
// Two large chunky arcs (not three smaller ones) — closer to the reference's
// look of two dominant bright sweeps rather than several thin segments.
const ENERGY_ARCS = [
  { startDeg: 0, sweepDeg: 130 },
  { startDeg: 190, sweepDeg: 110 },
];

// A scattered field of small dots across three radii bands, on top of the
// per-orbit particles — the reference's HUD reads much denser/starrier
// than a couple of dots per ring.
const STARFIELD: { angleDeg: number; radius: number; size: number }[] = [
  { angleDeg: 20, radius: 72, size: 1.5 },
  { angleDeg: 95, radius: 76, size: 1.2 },
  { angleDeg: 160, radius: 70, size: 1.7 },
  { angleDeg: 205, radius: 74, size: 1.3 },
  { angleDeg: 270, radius: 78, size: 1.5 },
  { angleDeg: 335, radius: 72, size: 1.2 },
  { angleDeg: 35, radius: 103, size: 1.9 },
  { angleDeg: 100, radius: 99, size: 1.5 },
  { angleDeg: 150, radius: 105, size: 1.7 },
  { angleDeg: 220, radius: 101, size: 1.4 },
  { angleDeg: 285, radius: 104, size: 1.9 },
  { angleDeg: 345, radius: 100, size: 1.5 },
  { angleDeg: 25, radius: 166, size: 2.3 },
  { angleDeg: 80, radius: 162, size: 1.7 },
  { angleDeg: 135, radius: 168, size: 2.1 },
  { angleDeg: 195, radius: 163, size: 1.7 },
  { angleDeg: 250, radius: 167, size: 2.3 },
  { angleDeg: 310, radius: 164, size: 1.7 },
];
const SCANNER_CIRCUMFERENCE = 2 * Math.PI * SCANNER_R;
const SCANNER_SWEEP_DEG = 26;
const SCANNER_DASHARRAY = `${(SCANNER_SWEEP_DEG / 360) * SCANNER_CIRCUMFERENCE} ${SCANNER_CIRCUMFERENCE}`;

interface OrbitIcon {
  key: string;
  icon: string;
  angleDeg: number;
  color: string;
}

// Interleaved by starting angle (60° apart) so all six read as one
// evenly-spaced ring at rest, then drift apart as each orbit spins at its
// own speed/direction.
const OUTER_ICONS: OrbitIcon[] = [
  { key: 'brain', icon: 'brain', angleDeg: 0, color: NODE_BRAIN },
  { key: 'activity', icon: 'activity', angleDeg: 120, color: NODE_ACTIVITY },
  { key: 'layers', icon: 'layers', angleDeg: 240, color: NODE_LAYERS },
];
const MIDDLE_ICONS: OrbitIcon[] = [
  { key: 'bone', icon: 'bone', angleDeg: 60, color: NODE_SPINE },
  { key: 'data', icon: 'trending-up', angleDeg: 180, color: NODE_DATA },
  { key: 'clipboard', icon: 'clipboard-check', angleDeg: 300, color: NODE_CHECKLIST },
];

const OUTER_PARTICLE_ANGLES = [10, 130, 250];
const MIDDLE_PARTICLE_ANGLES = [40, 160, 280];
const PARTICLE_COLORS = [PARTICLE_BLUE, PARTICLE_WHITE, PARTICLE_BRIGHT];

const ENTRANCE_LOGO_DELAY = 0;
const ENTRANCE_INNER_DELAY = 200;
const ENTRANCE_OUTER_DELAY = 420;
const ENTRANCE_ICONS_DELAY = 680;
const ENTRANCE_DURATION = 380;

function fadeIn(value: SharedValue<number>, delay: number) {
  value.value = withDelay(delay, withTiming(1, { duration: ENTRANCE_DURATION, easing: Easing.out(Easing.cubic) }));
}

function spinForever(value: SharedValue<number>, to: number, duration: number, startDelay: number) {
  value.value = withDelay(startDelay, withRepeat(withTiming(to, { duration, easing: Easing.linear }), -1));
}

function OrbitIconBadge({
  item,
  radius,
  orbitRotation,
  entranceDelay,
}: {
  item: OrbitIcon;
  radius: number;
  orbitRotation: SharedValue<number>;
  entranceDelay: number;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withDelay(entranceDelay, withTiming(1, { duration: ENTRANCE_DURATION, easing: Easing.out(Easing.cubic) }));
    scale.value = withDelay(entranceDelay, withSpring(1, { damping: 11, stiffness: 140 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const angleRad = ((item.angleDeg + orbitRotation.value) * Math.PI) / 180;
    const x = radius * Math.sin(angleRad);
    const y = -radius * Math.cos(angleRad);
    return {
      opacity: opacity.value,
      transform: [{ translateX: x }, { translateY: y }, { scale: scale.value }, { rotate: `${-orbitRotation.value}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.badgeAnchor,
        animatedStyle,
        { backgroundColor: withAlpha(BG_DEEP, 0.88), borderColor: withAlpha(item.color, 0.8), shadowColor: item.color },
      ]}
    >
      <Icon name={item.icon} size={17} color={item.color} />
    </Animated.View>
  );
}

function Starfield({ rotation }: { rotation: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ rotation: rotation.value, origin: `${CENTER}, ${CENTER}` }));
  return (
    <AnimatedG animatedProps={props}>
      {STARFIELD.map((dot, i) => {
        const angle = (dot.angleDeg * Math.PI) / 180;
        return (
          <Circle
            key={i}
            cx={CENTER + dot.radius * Math.sin(angle)}
            cy={CENTER - dot.radius * Math.cos(angle)}
            r={dot.size}
            fill={PARTICLE_COLORS[i % PARTICLE_COLORS.length]}
            opacity={0.8}
          />
        );
      })}
    </AnimatedG>
  );
}

function OrbitParticles({ radius, rotation, angles }: { radius: number; rotation: SharedValue<number>; angles: number[] }) {
  const props = useAnimatedProps(() => ({ rotation: rotation.value, origin: `${CENTER}, ${CENTER}` }));
  return (
    <AnimatedG animatedProps={props}>
      {angles.map((angleDeg, i) => {
        const angle = (angleDeg * Math.PI) / 180;
        return (
          <Circle
            key={i}
            cx={CENTER + radius * Math.sin(angle)}
            cy={CENTER - radius * Math.cos(angle)}
            r={2.4}
            fill={PARTICLE_COLORS[i % PARTICLE_COLORS.length]}
            opacity={0.9}
          />
        );
      })}
    </AnimatedG>
  );
}

export function LoginOrbitHud() {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.7);
  const innerOpacity = useSharedValue(0);
  const outerOpacity = useSharedValue(0);

  const tickRotation = useSharedValue(0);
  const energyArcRotation = useSharedValue(0);
  const scannerRotation = useSharedValue(0);
  const segmentedRingRotation = useSharedValue(0);
  const outerOrbitRotation = useSharedValue(0);
  const middleOrbitRotation = useSharedValue(0);
  const outerParticleRotation = useSharedValue(0);
  const middleParticleRotation = useSharedValue(0);
  const starfieldRotation = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withDelay(ENTRANCE_LOGO_DELAY, withTiming(1, { duration: ENTRANCE_DURATION, easing: Easing.out(Easing.cubic) }));
    logoScale.value = withDelay(ENTRANCE_LOGO_DELAY, withSpring(1, { damping: 12, stiffness: 130 }));
    fadeIn(innerOpacity, ENTRANCE_INNER_DELAY);
    fadeIn(outerOpacity, ENTRANCE_OUTER_DELAY);

    const innerReady = ENTRANCE_INNER_DELAY + ENTRANCE_DURATION;
    const outerReady = ENTRANCE_OUTER_DELAY + ENTRANCE_DURATION;
    const iconsReady = ENTRANCE_ICONS_DELAY + ENTRANCE_DURATION;

    spinForever(tickRotation, -360, 70000, innerReady);
    spinForever(energyArcRotation, 360, 34000, innerReady);
    spinForever(scannerRotation, 360, 4000, innerReady);
    spinForever(segmentedRingRotation, -360, 46000, outerReady);
    spinForever(outerParticleRotation, 360, 7000, outerReady);
    spinForever(middleParticleRotation, -360, 5500, outerReady);
    spinForever(starfieldRotation, 360, 90000, innerReady);
    spinForever(outerOrbitRotation, 360, 20000, iconsReady);
    spinForever(middleOrbitRotation, -360, 15000, iconsReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const innerGroupProps = useAnimatedProps(() => ({ opacity: innerOpacity.value }));
  const outerGroupProps = useAnimatedProps(() => ({ opacity: outerOpacity.value }));
  const tickProps = useAnimatedProps(() => ({ rotation: tickRotation.value, origin: `${CENTER}, ${CENTER}` }));
  const energyProps = useAnimatedProps(() => ({ rotation: energyArcRotation.value, origin: `${CENTER}, ${CENTER}` }));
  const scannerProps = useAnimatedProps(() => ({ rotation: scannerRotation.value, origin: `${CENTER}, ${CENTER}` }));
  const segmentedProps = useAnimatedProps(() => ({ rotation: segmentedRingRotation.value, origin: `${CENTER}, ${CENTER}` }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <View style={styles.container}>
      <Svg width={CONTAINER} height={CONTAINER} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="hudBackglow" cx="50%" cy="50%" r="50%">
            <Stop offset="30%" stopColor={HUD_GLOW} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={HUD_GLOW} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="logoGlowInner" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={LOGO_INNER_GLOW} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={LOGO_INNER_GLOW} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="logoGlowOuter" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={LOGO_OUTER_GLOW} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={LOGO_OUTER_GLOW} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="energyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#086BFF" />
            <Stop offset="35%" stopColor={BRIGHT_BLUE} />
            <Stop offset="70%" stopColor={CYAN} />
            <Stop offset="100%" stopColor={HIGHLIGHT} />
          </LinearGradient>
          <LinearGradient id="scannerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={CYAN} stopOpacity={0} />
            <Stop offset="65%" stopColor={CYAN} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={HIGHLIGHT} stopOpacity={1} />
          </LinearGradient>
        </Defs>

        <Circle cx={CENTER} cy={CENTER} r={CONTAINER / 2} fill="url(#hudBackglow)" />
        <Circle cx={CENTER} cy={CENTER} r={95} fill="url(#logoGlowOuter)" />
        <Circle cx={CENTER} cy={CENTER} r={58} fill="url(#logoGlowInner)" />

        {/* Inner cluster: frame ring, scanner, tick ring, energy arcs */}
        <AnimatedG animatedProps={innerGroupProps}>
          {/* Rounded-square glow panel behind the logo, matching the
              reference's "badge" treatment instead of a bare floating mark. */}
          <Rect
            x={CENTER - 54}
            y={CENTER - 54}
            width={108}
            height={108}
            rx={26}
            fill={withAlpha(BG_DEEP, 0.55)}
            stroke={withAlpha(LOGO_INNER_GLOW, 0.45)}
            strokeWidth={1.5}
          />
          <Circle cx={CENTER} cy={CENTER} r={INNER_FRAME_R} stroke={withAlpha(INNER_RING, 0.5)} strokeWidth={1} fill="none" />
          <Circle cx={CENTER} cy={CENTER} r={SCANNER_R} stroke={withAlpha(ELECTRIC_BLUE, 0.22)} strokeWidth={1} fill="none" />

          <AnimatedG animatedProps={scannerProps}>
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={SCANNER_R}
              stroke="url(#scannerGradient)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={SCANNER_DASHARRAY}
              fill="none"
            />
          </AnimatedG>

          <AnimatedG animatedProps={tickProps}>
            {Array.from({ length: TICK_COUNT }, (_, i) => {
              const angle = (i / TICK_COUNT) * 2 * Math.PI;
              const inner = TICK_RING_R - 3;
              const outer = TICK_RING_R + 3;
              return (
                <Line
                  key={i}
                  x1={CENTER + inner * Math.sin(angle)}
                  y1={CENTER - inner * Math.cos(angle)}
                  x2={CENTER + outer * Math.sin(angle)}
                  y2={CENTER - outer * Math.cos(angle)}
                  stroke={i % 6 === 0 ? withAlpha(TICK_COLOR, 0.55) : withAlpha(TICK_COLOR, 0.3)}
                  strokeWidth={1}
                />
              );
            })}
          </AnimatedG>

          <AnimatedG animatedProps={energyProps}>
            {ENERGY_ARCS.map((arc, i) => {
              const len = (arc.sweepDeg / 360) * ENERGY_ARC_CIRCUMFERENCE;
              const dash = `${len} ${ENERGY_ARC_CIRCUMFERENCE - len}`;
              return (
                <React.Fragment key={i}>
                  {/* Glow duplicate — wider + more transparent, simulates
                      the spec's 10-18px blur without an SVG blur filter. */}
                  <Circle
                    cx={CENTER}
                    cy={CENTER}
                    r={ENERGY_ARC_R}
                    stroke={BLUE_GLOW}
                    strokeOpacity={0.5}
                    strokeWidth={6 + 12}
                    strokeLinecap="round"
                    strokeDasharray={dash}
                    rotation={arc.startDeg}
                    origin={`${CENTER}, ${CENTER}`}
                    fill="none"
                  />
                  <Circle
                    cx={CENTER}
                    cy={CENTER}
                    r={ENERGY_ARC_R}
                    stroke="url(#energyGradient)"
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={dash}
                    rotation={arc.startDeg}
                    origin={`${CENTER}, ${CENTER}`}
                    fill="none"
                  />
                </React.Fragment>
              );
            })}
          </AnimatedG>
        </AnimatedG>

        {/* Outer cluster: orbit guides, segmented ring, particles */}
        <AnimatedG animatedProps={outerGroupProps}>
          <Circle cx={CENTER} cy={CENTER} r={MIDDLE_ORBIT_R} stroke={withAlpha(ORBIT_DIM, 0.35)} strokeWidth={1} fill="none" />
          <Circle cx={CENTER} cy={CENTER} r={OUTER_ORBIT_R} stroke={withAlpha(ORBIT_DIM, 0.35)} strokeWidth={1} fill="none" />
          <Circle cx={CENTER} cy={CENTER} r={OUTER_TRACK_R} stroke={withAlpha(ORBIT_DIM, 0.3)} strokeWidth={1} fill="none" />

          <AnimatedG animatedProps={segmentedProps}>
            <Circle cx={CENTER} cy={CENTER} r={SEGMENTED_RING_R} stroke={withAlpha(ORBIT_BRIGHT, 0.4)} strokeWidth={1.5} strokeDasharray="12,9" fill="none" />
          </AnimatedG>

          <OrbitParticles radius={MIDDLE_ORBIT_R} rotation={middleParticleRotation} angles={MIDDLE_PARTICLE_ANGLES} />
          <OrbitParticles radius={OUTER_ORBIT_R} rotation={outerParticleRotation} angles={OUTER_PARTICLE_ANGLES} />
          <Starfield rotation={starfieldRotation} />
        </AnimatedG>
      </Svg>

      {OUTER_ICONS.map((item, i) => (
        <OrbitIconBadge key={item.key} item={item} radius={OUTER_ORBIT_R} orbitRotation={outerOrbitRotation} entranceDelay={ENTRANCE_ICONS_DELAY + i * 50} />
      ))}
      {MIDDLE_ICONS.map((item, i) => (
        <OrbitIconBadge key={item.key} item={item} radius={MIDDLE_ORBIT_R} orbitRotation={middleOrbitRotation} entranceDelay={ENTRANCE_ICONS_DELAY + i * 50 + 25} />
      ))}

      <Animated.View style={[styles.content, logoStyle]} pointerEvents="none">
        <Image source={BRAND_MARK} style={styles.logo} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CONTAINER,
    height: CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 82,
    height: 82,
  },
  badgeAnchor: {
    position: 'absolute',
    left: CENTER - BADGE_R,
    top: CENTER - BADGE_R,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_R,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});
