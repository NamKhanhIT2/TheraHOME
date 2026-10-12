import ExpoModulesCore
import UIKit

// iOS does the whole job once monitoring is on: it blanks the screen when
// something is near the receiver and brings it back when it is not, and it
// ignores touches while blanked. All this module decides is WHEN that
// should be true, which is "while a call is connected".
//
// Must be turned off again when the call ends. A device left monitoring
// blanks its screen every time it goes near a face — in an app that is no
// longer in a call, that reads as a phone that has died.
public class TheraHomeProximityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TheraHomeProximity")

    // iPhones have the sensor; iPads do not. The only honest way to ask is
    // to switch it on and see whether it stayed on, so the check happens
    // where it is cheap — at the point of use.
    AsyncFunction("setEnabled") { (enabled: Bool) -> Bool in
      UIDevice.current.isProximityMonitoringEnabled = enabled
      return UIDevice.current.isProximityMonitoringEnabled == enabled
    }
    .runOnQueue(.main)

    // Stops the screen locking itself in the middle of a call.
    //
    // iOS dims and then locks after its idle timeout no matter what is on
    // screen, and a video call watched without touching anything hits that
    // timeout every time. Every caller disables the idle timer for the
    // duration; this is that.
    AsyncFunction("setKeepAwake") { (enabled: Bool) -> Bool in
      UIApplication.shared.isIdleTimerDisabled = enabled
      return UIApplication.shared.isIdleTimerDisabled == enabled
    }
    .runOnQueue(.main)

    // A reload, a crash recovery, or the app being torn down mid-call must
    // not leave the sensor armed or the screen pinned awake.
    OnDestroy {
      DispatchQueue.main.async {
        UIDevice.current.isProximityMonitoringEnabled = false
        UIApplication.shared.isIdleTimerDisabled = false
      }
    }
  }
}
