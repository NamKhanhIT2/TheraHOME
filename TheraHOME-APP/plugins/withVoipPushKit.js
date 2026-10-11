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

const REGISTRATION_CALL = '    RNVoipPushNotificationManager.voipRegistration()';

// Bumped whenever PUSHKIT_EXTENSION below changes. The generated
// AppDelegate.swift is only rewritten when the marker in it does not match,
// so an edit here reaches the next prebuild instead of being skipped as
// "already done" — which is how the first version of this plugin would have
// silently shipped stale native code forever.
const PUSHKIT_MARKER = '// MARK: - PushKit v2 (added by plugins/withVoipPushKit.js)';

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
    if (!contents.includes('voipRegistration()')) {
      const anchor = '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)';
      if (!contents.includes(anchor)) {
        throw new Error(
          'withVoipPushKit: could not find the didFinishLaunching return in AppDelegate.swift. '
          + 'The Expo template changed — re-check this plugin against the generated file.',
        );
      }
      contents = contents.replace(anchor, `${REGISTRATION_CALL}\n\n${anchor}`);
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
