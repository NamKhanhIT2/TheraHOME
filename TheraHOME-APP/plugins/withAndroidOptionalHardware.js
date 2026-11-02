const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Says out loud which hardware this app can do without, so Play stops
 * hiding it from devices that lack it.
 *
 * Play does not only read `<uses-feature>`; it INFERS requirements from
 * permissions. Asking for `CALL_PHONE` and `READ_PHONE_STATE` — which
 * CallKeep needs to put a call on the system call screen — reads to Play
 * as "this app needs a SIM", and it quietly removes every device without
 * one. Uploading 1.0.2 showed the bill for that:
 *
 *   Chromebook  77 → 0     (-100%)
 *   Ô tô        10 → 0     (-100%)
 *   Android XR   1 → 0     (-100%)
 *   TV           4 → 1     ( -75%)
 *   Tablets   6797 → 2736  ( -60%)
 *   Phones   12379 → 12078 (  -2%)
 *
 * 4,452 devices, and the shape of the loss is exactly "has no cellular
 * radio". The app does not need one: its calls are VoIP over LiveKit, and
 * the telephony permissions only buy the system call screen — which the
 * app already treats as optional (`isCallKeepSupported()` guards every
 * call into it, and `<IncomingCallSheet>` is the fallback when it is not
 * there). So the requirement is real to Play and false in fact.
 *
 * Bluetooth is here for the same reason and with better evidence:
 * `aapt2 dump badging` reports it as an IMPLIED feature outright —
 * "requested android.permission.BLUETOOTH permission ... and
 * targetSdkVersion > 4". It is used for routing call audio to a headset,
 * which is a nicety, not a requirement.
 *
 * Two more implied features are left REQUIRED on purpose. `aapt2 dump
 * badging` reports both:
 *
 *   android.hardware.microphone      requested RECORD_AUDIO
 *   android.hardware.screen.portrait one or more activities are portrait
 *
 * A device with no microphone cannot hold a conversation, and a
 * landscape-only screen (a TV, a car head unit) would get an app that is
 * locked to portrait. Letting those install would trade a device count
 * for a bad experience. They are also most of why TV, Ô tô and Chromebook
 * stay at zero after this change — telephony was never their only
 * problem, and this plugin is not claiming to bring them back. What it
 * brings back is tablets, which have a microphone and a portrait screen
 * and were excluded for nothing but the missing SIM.
 *
 * The camera pair is already declared `required="false"` by
 * modules/therahome-pose, which is where it belongs: the module that
 * wants the camera is the module that says it can live without it.
 *
 * Must be a config plugin, same reason as withCallkeepLabel: `expo
 * prebuild` regenerates android/ and would discard a hand edit.
 */
const OPTIONAL = [
  'android.hardware.telephony',
  'android.hardware.bluetooth',
];

const withAndroidOptionalHardware = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const features = manifest['uses-feature'] ?? [];
    for (const name of OPTIONAL) {
      const existing = features.find((feature) => feature.$?.['android:name'] === name);
      if (existing) {
        // Never promote one to required, and never leave the attribute
        // absent — absent means required.
        existing.$['android:required'] = 'false';
      } else {
        features.push({ $: { 'android:name': name, 'android:required': 'false' } });
      }
    }
    manifest['uses-feature'] = features;
    return config;
  });

module.exports = withAndroidOptionalHardware;
