// Deciding which part of the customer is wrong, and saying so.
//
// WHY ANGLES AND NOT POSITIONS. The obvious comparison — how far each
// keypoint is from where the specialist's was — is wrong in every way that
// matters: it fails for anyone a different height, anyone standing nearer
// or further from the phone, anyone filmed on a different lens, and it
// cannot tell "your elbow is in the wrong place" from "your whole body is
// a little to the left". Joint ANGLES have none of those problems. A 90°
// elbow is 90° on a tall man two metres away and on a small woman one metre
// away, in portrait or landscape, on either platform's detector.
//
// WHAT IT IS NOT. This is not a diagnosis. It says a limb is at a different
// angle from the demonstration, which is a useful thing to show someone
// and NOT a clinical judgement about their body. The copy around it has to
// stay on the right side of that line, and nothing here should ever be
// given a word like "sai" without a way to disagree with it — see
// docs/feature-notes.md.
//
// No React, no imports with a runtime cost: this file is pure arithmetic so
// it can be tested on its own (tests/pose-compare.test.cjs).
import type { PoseKey, PosePoint } from './pose';
import type { PoseTrack, TrackSample } from './poseTrack';

export type Level = 'ok' | 'warn' | 'bad' | 'weak';

/** The canonical points plus the three the app derives rather than
 * measures, so there is one definition of "the neck" instead of three. */
export type DerivedKey = PoseKey | 'neck' | 'hipMid' | 'earMid';

export type Vec = { x: number; y: number; c: number };
export type Skeleton = Partial<Record<DerivedKey, Vec>>;

export type MeasureId =
  | 'headTilt'
  | 'headTurn'
  | 'neckAngle'
  | 'shoulderTilt'
  | 'torso'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR';

export type CompareConfig = {
  view: 'front' | 'side';
  /** Which angles this exercise is scored on. Defaults to the set for the
   * view — a camera at the customer's side cannot see shoulders tilt. */
  measures?: MeasureId[];
  thresholds?: Partial<Record<MeasureId, { warn: number; bad: number }>>;
  weights?: Partial<Record<MeasureId, number>>;
  /** The customer copies the demonstration as if looking in a mirror, so
   * the specialist's left arm is the arm they raise on their right. */
  mirror?: boolean;
  /** How far behind (or ahead of) the clip the customer may be. */
  windowMs?: number;
  /** EMA factor on the measured angles. Lower is smoother and laggier. */
  smoothing?: number;
  /** Frames a limb must stay wrong before it goes red. */
  holdFrames?: number;
};

export type MeasureResult = {
  id: MeasureId;
  /** Degrees away from the specialist. */
  error: number;
  level: Level;
  /** +1 the customer's angle is larger than the demonstration's, -1
   * smaller, 0 when it cannot be told. This is what turns "your elbow is
   * 30° out" into "duỗi tay thẳng hơn". */
  direction: -1 | 0 | 1;
};

export type Verdict = {
  /** 0..100, the whole body at this instant. */
  score: number;
  measures: MeasureResult[];
  /** `${from}-${to}` → level, ready to hand to PoseSkeleton. */
  edges: Record<string, Level>;
  /** The one thing worth saying out loud right now, or null when there is
   * nothing wrong enough to interrupt for. */
  hint: MeasureResult | null;
  /** Whether the customer is even in shot. 'lost' must never be scored. */
  tracking: 'ok' | 'partial' | 'lost';
  /** Which moment of the clip they were actually matched against — useful
   * in testing, and for showing how far behind they are. */
  matchedMs: number | null;
};

export type SessionSummary = {
  frames: number;
  /** Fraction of scored frames at or above `GOOD_SCORE`. */
  goodRatio: number;
  averageScore: number;
  worst: MeasureId | null;
  best: MeasureId | null;
};

/** A frame at or above this counts as "đúng" for the session summary. */
export const GOOD_SCORE = 80;

const DEFAULTS = {
  windowMs: 600,
  smoothing: 0.5,
  holdFrames: 3,
  warn: 10,
  bad: 25,
  /** Error at which a measure scores zero. Past this it is not "more
   * wrong" in any way a customer can act on. */
  cap: 45,
  /** How much of the score is the single worst angle rather than the
   * average of all of them — see where it is used. */
  worstWeight: 0.25,
} as const;

/** Below this a point is a guess and takes no part in a measurement. */
const CONFIDENT = 0.5;

// Which angles each kind of camera can actually see. Scoring a shoulder
// tilt from the side, where both shoulders sit on top of each other, is
// measuring noise and calling it form.
const VIEW_MEASURES: Record<'front' | 'side', MeasureId[]> = {
  front: ['headTilt', 'headTurn', 'shoulderTilt', 'torso', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR'],
  side: ['neckAngle', 'torso', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR'],
};

/** Which bones a measurement colours. A wrong elbow angle makes both
 * halves of that arm suspect, because the customer cannot tell which half
 * moved. */
const MEASURE_EDGES: Record<MeasureId, string[]> = {
  headTilt: ['earL-shoulderL', 'earR-shoulderR'],
  headTurn: ['earL-shoulderL', 'earR-shoulderR'],
  neckAngle: ['earL-shoulderL', 'earR-shoulderR'],
  shoulderTilt: ['shoulderL-shoulderR'],
  torso: ['shoulderL-hipL', 'shoulderR-hipR'],
  shoulderL: ['shoulderL-elbowL'],
  shoulderR: ['shoulderR-elbowR'],
  elbowL: ['shoulderL-elbowL', 'elbowL-wristL'],
  elbowR: ['shoulderR-elbowR', 'elbowR-wristR'],
  hipL: ['hipL-kneeL'],
  hipR: ['hipR-kneeR'],
  kneeL: ['hipL-kneeL', 'kneeL-ankleL'],
  kneeR: ['hipR-kneeR', 'kneeR-ankleR'],
};

const MIRRORED: Partial<Record<PoseKey, PoseKey>> = {
  earL: 'earR',
  earR: 'earL',
  shoulderL: 'shoulderR',
  shoulderR: 'shoulderL',
  elbowL: 'elbowR',
  elbowR: 'elbowL',
  wristL: 'wristR',
  wristR: 'wristL',
  hipL: 'hipR',
  hipR: 'hipL',
  kneeL: 'kneeR',
  kneeR: 'kneeL',
  ankleL: 'ankleR',
  ankleR: 'ankleL',
};

// ---------------------------------------------------------------- geometry

function midpoint(a: Vec | undefined, b: Vec | undefined): Vec | undefined {
  if (!a || !b) return undefined;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, c: Math.min(a.c, b.c) };
}

/**
 * Points → a skeleton that can be measured.
 *
 * `aspect` is the width/height of whatever the coordinates were normalized
 * against. Without it every angle is squashed by the frame's shape, and
 * the camera pane (tall) and the reference clip (wide) would disagree
 * about a right angle by thirty degrees.
 */
export function toSkeleton(points: { k: PoseKey; x: number; y: number; c: number }[], aspect: number): Skeleton {
  const skeleton: Skeleton = {};
  for (const point of points) {
    skeleton[point.k] = { x: point.x * aspect, y: point.y, c: point.c };
  }
  skeleton.neck = midpoint(skeleton.shoulderL, skeleton.shoulderR);
  skeleton.hipMid = midpoint(skeleton.hipL, skeleton.hipR);
  skeleton.earMid = midpoint(skeleton.earL, skeleton.earR) ?? skeleton.earL ?? skeleton.earR ?? skeleton.nose;
  return skeleton;
}

export function trackSampleToSkeleton(sample: TrackSample, aspect: number): Skeleton {
  const points = Object.entries(sample.p).map(([key, value]) => ({
    k: key as PoseKey,
    x: value![0],
    y: value![1],
    c: value![2],
  }));
  return toSkeleton(points, aspect);
}

/** Swaps left for right. Applied to the SPECIALIST, once, so the rest of
 * the pipeline never has to think about it again. */
export function mirrorSkeleton(skeleton: Skeleton): Skeleton {
  const out: Skeleton = {};
  for (const [key, value] of Object.entries(skeleton)) {
    const swapped = MIRRORED[key as PoseKey];
    out[(swapped ?? key) as DerivedKey] = value;
  }
  return out;
}

const DEGREES = 180 / Math.PI;

function usable(point: Vec | undefined): point is Vec {
  return !!point && point.c >= CONFIDENT;
}

/** Interior angle at `vertex`, 0..180. */
function jointAngle(a: Vec | undefined, vertex: Vec | undefined, b: Vec | undefined): number | null {
  if (!usable(a) || !usable(vertex) || !usable(b)) return null;
  const ax = a.x - vertex.x;
  const ay = a.y - vertex.y;
  const bx = b.x - vertex.x;
  const by = b.y - vertex.y;
  const magnitude = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (magnitude < 1e-6) return null;
  const cosine = Math.min(1, Math.max(-1, (ax * bx + ay * by) / magnitude));
  return Math.acos(cosine) * DEGREES;
}

/** Direction of `from`→`to` measured off straight up, −180..180. Screen
 * coordinates, so y grows downwards. */
function tilt(from: Vec | undefined, to: Vec | undefined): number | null {
  if (!usable(from) || !usable(to)) return null;
  return Math.atan2(to.x - from.x, from.y - to.y) * DEGREES;
}

/** Shortest way round the circle, so 179° and −179° are 2° apart. */
function angleDelta(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

/**
 * A rough yaw: how far the head is turned away from the camera.
 *
 * There is no honest way to measure this from a body-pose model — it has
 * no face — so this reads the only cue available: as the head turns, the
 * nose moves towards one ear and away from the other. The number is a
 * fraction scaled to look like degrees, NOT a measured angle, which is why
 * its thresholds are deliberately loose and why a neck-rotation exercise
 * should be scored on something else until face landmarks exist.
 */
function headTurn(skeleton: Skeleton): number | null {
  const { nose, earL, earR } = skeleton;
  if (!usable(nose) || !usable(earL) || !usable(earR)) return null;
  const left = Math.hypot(nose.x - earL.x, nose.y - earL.y);
  const right = Math.hypot(nose.x - earR.x, nose.y - earR.y);
  const total = left + right;
  if (total < 1e-6) return null;
  return ((left - right) / total) * 90;
}

const MEASURES: Record<MeasureId, (skeleton: Skeleton) => number | null> = {
  headTilt: (s) => tilt(s.neck, s.earMid),
  headTurn,
  neckAngle: (s) => jointAngle(s.earMid, s.neck, s.hipMid),
  shoulderTilt: (s) => tilt(s.shoulderL, s.shoulderR),
  torso: (s) => tilt(s.hipMid, s.neck),
  shoulderL: (s) => jointAngle(s.elbowL, s.shoulderL, s.hipL),
  shoulderR: (s) => jointAngle(s.elbowR, s.shoulderR, s.hipR),
  elbowL: (s) => jointAngle(s.shoulderL, s.elbowL, s.wristL),
  elbowR: (s) => jointAngle(s.shoulderR, s.elbowR, s.wristR),
  hipL: (s) => jointAngle(s.shoulderL, s.hipL, s.kneeL),
  hipR: (s) => jointAngle(s.shoulderR, s.hipR, s.kneeR),
  kneeL: (s) => jointAngle(s.hipL, s.kneeL, s.ankleL),
  kneeR: (s) => jointAngle(s.hipR, s.kneeR, s.ankleR),
};

/** Measures where ±180 wraps round and plain subtraction would be wrong. */
const CIRCULAR: MeasureId[] = ['headTilt', 'shoulderTilt', 'torso'];

export function measure(skeleton: Skeleton, id: MeasureId): number | null {
  return MEASURES[id](skeleton);
}

/** The angles this exercise is scored on. */
export function measuresFor(config: CompareConfig): MeasureId[] {
  return config.measures ?? VIEW_MEASURES[config.view];
}

/**
 * The bones worth drawing for an exercise: the ones carrying a measured
 * angle, and nothing else.
 *
 * A skeleton showing every bone it can find looks like a debug overlay. The
 * product the owner pointed at draws the part of the body the exercise is
 * about, which also happens to be the only part whose colour can mean
 * anything — and it quietly fixes two eyesores: the shoulder-to-shoulder
 * and hip-to-hip lines collapse to a dot when the camera is at the
 * customer's side, and crossed legs on a seated front-on exercise tangle
 * into a knot.
 */
export function edgesFor(config: CompareConfig): Set<string> {
  const edges = new Set<string>();
  for (const id of measuresFor(config)) {
    for (const edge of MEASURE_EDGES[id]) edges.add(edge);
  }
  return edges;
}

/** Total disagreement between two skeletons, used to pick which moment of
 * the clip the customer is actually at. */
function distance(user: Skeleton, reference: Skeleton, measures: MeasureId[]): number | null {
  let total = 0;
  let counted = 0;
  for (const id of measures) {
    const a = measure(user, id);
    const b = measure(reference, id);
    if (a === null || b === null) continue;
    total += Math.abs(CIRCULAR.includes(id) ? angleDelta(a, b) : a - b);
    counted += 1;
  }
  return counted === 0 ? null : total / counted;
}

// -------------------------------------------------------------- comparator

export type Comparator = {
  push(points: PosePoint[], viewAspect: number, clipTimeMs: number): Verdict;
  summary(): SessionSummary;
  reset(): void;
};

const LOST: Verdict = {
  score: 0,
  measures: [],
  edges: {},
  hint: null,
  tracking: 'lost',
  matchedMs: null,
};

export function createComparator(track: PoseTrack, config: CompareConfig): Comparator {
  const measures = config.measures ?? VIEW_MEASURES[config.view];
  const windowMs = config.windowMs ?? DEFAULTS.windowMs;
  const smoothing = config.smoothing ?? DEFAULTS.smoothing;
  const holdFrames = config.holdFrames ?? DEFAULTS.holdFrames;
  const aspect = track.frameWidth / track.frameHeight;

  // The clip's skeletons, measured once. A track is a few hundred samples
  // and the same ones are re-read every frame of a session; recomputing
  // thirteen angles for each of them sixty times a second is the kind of
  // waste that shows up as heat on a cheap phone.
  const referenceCache = new Map<number, Skeleton>();
  function referenceAt(sample: TrackSample): Skeleton {
    const cached = referenceCache.get(sample.t);
    if (cached) return cached;
    const raw = trackSampleToSkeleton(sample, aspect);
    const skeleton = config.mirror ? mirrorSkeleton(raw) : raw;
    referenceCache.set(sample.t, skeleton);
    return skeleton;
  }

  let smoothed: Partial<Record<MeasureId, number>> = {};
  let badFor: Partial<Record<MeasureId, number>> = {};
  let frames = 0;
  let good = 0;
  let scoreTotal = 0;
  const errorTotal: Partial<Record<MeasureId, { sum: number; count: number }>> = {};

  function reset() {
    smoothed = {};
    badFor = {};
    frames = 0;
    good = 0;
    scoreTotal = 0;
    for (const key of Object.keys(errorTotal)) delete errorTotal[key as MeasureId];
  }

  function push(points: PosePoint[], viewAspect: number, clipTimeMs: number): Verdict {
    const user = toSkeleton(points, viewAspect);
    // Shoulders and hips are what everything else is measured against. With
    // neither, there is no body here to judge, and guessing would be worse
    // than admitting it.
    if (!usable(user.neck) && !usable(user.hipMid)) return LOST;

    // Nearest in TIME first, then whichever of those nearby moments the
    // customer actually matches best. Without the second step a customer
    // half a second behind is scored against a pose they have not reached.
    const candidates = track.samples.filter((sample) => Math.abs(sample.t - clipTimeMs) <= windowMs);
    if (candidates.length === 0) return LOST;

    let reference: Skeleton | null = null;
    let matchedMs: number | null = null;
    let bestDistance = Infinity;
    for (const sample of candidates) {
      const skeleton = referenceAt(sample);
      const gap = distance(user, skeleton, measures);
      if (gap === null) continue;
      if (gap < bestDistance) {
        bestDistance = gap;
        reference = skeleton;
        matchedMs = sample.t;
      }
    }
    if (!reference) return LOST;

    const results: MeasureResult[] = [];
    const edges: Record<string, Level> = {};
    let weighted = 0;
    let weightTotal = 0;
    let worstError = 0;

    for (const id of measures) {
      const raw = measure(user, id);
      const target = measure(reference, id);
      if (raw === null || target === null) {
        // Not scored and not blamed: a limb out of shot is a thing to say,
        // not a thing to go red.
        for (const edge of MEASURE_EDGES[id]) edges[edge] = edges[edge] ?? 'weak';
        continue;
      }

      const previous = smoothed[id];
      const value = previous === undefined ? raw : previous + (raw - previous) * smoothing;
      smoothed[id] = value;

      const error = Math.abs(CIRCULAR.includes(id) ? angleDelta(value, target) : value - target);
      const limits = config.thresholds?.[id] ?? { warn: DEFAULTS.warn, bad: DEFAULTS.bad };

      // A limb has to stay wrong for a few frames before it goes red.
      // Without this it flickers on every wobble, which reads as the app
      // being unsure rather than the customer being out.
      const over = error > limits.bad;
      badFor[id] = over ? (badFor[id] ?? 0) + 1 : 0;
      const level: Level = (badFor[id] ?? 0) >= holdFrames ? 'bad' : error > limits.warn ? 'warn' : 'ok';

      const direction: -1 | 0 | 1 =
        error <= limits.warn ? 0 : (CIRCULAR.includes(id) ? angleDelta(value, target) : value - target) > 0 ? 1 : -1;

      results.push({ id, error, level, direction });
      for (const edge of MEASURE_EDGES[id]) {
        // The worse verdict wins: one bone shared by two measurements is
        // as wrong as the worse of them.
        edges[edge] = worse(edges[edge], level);
      }

      const weight = config.weights?.[id] ?? 1;
      const capped = Math.min(error, DEFAULTS.cap);
      weighted += capped * weight;
      weightTotal += weight;
      if (capped > worstError) worstError = capped;

      const totals = (errorTotal[id] ??= { sum: 0, count: 0 });
      totals.sum += error;
      totals.count += 1;
    }

    if (results.length === 0) return { ...LOST, tracking: 'partial', matchedMs };

    // The average alone lies by dilution. With eight angles scored, one
    // limb a long way out moves the mean by an eighth — so the screen would
    // show a red arm and a reassuring number beside it, and the customer
    // would reasonably believe the number. Blending in the WORST angle
    // makes the score agree with what they can see.
    //
    // Measured against the day-1 warm-up track, one arm clearly out of
    // place: 88 on the mean alone, 53 at a weight of 0.4, 66 at 0.25. 88
    // reads as "fine" and 53 as a disaster; 66 is the honest reading of
    // "one of these is wrong and the rest is good". Both arms wrong: 34.
    const meanError = weighted / weightTotal;
    const combined = meanError * (1 - DEFAULTS.worstWeight) + worstError * DEFAULTS.worstWeight;
    const score = Math.round(100 - (combined / DEFAULTS.cap) * 100);
    const hint = results
      .filter((result) => result.level === 'bad')
      .sort((a, b) => b.error - a.error)[0] ?? null;

    frames += 1;
    scoreTotal += score;
    if (score >= GOOD_SCORE) good += 1;

    return {
      score,
      measures: results,
      edges,
      hint,
      tracking: results.length < measures.length ? 'partial' : 'ok',
      matchedMs,
    };
  }

  function summary(): SessionSummary {
    const ranked = Object.entries(errorTotal)
      .map(([id, totals]) => ({ id: id as MeasureId, mean: totals!.sum / totals!.count }))
      .sort((a, b) => b.mean - a.mean);
    return {
      frames,
      goodRatio: frames === 0 ? 0 : good / frames,
      averageScore: frames === 0 ? 0 : Math.round(scoreTotal / frames),
      worst: ranked[0]?.id ?? null,
      best: ranked[ranked.length - 1]?.id ?? null,
    };
  }

  return { push, summary, reset };
}

const RANK: Record<Level, number> = { ok: 0, weak: 1, warn: 2, bad: 3 };

function worse(a: Level | undefined, b: Level): Level {
  if (!a) return b;
  return RANK[a] >= RANK[b] ? a : b;
}
