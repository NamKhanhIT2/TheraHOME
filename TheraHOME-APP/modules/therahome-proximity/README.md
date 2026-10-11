# therahome-proximity

Blanks the screen while the phone is held to the ear, and unblanks it when
it comes away. Twenty lines of native code per platform, and no JavaScript
can do it: both platforms expose it only to native.

**Why a module of our own rather than a package.** The packages that do this
are unmaintained and old-architecture only, and this app has already lost a
day to a third-party calling library that loaded fine and then failed at
runtime under the New Architecture. The whole surface here is one boolean,
so owning it costs less than trusting it.

**It is not a sensor reading.** Neither platform is asked "how far away is
your face"; both are told "a call is in progress, do your thing":

- iOS: `UIDevice.isProximityMonitoringEnabled`. iOS blanks and unblanks.
- Android: a `PROXIMITY_SCREEN_OFF_WAKE_LOCK`, the same lock the system
  dialer uses. Android blanks and unblanks.

Doing it by hand off a raw sensor value would mean fighting the OS for
control of the screen, and getting it wrong means a phone that cannot be
woken mid-call.

Used from `src/lib/proximity.ts`. Local Expo module: autolinked from
`modules/` with no entry in package.json, so there is nothing to install.
