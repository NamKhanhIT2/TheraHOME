# therahome-pose

A camera preview that also reports where the body is: eleven keypoints per
frame, in the preview's own coordinates, ready to draw on top of it. The
feature it exists for is "tập cùng chuyên viên" — the customer copies a
reference clip and the parts that do not match go red while they move.

Used from `src/lib/pose.ts`. Local Expo module: autolinked from `modules/`
with no entry in package.json, so there is nothing to install — but it IS
native, so a build made before it existed does not have it. That is why
`isPoseSupported()` exists and why the screens check it.

## Why ours rather than a package

Nothing in the vision-camera ecosystem publishes support for React Native
0.86 / Expo SDK 57 — its v5 line states a 0.81 / Expo 54 floor — and this
app has already lost a day to a third-party native library that linked fine
and then failed at runtime under the New Architecture (CLAUDE.md). The whole
surface here is one view, three props and a permission call.

## Two different detectors, on purpose

| | iOS | Android |
|---|---|---|
| Camera | `AVCaptureSession` + `AVCaptureVideoPreviewLayer` | CameraX `PreviewView` + `ImageAnalysis` |
| Pose | Apple **Vision** (`VNDetectHumanBodyPoseRequest`) | **MediaPipe** pose landmarker, `lite`, LIVE_STREAM |
| Cost | nothing — system framework, no model file | ~5.8 MB model in `android/src/main/assets` |

iOS does not use MediaPipe because the `MediaPipeTasksVision` pod wants
`use_frameworks!`, and this app's Podfile already carries LiveKit WebRTC,
CallKeep, VoIP PushKit and Google Sign-In. The risk of disturbing that was
worth more than matching models.

The price is that the two platforms do not place a shoulder in exactly the
same spot. It is paid by never comparing coordinates: both are reduced to
the same eleven canonical points (`ios/PoseCanonical.swift`,
`android/.../Canonical.kt`) and everything above compares **angles between
joints**, which are nearly identical across models and do not care how tall
the customer is or how far from the phone they stand.

## The two things that are easy to get wrong

**1. The preview is mirrored; the analysed frames are not.** A selfie view
that does not behave like a mirror is very hard to copy a movement in, so
the preview is flipped for the front camera. The frames handed to the
detector are deliberately left alone: both detectors label joints
anatomically — they work out which shoulder is the LEFT one from how the
body looks — and a mirrored person reads as having swapped sides, so the
labels come back inverted and the app paints the wrong arm red. The x
coordinate is flipped afterwards instead, in `viewPoint`, where it is one
subtraction and cannot be wrong about anatomy.

**2. Frame coordinates are not view coordinates.** Both previews fill the
view and therefore crop the frame's edges. A keypoint reported as a fraction
of the FRAME is not that fraction of the VIEW, and the difference is tens of
pixels — enough to hang a shoulder marker in mid-air. `viewPoint` on both
platforms undoes that crop with the same arithmetic. If one of them is ever
changed, the other has to change with it.

## Output

`onPose` fires at roughly `targetFps` (12 by default — past ~15 it is heat
and battery, not something a human can see in a skeleton). It fires with an
empty `points` array when nobody is found, which the UI is expected to say
out loud rather than freeze on the last good skeleton.

Each point carries a confidence. Low means guessed — off the edge of the
frame, or an arm hidden behind the body — and must never be drawn as if it
were a measurement.
