package ai.therahome.pose

// The fifteen points the rest of the app knows about — the twin of
// ios/PoseCanonical.swift. Read that file's comment first; it explains why
// three different detectors (Apple Vision here, MediaPipe on Android,
// MediaPipe again in the offline track generator) are all cut down to the
// same small set before anything compares them.
//
// MediaPipe's pose landmarker returns 33 landmarks in a fixed order. Only
// these fifteen are forwarded; `neck` and `hipMid` are derived as midpoints
// in TypeScript so there is one definition of them rather than three.
//
// MediaPipe also reports heels and toes. They are dropped: Apple's Vision
// has no foot joint at all, and a skeleton with toes on Android and none on
// iPhone is a difference customers would see.
//
// The labels are ANATOMICAL: index 11 is the shoulder on the person's own
// left, which in a frontal image appears on the right. That only holds
// while the model is looking at an unmirrored person, which is why the view
// mirrors the preview and not the frames it analyses.
object Canonical {
  const val NOSE = "nose"
  const val EAR_L = "earL"
  const val EAR_R = "earR"
  const val SHOULDER_L = "shoulderL"
  const val SHOULDER_R = "shoulderR"
  const val ELBOW_L = "elbowL"
  const val ELBOW_R = "elbowR"
  const val WRIST_L = "wristL"
  const val WRIST_R = "wristR"
  const val HIP_L = "hipL"
  const val HIP_R = "hipR"
  const val KNEE_L = "kneeL"
  const val KNEE_R = "kneeR"
  const val ANKLE_L = "ankleL"
  const val ANKLE_R = "ankleR"

  /** MediaPipe landmark index → canonical key. */
  val landmarkMap: Map<Int, String> = mapOf(
    0 to NOSE,
    7 to EAR_L,
    8 to EAR_R,
    11 to SHOULDER_L,
    12 to SHOULDER_R,
    13 to ELBOW_L,
    14 to ELBOW_R,
    15 to WRIST_L,
    16 to WRIST_R,
    23 to HIP_L,
    24 to HIP_R,
    25 to KNEE_L,
    26 to KNEE_R,
    27 to ANKLE_L,
    28 to ANKLE_R,
  )
}
