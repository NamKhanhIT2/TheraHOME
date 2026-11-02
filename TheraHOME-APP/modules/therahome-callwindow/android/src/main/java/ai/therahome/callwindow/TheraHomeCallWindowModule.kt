package ai.therahome.callwindow

import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JavaScript's half of picture-in-picture. The half that matters is in
 * CallWindow.kt, which explains why.
 *
 * Every function that touches the window runs on the main queue:
 * `enterPictureInPictureMode` and `setPictureInPictureParams` are Activity
 * calls, and Android throws if they arrive from the JS thread.
 */
class TheraHomeCallWindowModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TheraHomeCallWindow")

    Events("onPipChange")

    OnCreate {
      CallWindow.listener = { inPip -> sendEvent("onPipChange", mapOf("inPip" to inPip)) }
    }

    // A reload must not leave the app armed to shrink itself on the next
    // Home press, for a call that no longer exists.
    OnDestroy {
      CallWindow.listener = null
      CallWindow.armed = false
      CallWindow.sync(appContext.currentActivity)
    }

    Function("isSupported") {
      CallWindow.isSupported(appContext.currentActivity)
    }

    Function("isActive") {
      CallWindow.inPip
    }

    AsyncFunction("setArmed") { armed: Boolean, ratio: Double ->
      CallWindow.armed = armed
      CallWindow.ratio = ratio
      CallWindow.sync(appContext.currentActivity)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("enter") {
      CallWindow.enter(appContext.currentActivity)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("exit") {
      CallWindow.exit(appContext.currentActivity)
    }.runOnQueue(Queues.MAIN)
  }
}
