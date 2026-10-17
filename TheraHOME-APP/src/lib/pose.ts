// Live body keypoints from the camera.
//
// "Tôi tập có giống chuyên viên không?" — asked while the customer is still
// moving, rather than hours later through `FormReviewCard`'s clip-and-wait.
//
// The detection itself is native on both platforms (Apple Vision on iOS,
// MediaPipe on Android) and lives in modules/therahome-pose, which explains
// why it is ours rather than a package. This file is the whole JavaScript
// surface: a guard, a view, and the shape of a frame.
import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { requireNativeView } from 'expo';

/** The fifteen points both platforms report. `neck` and `hipMid` are
 * derived from these in the comparison engine, not measured — see
 * modules/therahome-pose/ios/PoseCanonical.swift, which also says why the
 * set stops at the ankles. */
export type PoseKey =
  | 'nose'
  | 'earL'
  | 'earR'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'wristL'
  | 'wristR'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR'
  | 'ankleL'
  | 'ankleR';

export type PosePoint = {
  k: PoseKey;
  /** 0..1 across the VIEW, not the camera frame — the native side has
   * already undone the preview's crop and mirroring, so these can be
   * multiplied by the view's width and height and drawn. */
  x: number;
  y: number;
  /** 0..1. Low means the joint is guessed: off the edge of the frame, or
   * hidden behind the body. Never draw a low-confidence point as if it were
   * a measurement. */
  c: number;
};

export type PoseFrame = {
  /** Milliseconds on the device's monotonic clock. Only differences between
   * frames mean anything; it is not wall time. */
  t: number;
  /** Empty when nobody was found — which the UI must say out loud ("lùi lại
   * để thấy cả người") rather than freeze on the last good skeleton. */
  points: PosePoint[];
  mirrored: boolean;
  frameWidth: number;
  frameHeight: number;
};

export type PoseStatus = 'running' | 'stopped' | 'denied' | 'unavailable';

export type PoseCameraViewProps = {
  /** Opening the camera is slow and visible (the privacy indicator lights
   * up), so it is tied to a prop rather than to mounting: the screen can
   * lay itself out, explain itself, and only then ask. */
  active: boolean;
  facing?: 'front' | 'back';
  /** Frames per second handed to the detector, not captured. 12 is enough
   * for a skeleton a human is watching; past ~15 it is heat and battery.
   * The camera still previews at its own full rate. */
  targetFps?: number;
  onPose?: (event: PoseFrame) => void;
  onPoseStatus?: (event: { state: PoseStatus }) => void;
  style?: object;
};

// The key the module registers itself under: the string in its `Name(...)`,
// checked against both modules/therahome-pose/ios/TheraHomePoseModule.swift
// and .../android/.../TheraHomePoseModule.kt — not guessed from the
// directory name. Guessing it is what silently disabled video and PushKit
// for a whole release (CLAUDE.md, "Guarding an optional native module").
const POSE = requireOptionalNativeModule<{
  getPermissionStatus: () => 'granted' | 'denied' | 'undetermined';
  requestPermission: () => Promise<boolean>;
}>('TheraHomePose');

/** False on web, and on any build made before this module existed — an
 * older TestFlight or Play build must hide the feature, not crash on it. */
export function isPoseSupported(): boolean {
  return Platform.OS !== 'web' && !!POSE;
}

export function getCameraPermissionStatus(): 'granted' | 'denied' | 'undetermined' | 'unsupported' {
  if (!POSE) return 'unsupported';
  return POSE.getPermissionStatus();
}

/** Prompts once. Both platforms only ever show the system dialog the first
 * time; after a refusal this resolves false straight away and the caller
 * should offer Settings rather than ask again. */
export async function requestCameraPermission(): Promise<boolean> {
  if (!POSE) return false;
  try {
    return await POSE.requestPermission();
  } catch {
    return false;
  }
}

/**
 * The raw native view. Null when the running binary has no pose module.
 *
 * NOT for screens: its events arrive React Native's way, wrapped in
 * `{ nativeEvent }`, and reading them as the payload is what killed the app
 * on the first frame. Render `components/pose/PoseCamera` instead, which
 * unwraps them and hands back the `PoseFrame` these types describe.
 *
 * Resolved at import because `requireNativeView` throws rather than
 * returning null for a view that is not there.
 */
export const NativePoseCameraView: ComponentType<Record<string, unknown>> | null = POSE
  ? requireNativeView<Record<string, unknown>>('TheraHomePose')
  : null;

/** The bones, for drawing. Keyed on the canonical points above; a segment
 * whose ends are not both present is simply not drawn, which is what makes
 * a half-visible body degrade gracefully instead of sprouting a line to
 * nowhere. */
export const POSE_EDGES: [PoseKey, PoseKey][] = [
  ['earL', 'shoulderL'],
  ['earR', 'shoulderR'],
  ['shoulderL', 'shoulderR'],
  ['shoulderL', 'elbowL'],
  ['elbowL', 'wristL'],
  ['shoulderR', 'elbowR'],
  ['elbowR', 'wristR'],
  ['shoulderL', 'hipL'],
  ['shoulderR', 'hipR'],
  ['hipL', 'hipR'],
  ['hipL', 'kneeL'],
  ['kneeL', 'ankleL'],
  ['hipR', 'kneeR'],
  ['kneeR', 'ankleR'],
];

/** How the skeleton is drawn, in one place so the camera overlay, the
 * reference overlay and the offline QC renderer cannot drift apart.
 *
 * Proportional to the frame's width rather than fixed points: the same
 * skeleton is drawn over a 390pt phone pane and a 1920px QC render, and a
 * 3px line that reads as delicate on one is invisible on the other. */
export const POSE_STYLE = {
  /** Joint radius as a fraction of the drawing's width. */
  dotRatio: 0.0065,
  /** Bone thickness as a fraction of the drawing's width. */
  lineRatio: 0.0026,
  minDot: 3,
  minLine: 1.5,
} as const;

/** Below this a joint is a guess, not a measurement, and is drawn faint. */
export const POSE_CONFIDENT = 0.5;

/** Below THIS it is not drawn at all.
 *
 * A side-on exercise hides half the body from the camera, and the detector
 * still returns coordinates for the arm it cannot see — plausible ones,
 * drawn straight through the torso. Faint grey lines crossing the body read
 * as the feature being broken. Nothing is the honest drawing of a limb
 * nobody can see. */
export const POSE_HIDDEN = 0.3;
