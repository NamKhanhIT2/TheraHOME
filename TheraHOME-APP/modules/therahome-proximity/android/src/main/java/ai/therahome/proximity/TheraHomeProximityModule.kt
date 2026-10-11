package ai.therahome.proximity

import android.content.Context
import android.os.PowerManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// PROXIMITY_SCREEN_OFF_WAKE_LOCK is the same mechanism the system dialer
// uses: Android itself blanks the screen while something is near the sensor
// and restores it when it is not, and swallows touches in between. Reading
// the raw sensor and trying to black out a View instead would be fighting
// the OS for the screen, and losing that fight means a phone the user
// cannot wake in the middle of a call.
//
// Not every device supports the lock level — `isWakeLockLevelSupported` is
// the documented way to ask, and tablets and some cheap handsets say no.
// The call carries on without it rather than failing.
private const val TAG = "TheraHOME:proximity"

class TheraHomeProximityModule : Module() {
  private var wakeLock: PowerManager.WakeLock? = null

  private val powerManager: PowerManager
    get() {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      return context.getSystemService(Context.POWER_SERVICE) as PowerManager
    }

  override fun definition() = ModuleDefinition {
    Name("TheraHomeProximity")

    AsyncFunction("setEnabled") { enabled: Boolean ->
      if (enabled) acquire() else release()
    }

    // A reload or a teardown mid-call must not leave the lock held: the
    // screen would keep blanking for an app that is no longer in a call.
    OnDestroy {
      release()
    }
  }

  private fun acquire(): Boolean {
    if (wakeLock?.isHeld == true) return true
    val manager = powerManager
    if (!manager.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) {
      return false
    }
    val lock = manager.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, TAG)
    lock.setReferenceCounted(false)
    lock.acquire()
    wakeLock = lock
    return true
  }

  private fun release(): Boolean {
    val lock = wakeLock ?: return true
    wakeLock = null
    if (lock.isHeld) {
      // WAIT_FOR_NO_PROXIMITY keeps the screen off until the phone actually
      // comes away from the ear. Releasing without it lights the screen up
      // against the user's cheek the instant the call ends, which is both
      // startling and a way to hang up the NEXT call by accident.
      lock.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY)
    }
    return true
  }
}
