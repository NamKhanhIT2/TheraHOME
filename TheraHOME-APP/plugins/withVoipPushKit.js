const { withAppDelegate, withDangerousMod, withInfoPlist } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Wires PushKit into the iOS app so a locked iPhone can ring.
 *
 * `react-native-voip-push-notification` ships no Expo config plugin, and the
 * work it needs cannot be done from JS: PushKit is registered by the
 * AppDelegate, and the delegate callbacks arrive there before any React code
 * is running. `expo prebuild` regenerates AppDelegate.swift every time the
 * native config changes, so this has to be a plugin rather than an edit.
 *
 * THE RULE APPLE ENFORCES, and the reason the code below is shaped the way
 * it is: every VoIP push MUST report an incoming call to CallKit, in the same
 * callback, before the completion handler runs. An app that takes a VoIP push
 * without doing so is killed, and after a few offences iOS stops delivering
 * VoIP pushes to it at all. So `reportNewIncomingCall` is called FIRST,
 * unconditionally, from data carried in the payload — never after an await,
 * never conditionally on JS being alive.
 *
 * Three edits, each idempotent so re-running prebuild is safe:
 *   1. the bridging header gains the two ObjC headers Swift needs
 *   2. AppDelegate registers for PushKit and conforms to PKPushRegistryDelegate
 *   3. Info.plist gains the `voip` background mode
 */

const BRIDGING_IMPORTS = [
  '#import <RNVoipPushNotification/RNVoipPushNotificationManager.h>',
  '#import "RNCallKeep.h"',
];

// Runs at the TOP of didFinishLaunching, before React Native is started.
//
// Measured over a full QA session on 2026-10-15, build 42: an incoming call
// delivered its VoIP push to the device, callservicesd took a
// CSDVoIPProcessAssertion on the app — and callservicesd never saw a single
// reportNewIncomingCall. Zero, across every call of the session, while the
// same app answered fine from its own in-app sheet.
//
// What that ruled OUT matters as much as what it pointed to. Forcing the app
// to relaunch and watching an unfiltered device log showed CallKit being set
// up correctly every time:
//
//   11:01:59.035  app launches
//   11:01:59.313  Registering client process ... for PushKit voip
//   11:01:59.316  Delivering voip token ... to application
//   11:01:59.807  CXCallSource registerWithConfiguration
//
// So PushKit registration, the VoIP token and the CXProvider were all fine.
// The delegate was reached too — a token cannot arrive otherwise.
//
// The 3ms between registering and the token is the clue. The registry the
// library creates is a local inside a dispatch_async block (see the long
// comment on `voipRegistry` below); it lives long enough for the token
// callback that fires immediately, and is gone by the time a call arrives
// seconds later. So the app registers, is woken for the push, and has no live
// registry to hand it to.
//
// Two things therefore happen here, both before React Native starts:
//
//   1. `startVoipRegistry()` creates the registry and KEEPS it.
//   2. `seedCallKeepProviderSettings()` makes sure RNCallKeep can build a
//      CXProvider on a launch where no JS has run yet.
const LAUNCH_PRELUDE = `    seedCallKeepProviderSettings()
    startVoipRegistry()`;

// Bumped whenever PUSHKIT_EXTENSION below changes. The generated
// AppDelegate.swift is only rewritten when the marker in it does not match,
// so an edit here reaches the next prebuild instead of being skipped as
// "already done" — which is how the first version of this plugin would have
// silently shipped stale native code forever.
const PUSHKIT_MARKER = '// MARK: - PushKit v4 (added by plugins/withVoipPushKit.js)';

const PUSHKIT_EXTENSION = `
${PUSHKIT_MARKER}
//
// Apple requires that every VoIP push report an incoming call to CallKit
// immediately, in this callback, before completion() runs. Failing to do so
// gets the app killed and eventually gets VoIP pushes withheld altogether.
// That is why the payload carries everything needed to describe the call:
// there is no time here to ask a server anything.
//
// A CANCEL push is the same rule with a twist. "Stop ringing" is still a
// VoIP push and still owes CallKit a reported call, so it reports one and
// ends it in the same breath. iOS shows nothing when the two happen
// together, and the phone stops ringing — which is the whole point: when
// the app is closed and the screen is locked, nothing else can take down a
// call screen the system is drawing.
extension AppDelegate: PKPushRegistryDelegate {
  func pushRegistry(
    _ registry: PKPushRegistry,
    didUpdate pushCredentials: PKPushCredentials,
    for type: PKPushType
  ) {
    RNVoipPushNotificationManager.didUpdate(pushCredentials, forType: type.rawValue as String)
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    let data = payload.dictionaryPayload
    let callId = (data["callId"] as? String) ?? UUID().uuidString
    let callerName = (data["callerName"] as? String) ?? "TheraHOME"
    let hasVideo = (data["hasVideo"] as? Bool) ?? false
    let isCancel = (data["cancel"] as? Bool) ?? false
    // 2 = remote ended, 4 = answered on another device. Only affects the
    // label iOS writes into the phone's own call history.
    let cancelReason = (data["cancelReason"] as? Int) ?? 2

    // A cancel for a call THIS device already answered would be a disaster:
    // reporting a duplicate uuid fails, and the end that follows would hang
    // up a conversation in progress. The server already excludes whoever
    // answered, so this is the second line of defence — and if it ever
    // fires, skipping Apple's reporting rule once is the cheaper mistake.
    if isCancel && RNCallKeep.isCallActive(callId) {
      completion()
      return
    }

    // FIRST, and unconditionally.
    RNCallKeep.reportNewIncomingCall(
      callId,
      handle: callerName,
      handleType: "generic",
      hasVideo: hasVideo,
      localizedCallerName: callerName,
      supportsHolding: false,
      supportsDTMF: false,
      supportsGrouping: false,
      supportsUngrouping: false,
      fromPushKit: true,
      payload: data,
      withCompletionHandler: nil
    )

    if isCancel {
      RNCallKeep.endCall(withUUID: callId, reason: Int32(cancelReason))
      completion()
      return
    }

    // Then hand the payload to JS, which picks it up once the app is running.
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue as String)
    completion()
  }
}

/// The VoIP registry, retained for the life of the process.
///
/// \`RNVoipPushNotificationManager.voipRegistration()\` — what this replaces —
/// creates its PKPushRegistry as a LOCAL inside a dispatch_async block and
/// stores it nowhere:
///
///     dispatch_async(mainQueue, ^{
///         PKPushRegistry * voipRegistry = [[PKPushRegistry alloc] initWithQueue: mainQueue];
///         voipRegistry.delegate = (RNVoipPushNotificationManager *)RCTSharedApplication().delegate;
///         voipRegistry.desiredPushTypes = [NSSet setWithObject:PKPushTypeVoIP];
///     });
///
/// Under ARC that object is released as soon as the block returns, and a
/// PKPushRegistry nobody holds stops delivering. The measurements fit exactly:
/// iOS hands the token back about 3ms after \`desiredPushTypes\` is set, so
/// \`didUpdate\` always lands — the token reached the app on every launch — while
/// an incoming push arriving seconds or minutes later found no live registry.
/// From the outside that looks like the system waking the app for a call it
/// then ignores: APNs delivered, \`CSDVoIPProcessAssertion\` taken, and no
/// \`reportNewIncomingCall\` ever reaching callservicesd, which is what was
/// measured on 2026-10-15 across an entire QA session.
///
/// It also explains the intermittency, which a plain "never registered" would
/// not: an object whose last reference has gone can still be alive for a while.
private var voipRegistry: PKPushRegistry?

extension AppDelegate {
  /// Registers for VoIP pushes and KEEPS the registry.
  ///
  /// The library's own state machine is left out of the loop deliberately:
  /// calling its \`voipRegistration()\` as well would stand up a second
  /// registry. JS does not lose anything by it — the token still reaches the
  /// \`register\` event through \`RNVoipPushNotificationManager.didUpdate\` in the
  /// delegate above, which is the same path it always used.
  func startVoipRegistry() {
    guard voipRegistry == nil else { return }
    let registry = PKPushRegistry(queue: .main)
    registry.delegate = self
    registry.desiredPushTypes = [.voIP]
    voipRegistry = registry
  }

  /// Makes sure RNCallKeep can build a CXProvider before any JS has run.
  ///
  /// \`RNCallKeep.reportNewIncomingCall\` — the call above, the one Apple
  /// requires — ends in \`initCallKitProvider\`:
  ///
  ///     if (sharedProvider == nil) {
  ///         NSDictionary *settings = [self getSettings];
  ///         if (settings != nil) { sharedProvider = ...; }
  ///     }
  ///     [sharedProvider reportNewIncomingCallWithUUID:...];
  ///
  /// \`getSettings\` reads the dictionary that JS's \`setup()\` writes into
  /// NSUserDefaults. On a launch caused by a VoIP push no JS has run yet, and
  /// if that key is absent \`sharedProvider\` stays nil — at which point
  /// reporting the call is a message to nil. It does not throw, does not log
  /// and does not ring, which is exactly the silence measured on the lock
  /// screen: the push arrived, the process was woken, and callservicesd never
  /// saw a provider or a call.
  ///
  /// Seeding the key removes the dependency on JS having run. \`appName\` is the
  /// only field \`getProviderConfiguration\` requires and it matches what
  /// \`src/lib/callkeep.ts\` passes, so a later \`setup()\` overwrites this with an
  /// identical value rather than fighting it. Written only when missing, so a
  /// real configuration is never clobbered.
  func seedCallKeepProviderSettings() {
    let key = "RNCallKeepSettings"
    guard UserDefaults.standard.dictionary(forKey: key) == nil else { return }
    UserDefaults.standard.set(["appName": "TheraHOME"], forKey: key)
  }
}
`;

const withBridgingHeader = (config) =>
  withDangerousMod(config, ['ios', (config) => {
    const header = path.join(
      config.modRequest.platformProjectRoot,
      'TheraHOME',
      'TheraHOME-Bridging-Header.h',
    );
    if (!fs.existsSync(header)) {
      throw new Error(`withVoipPushKit: bridging header not found at ${header}`);
    }
    let contents = fs.readFileSync(header, 'utf8');
    for (const line of BRIDGING_IMPORTS) {
      if (!contents.includes(line)) contents += `${line}\n`;
    }
    fs.writeFileSync(header, contents);
    return config;
  }]);

const withPushKitAppDelegate = (config) =>
  withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('import PushKit')) {
      contents = contents.replace('import React', 'import React\nimport PushKit');
    }

    // Registering at launch is what makes iOS hand us a PushKit token; without
    // it the app has no VoIP token and no push can ever reach it.
    if (!contents.includes('startVoipRegistry()')) {
      // FIRST statement of didFinishLaunching, not the last. See LAUNCH_PRELUDE
      // for what being late costs.
      const anchor = '    let delegate = ReactNativeDelegate()';
      if (!contents.includes(anchor)) {
        throw new Error(
          'withVoipPushKit: could not find the start of didFinishLaunching in AppDelegate.swift. '
          + 'The Expo template changed — re-check this plugin against the generated file.',
        );
      }
      contents = contents.replace(anchor, `${LAUNCH_PRELUDE}\n\n${anchor}`);
    }

    // Replace rather than skip: an AppDelegate carrying an OLDER version of
    // this extension has to be brought up to date, or a change here would
    // never reach a device. The extension is always the last thing in the
    // file, so cutting from its marker to the end is exact.
    if (!contents.includes(PUSHKIT_MARKER)) {
      const previous = contents.indexOf('// MARK: - PushKit');
      if (previous !== -1) contents = contents.slice(0, previous).trimEnd() + '\n';
      else if (contents.includes('PKPushRegistryDelegate')) {
        throw new Error(
          'withVoipPushKit: AppDelegate.swift already conforms to PKPushRegistryDelegate '
          + 'but carries no marker this plugin recognises. Remove the extension by hand, '
          + 'or the app will have two of them and will not compile.',
        );
      }
      contents += PUSHKIT_EXTENSION;
    }

    config.modResults.contents = contents;
    return config;
  });

const withVoipBackgroundMode = (config) =>
  withInfoPlist(config, (config) => {
    const modes = config.modResults.UIBackgroundModes ?? [];
    // `audio` is already there for the call itself; `voip` is what lets
    // PushKit wake the app.
    if (!modes.includes('voip')) modes.push('voip');
    config.modResults.UIBackgroundModes = modes;
    return config;
  });

module.exports = (config) =>
  withVoipBackgroundMode(withPushKitAppDelegate(withBridgingHeader(config)));
