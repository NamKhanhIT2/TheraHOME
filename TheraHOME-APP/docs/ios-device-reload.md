# Putting a change on the iPhone

There is no Metro and no Fast Refresh in this loop. The phone carries a
**Release build**: the JavaScript lives inside the `.app` as Hermes
bytecode (`main.jsbundle`), compiled at build time. Nothing on the device
is listening for a reload, so "reload" means rebuilding that one file and
reinstalling the app.

Two paths. Pick by what changed.

---

## 1. JS / TypeScript / assets → `scripts/ios-device-reload.sh`

```bash
npx tsc --noEmit && ./scripts/ios-device-reload.sh
```

~40 seconds. What it does, in order:

1. `npx expo export:embed --platform ios --dev false --entry-file node_modules/expo-router/entry.js` → a plain JS bundle + an assets tree.
2. Copies the last Xcode-built `.app` to a temp dir.
3. `ios/Pods/hermes-engine/destroot/bin/hermesc -emit-binary -O` → overwrites `main.jsbundle` inside that copy, **then checks the first four bytes are `c6 1f bc 03`**. Hermes can fail and leave the plain JS behind; the app then white-screens with no error anywhere, so this is checked rather than assumed.
4. Copies the generated asset tree into the app's `assets/` root. Expo's
   export already includes its leading `assets/` or `node_modules/` segment;
   copying into `assets/assets/` adds an extra directory and makes newly-added
   files invisible to React Native at runtime.
5. `codesign --force --sign <Apple Development identity> --entitlements scripts/therahome-dev.entitlements`.
6. `xcrun devicectl device install app` + `process launch`.
7. Waits 6 seconds and **verifies the process is still alive**. A crash on launch is indistinguishable from success up to step 6 — `install` and `launch` both report success for an app that dies immediately.

Overridable by environment variable: `DEVICE`, `IDENTITY`, `BASE_APP`, `ENTITLEMENTS`.

### Things that bite

- **`--sign -` (ad-hoc) installs nowhere.** It must be the Apple Development identity: `security find-identity -v -p codesigning`.
- **The process list shows the executable path**, `.../TheraHOME.app/TheraHOME` — never the bundle id. Grepping for `ai.therahome` reports a healthy app as dead.
- **Never put another command after a build whose exit status matters.** `xcodebuild … ; echo; tail log` returns `tail`'s status, so a failed build reads as a success. That cost a full debugging session once: the log said `** BUILD FAILED **` while the tool reported OK.
- The device drops to `unavailable` when it locks or sleeps. `xcrun devicectl list devices` shows it; unlock the phone and retry.

---

## 2. Anything native → a real build

New native module, `app.json` plugins, `Info.plist`, entitlements, icons,
splash, a version/build-number bump, `pod install`. The bundle swap
**cannot** carry these: it only ever replaces `main.jsbundle` and assets.

```bash
LANG=en_US.UTF-8 xcodebuild \
  -workspace ios/TheraHOME.xcworkspace \
  -scheme TheraHOME \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=8RB28GV7QT \
  build
```

The result lands in
`~/Library/Developer/Xcode/DerivedData/TheraHOME-*/Build/Products/Release-iphoneos/TheraHOME.app`,
which is exactly what `scripts/ios-device-reload.sh` then copies on every
run (`BASE_APP`). Install it the same way:

```bash
xcrun devicectl device install app --device "$DEVICE" <that .app>
```

`ios/` is **gitignored** and `npx expo prebuild` regenerates it, which is
why `scripts/therahome-dev.entitlements` lives in `scripts/` and not in
`ios/build/`. After any prebuild, re-run the xcodebuild above before using
the reload script — the `.app` it copies will be gone.

TestFlight is a different flow again (archive → exportArchive → altool);
it is not this, and it is not run unless the owner asks for a build.

---

## 3. Why not Expo Go or a dev client

Both would give real Fast Refresh, and for pure-JS work a dev client is the
better loop. They are not used here because this app's native side —
`modules/therahome-pose`, CallKit/PushKit, LiveKit, HealthKit,
`react-native-iap`, native Google Sign-In — does not run in Expo Go, and
the owner reviews on a build that behaves exactly like the shipped one.
A dev client is still a fair option for a long UI session: build it once
with `npm run build:ios:development`, then `npx expo start --dev-client`.
