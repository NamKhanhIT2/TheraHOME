// The skeleton, drawn over a camera frame or a reference clip.
//
// One component for both panes of the training screen, and for the dev
// measuring screen, so the specialist's body and the customer's body are
// drawn by the same code at the same weight. Two near-identical drawing
// routines would drift, and the whole point of putting them side by side is
// that the difference the customer sees is a difference in the MOVEMENT.
//
// White with a dark halo, and only the bones the exercise is actually
// scored on — see poseColors and `edgesFor` for why each of those is a
// decision rather than a default.
//
// Plain SVG, not Reanimated. Fifteen points move every single frame, so
// there is nothing to interpolate between — `useAnimatedProps` would add a
// worklet per joint and buy no smoothness. docs/motion.md warns off exactly
// this kind of continuous per-item animation.
import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { poseColors } from '@/theme';
import { POSE_CONFIDENT, POSE_EDGES, POSE_HIDDEN, POSE_STYLE, type PoseKey, type PosePoint } from '@/lib/pose';

/** How a limb is doing. `reference` is the neutral white — the specialist's
 * frame only ever uses it, because the specialist is never wrong. */
export type PoseLevel = 'reference' | 'ok' | 'warn' | 'bad' | 'weak';

/** How loudly a verdict speaks, for resolving a joint shared by two bones.
 * `weak` ranks with `ok` on purpose: "we could not see it" must never win
 * over "that limb is out", or an unseen wrist would mute a red forearm. */
const SEVERITY: Record<PoseLevel, number> = { reference: 0, ok: 1, weak: 1, warn: 2, bad: 3 };

/** `${from}-${to}`, matching POSE_EDGES. */
export type EdgeId = string;

export interface PoseSkeletonProps {
  points: PosePoint[];
  width: number;
  height: number;
  /** Per-limb verdicts. Anything not named falls back to `level`. */
  levels?: Partial<Record<EdgeId, PoseLevel>>;
  /** The colour for everything `levels` does not mention. */
  level?: PoseLevel;
  /** Which bones to draw. Omitted means all of them, which is what the dev
   * screen wants and what no customer-facing screen should: see `edgesFor`
   * in poseCompare. A joint with no drawn bone is not drawn either — a
   * floating dot is noise, not information. */
  only?: Set<EdgeId>;
  /** Dims the whole skeleton — used while the reference clip is paused and
   * nothing is being scored. */
  opacity?: number;
}

export const PoseSkeleton = memo(function PoseSkeleton({
  points,
  width,
  height,
  levels,
  level = 'reference',
  only,
  opacity = 1,
}: PoseSkeletonProps) {
  if (width <= 0 || height <= 0 || points.length === 0) return null;

  const at = new Map<PoseKey, PosePoint>(points.map((point) => [point.k, point]));
  const dot = Math.max(POSE_STYLE.minDot, width * POSE_STYLE.dotRatio);
  const stroke = Math.max(POSE_STYLE.minLine, width * POSE_STYLE.lineRatio);
  const halo = stroke * 2.6;

  // Resolve the bones first: the joints drawn are the ones they end at.
  const bones = POSE_EDGES.filter(([from, to]) => {
    if (only && !only.has(`${from}-${to}`)) return false;
    const a = at.get(from);
    const b = at.get(to);
    return !!a && !!b && a.c >= POSE_HIDDEN && b.c >= POSE_HIDDEN;
  });

  // A joint takes the WORST verdict of the bones that reach it.
  //
  // It used to take `level` — the screen-wide fallback, which is 'ok' while
  // a session runs. So every joint was drawn green no matter what, and a
  // shoulder sitting between two red bones still had a green dot on it.
  // Reported from the device, 2026-10-19: the limb says "wrong" and the
  // joint says "fine", in the same picture, and the customer has to decide
  // which half of the drawing to believe.
  const joints = new Map<PoseKey, PoseLevel>();
  for (const [from, to] of bones) {
    const edge = levels?.[`${from}-${to}`] ?? level;
    for (const key of [from, to] as PoseKey[]) {
      const held = joints.get(key);
      if (held === undefined || SEVERITY[edge] > SEVERITY[held]) joints.set(key, edge);
    }
  }

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none" opacity={opacity}>
      {/* The halo pass, under everything. White on a white wall is
          invisible without it, and so is green on a green yoga mat. */}
      {bones.map(([from, to]) => {
        const a = at.get(from)!;
        const b = at.get(to)!;
        return (
          <Line
            key={`halo-${from}-${to}`}
            x1={a.x * width}
            y1={a.y * height}
            x2={b.x * width}
            y2={b.y * height}
            stroke={poseColors.halo}
            strokeWidth={halo}
            strokeLinecap="round"
          />
        );
      })}
      {[...joints.keys()].map((key) => {
        const point = at.get(key)!;
        return (
          <Circle
            key={`halo-${key}`}
            cx={point.x * width}
            cy={point.y * height}
            r={dot * 1.5}
            fill={poseColors.halo}
          />
        );
      })}

      {bones.map(([from, to]) => {
        const a = at.get(from)!;
        const b = at.get(to)!;
        // A limb is only as trustworthy as its worse end. Colouring a bone
        // red because the elbow it hangs from was a guess is how a feature
        // like this loses someone's trust in one session.
        const guessed = a.c < POSE_CONFIDENT || b.c < POSE_CONFIDENT;
        const colour = guessed ? poseColors.weak : poseColors[levels?.[`${from}-${to}`] ?? level];
        return (
          <Line
            key={`${from}-${to}`}
            x1={a.x * width}
            y1={a.y * height}
            x2={b.x * width}
            y2={b.y * height}
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
            opacity={guessed ? 0.5 : 1}
          />
        );
      })}
      {[...joints.entries()].map(([key, jointLevel]) => {
        const point = at.get(key)!;
        const guessed = point.c < POSE_CONFIDENT;
        return (
          <Circle
            key={key}
            cx={point.x * width}
            cy={point.y * height}
            r={dot}
            fill={guessed ? poseColors.weak : poseColors[jointLevel]}
            opacity={guessed ? 0.5 : 1}
          />
        );
      })}
    </Svg>
  );
});
