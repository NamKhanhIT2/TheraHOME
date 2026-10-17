import Vision

// The fifteen points the rest of the app knows about.
//
// iOS reads them from Apple's Vision (19 joints), Android from MediaPipe
// (33 landmarks), and the offline track generator from MediaPipe again. None
// of those three agree on names, counts or ordering, so this file — and its
// twin in android/.../Canonical.kt — is where each one is cut down to the
// SAME fifteen measured points. Everything above this layer (the comparison
// engine, the overlay, the stored reference tracks) only ever sees these
// keys, which is what makes an iPhone's skeleton comparable with a track
// computed on a Mac.
//
// Fifteen and not thirty-three on purpose. The arms, trunk and head are
// what TheraNECK's exercises are scored on; the legs are here because the
// customer can SEE them — several exercises are done lying down with the
// knees up, and a skeleton that stops at the hips reads as broken even when
// every measured angle is right. `neck` and `hipMid` are DERIVED in
// TypeScript (midpoints), not reported here, so there is one definition of
// them rather than three.
//
// It stops at the ankles on purpose too: Apple's Vision has no foot or heel
// joint at all, and a skeleton with toes on Android and none on iPhone is a
// difference customers would see. Both platforms draw the same body.
//
// Both detectors label joints ANATOMICALLY — the shoulder on the person's
// own left is `leftShoulder` even though it appears on the right of a
// frontal image. That only holds while the detector is looking at an
// unmirrored person, which is why the view mirrors the PREVIEW and not the
// frames it analyses. See PoseCameraView.swift.
enum CanonicalJoint {
  static let nose = "nose"
  static let earL = "earL"
  static let earR = "earR"
  static let shoulderL = "shoulderL"
  static let shoulderR = "shoulderR"
  static let elbowL = "elbowL"
  static let elbowR = "elbowR"
  static let wristL = "wristL"
  static let wristR = "wristR"
  static let hipL = "hipL"
  static let hipR = "hipR"
  static let kneeL = "kneeL"
  static let kneeR = "kneeR"
  static let ankleL = "ankleL"
  static let ankleR = "ankleR"
}

let visionJointMap: [VNHumanBodyPoseObservation.JointName: String] = [
  .nose: CanonicalJoint.nose,
  .leftEar: CanonicalJoint.earL,
  .rightEar: CanonicalJoint.earR,
  .leftShoulder: CanonicalJoint.shoulderL,
  .rightShoulder: CanonicalJoint.shoulderR,
  .leftElbow: CanonicalJoint.elbowL,
  .rightElbow: CanonicalJoint.elbowR,
  .leftWrist: CanonicalJoint.wristL,
  .rightWrist: CanonicalJoint.wristR,
  .leftHip: CanonicalJoint.hipL,
  .rightHip: CanonicalJoint.hipR,
  .leftKnee: CanonicalJoint.kneeL,
  .rightKnee: CanonicalJoint.kneeR,
  .leftAnkle: CanonicalJoint.ankleL,
  .rightAnkle: CanonicalJoint.ankleR,
]
