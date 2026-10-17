package ai.therahome.pose

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Live body keypoints from the camera — the twin of
// ios/TheraHomePoseModule.swift, which carries the reasoning for why this
// module exists at all rather than a package off npm.
class TheraHomePoseModule : Module() {
  override fun definition() = ModuleDefinition {
    // The string `src/lib/pose.ts` guards on, identical on both platforms.
    // A guard on the wrong name is indistinguishable from a build without
    // the module (CLAUDE.md, "Guarding an optional native module").
    Name("TheraHomePose")

    Function("getPermissionStatus") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED
      ) {
        "granted"
      } else {
        // Android cannot tell "never asked" from "refused" without the
        // activity, and the caller does the same thing either way: ask, and
        // explain if the answer is no.
        "undetermined"
      }
    }

    AsyncFunction("requestPermission") { promise: expo.modules.kotlin.Promise ->
      val permissions = appContext.permissions
      if (permissions == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      permissions.askForPermissions({ result ->
        val granted = result[Manifest.permission.CAMERA]?.status == PermissionsStatus.GRANTED
        promise.resolve(granted)
      }, Manifest.permission.CAMERA)
    }

    View(PoseCameraView::class) {
      Events("onPose", "onPoseStatus")

      Prop("active") { view: PoseCameraView, active: Boolean ->
        view.isActive = active
      }

      Prop("facing") { view: PoseCameraView, facing: String ->
        view.facing = facing
      }

      Prop("targetFps") { view: PoseCameraView, fps: Double ->
        view.targetFps = fps
      }
    }
  }
}
