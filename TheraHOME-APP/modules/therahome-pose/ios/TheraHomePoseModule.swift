import AVFoundation
import ExpoModulesCore

// Live body keypoints from the camera, for "am I doing this exercise right?"
//
// Why a module of our own rather than a package: nothing in the
// vision-camera ecosystem publishes support for React Native 0.86 / Expo
// SDK 57 (its v5 line states a 0.81 / Expo 54 floor), and this app has
// already lost a day to a third-party native library that linked fine and
// then failed at runtime under the New Architecture — see CLAUDE.md. The
// surface here is one view and one permission call, so owning it costs less
// than trusting it.
//
// iOS does this with Apple's Vision; Android with MediaPipe. Different
// models, deliberately — see the podspec. Both are reduced to the same
// eleven points in PoseCanonical.swift / Canonical.kt, and everything above
// compares ANGLES rather than coordinates, so the models' small
// disagreements about where exactly a shoulder is cancel out.
public class TheraHomePoseModule: Module {
  public func definition() -> ModuleDefinition {
    // The string `src/lib/pose.ts` guards on. Keep the two in step: a guard
    // on the wrong name is indistinguishable from a build without the
    // module — it silently switches the feature off and nothing logs
    // (CLAUDE.md, "Guarding an optional native module").
    Name("TheraHomePose")

    /// Whether the camera can be opened at all. Asking is not the same as
    /// having: `requestPermission` is what prompts.
    Function("getPermissionStatus") { () -> String in
      switch AVCaptureDevice.authorizationStatus(for: .video) {
      case .authorized: return "granted"
      case .denied, .restricted: return "denied"
      default: return "undetermined"
      }
    }

    /// Prompts once. iOS only ever shows the dialog the first time; after a
    /// refusal this resolves `false` immediately and the caller is expected
    /// to send the customer to Settings rather than ask again.
    AsyncFunction("requestPermission") { (promise: Promise) in
      AVCaptureDevice.requestAccess(for: .video) { granted in
        promise.resolve(granted)
      }
    }

    View(PoseCameraView.self) {
      Events("onPose", "onPoseStatus")

      Prop("active") { (view: PoseCameraView, active: Bool) in
        view.isActive = active
      }

      Prop("facing") { (view: PoseCameraView, facing: String) in
        view.facing = facing
      }

      Prop("targetFps") { (view: PoseCameraView, fps: Double) in
        view.targetFps = fps
      }
    }
  }
}
