// The specialist's movement, precomputed.
//
// A reference track is what `scripts/pose-track.py` produces from a demo
// clip: the same fifteen canonical points the phone measures, sampled at a
// fixed rate, normalized against the clip's own frame. The app plays the
// clip and reads the matching sample out of here, rather than running a
// second detector on the reference video — which would double the cost on
// the cheapest phone we support AND make "correct" slightly different every
// time the clip played.
import type { PoseKey } from './pose';

/** `[x, y, confidence]`, all 0..1, x and y against the CLIP's frame. */
export type TrackPoint = [number, number, number];

export type TrackSample = {
  /** Milliseconds from the start of the clip. */
  t: number;
  p: Partial<Record<PoseKey, TrackPoint>>;
};

export type PoseTrack = {
  version: number;
  label: string;
  source: string;
  generatedAt: string;
  /** How the specialist was filmed. Decides which angles are worth scoring:
   * a camera at the customer's side cannot see shoulders tilt, and a
   * camera in front cannot see a neck flex. */
  view: 'front' | 'side';
  fps: number;
  /** Seconds. */
  duration: number;
  frameWidth: number;
  frameHeight: number;
  samples: TrackSample[];
};

/** Enough of a track to be worth comparing against. Tracks arrive from the
 * network as JSON, so this is a real boundary, not a formality. */
export function isPoseTrack(value: unknown): value is PoseTrack {
  if (!value || typeof value !== 'object') return false;
  const track = value as Partial<PoseTrack>;
  return (
    Array.isArray(track.samples) &&
    track.samples.length > 1 &&
    typeof track.duration === 'number' &&
    track.duration > 0 &&
    typeof track.frameWidth === 'number' &&
    track.frameWidth > 0 &&
    typeof track.frameHeight === 'number' &&
    track.frameHeight > 0 &&
    (track.view === 'front' || track.view === 'side')
  );
}

/** The clip's own aspect ratio, needed to measure angles in it.
 *
 * Coordinates are normalized to the frame's width and height separately, so
 * on anything but a square frame a 45° limb is not 45° in those numbers.
 * Everything that computes an angle multiplies x by this first. */
export function trackAspect(track: PoseTrack): number {
  return track.frameWidth / track.frameHeight;
}

/** The sample nearest a moment in the clip. Nearest, not interpolated: at
 * 15fps the gap is 66ms, which is less than the jitter the comparison
 * already smooths away, and interpolating across a missing joint invents
 * positions the detector never reported. */
export function sampleAt(track: PoseTrack, timeMs: number): TrackSample | null {
  const { samples } = track;
  if (samples.length === 0) return null;
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (samples[middle].t < timeMs) low = middle + 1;
    else high = middle;
  }
  const after = samples[low];
  const before = samples[low > 0 ? low - 1 : 0];
  return Math.abs(after.t - timeMs) < Math.abs(before.t - timeMs) ? after : before;
}

/** Every sample within `windowMs` either side of a moment, nearest first.
 *
 * The comparison looks across a window rather than at one instant because
 * a customer copying a video is always a beat behind it. Scoring them
 * against the exact frame would paint them red for being human. */
export function samplesAround(track: PoseTrack, timeMs: number, windowMs: number): TrackSample[] {
  const found = track.samples.filter((sample) => Math.abs(sample.t - timeMs) <= windowMs);
  return found.sort((a, b) => Math.abs(a.t - timeMs) - Math.abs(b.t - timeMs));
}
