// Turning "elbowL is 31° out, smaller" into something a person can act on.
//
// The engine measures; this decides what to SAY. Kept apart from
// poseCompare.ts so the maths stays testable without a translation table,
// and so the wording can change without anybody touching the geometry.
//
// Two rules the copy here has to keep:
//
// 1. Say what to DO, never what is wrong with them. "Duỗi thẳng tay trái
//    hơn" is a movement; "tay trái sai" is a verdict on a person, and this
//    feature is not qualified to make one. Nothing here uses the word sai.
//
// 2. Only speak when the direction is real. Angles measured against the
//    vertical wrap around at ±180°, so "larger" and "smaller" mean nothing
//    a customer could act on — those measures get a neutral line that
//    points back at the demonstration instead of inventing a direction.
import type { MeasureId, MeasureResult } from './poseCompare';
import type { TranslationKey } from './i18n';

/** `side` is returned rather than baked into `params` because the word for
 * "trái" is itself translated — the caller renders it with the same `t` it
 * renders the sentence with. */
export type PoseHint = { key: TranslationKey; side?: 'left' | 'right' };

/** Which half of the body a measurement belongs to, for the hint's wording
 * and for naming the worst part in the session summary. */
const SIDE: Partial<Record<MeasureId, 'left' | 'right'>> = {
  shoulderL: 'left',
  elbowL: 'left',
  hipL: 'left',
  kneeL: 'left',
  shoulderR: 'right',
  elbowR: 'right',
  hipR: 'right',
  kneeR: 'right',
};

/** A joint angle that opens and closes, so "bigger" and "smaller" are real
 * instructions: which way to move, in that customer's own words. */
const DIRECTED: Partial<Record<MeasureId, { bigger: TranslationKey; smaller: TranslationKey }>> = {
  elbowL: { bigger: 'poseHintElbowBend', smaller: 'poseHintElbowStraighten' },
  elbowR: { bigger: 'poseHintElbowBend', smaller: 'poseHintElbowStraighten' },
  shoulderL: { bigger: 'poseHintArmLower', smaller: 'poseHintArmRaise' },
  shoulderR: { bigger: 'poseHintArmLower', smaller: 'poseHintArmRaise' },
  kneeL: { bigger: 'poseHintKneeBend', smaller: 'poseHintKneeStraighten' },
  kneeR: { bigger: 'poseHintKneeBend', smaller: 'poseHintKneeStraighten' },
  hipL: { bigger: 'poseHintHipFlex', smaller: 'poseHintHipExtend' },
  hipR: { bigger: 'poseHintHipFlex', smaller: 'poseHintHipExtend' },
  neckAngle: { bigger: 'poseHintChinTuck', smaller: 'poseHintHeadBack' },
};

/** Measures with no actionable direction — see rule 2 above. */
const NEUTRAL: Partial<Record<MeasureId, TranslationKey>> = {
  headTilt: 'poseHintHeadTilt',
  headTurn: 'poseHintHeadTurn',
  shoulderTilt: 'poseHintShoulders',
  torso: 'poseHintTorso',
};

/** The part of the body a measurement is about, for the session summary
 * ("chỗ cần chú ý nhất: tay trái"). */
const PART: Record<MeasureId, TranslationKey> = {
  headTilt: 'poseMeasureHead',
  headTurn: 'poseMeasureHead',
  neckAngle: 'poseMeasureNeck',
  shoulderTilt: 'poseMeasureShoulders',
  torso: 'poseMeasureTorso',
  shoulderL: 'poseMeasureArmLeft',
  shoulderR: 'poseMeasureArmRight',
  elbowL: 'poseMeasureArmLeft',
  elbowR: 'poseMeasureArmRight',
  hipL: 'poseMeasureLegLeft',
  hipR: 'poseMeasureLegRight',
  kneeL: 'poseMeasureLegLeft',
  kneeR: 'poseMeasureLegRight',
};

export function hintFor(result: MeasureResult | null): PoseHint | null {
  if (!result) return null;

  const directed = DIRECTED[result.id];
  if (directed && result.direction !== 0) {
    return {
      key: result.direction > 0 ? directed.bigger : directed.smaller,
      side: SIDE[result.id],
    };
  }

  const neutral = NEUTRAL[result.id];
  return neutral ? { key: neutral } : null;
}

export function partOf(id: MeasureId): TranslationKey {
  return PART[id];
}
