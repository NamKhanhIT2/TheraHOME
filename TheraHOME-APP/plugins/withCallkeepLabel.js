const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Renames CallKeep's ConnectionService from "Wazo" to TheraHOME.
 *
 * `@config-plugins/react-native-callkeep` hardcodes `android:label="Wazo"` on
 * the VoiceConnectionService — the upstream source even carries a `TODO:
 * Update item` next to it — and exposes no option to change it. That label is
 * not internal: Android shows it to the user in Settings → Apps → Default
 * apps → Calling accounts, which is exactly where someone goes to enable the
 * phone account this feature depends on. Being asked to switch on a calling
 * account called "Wazo" inside a rehab app is the kind of thing that gets an
 * app reported rather than enabled.
 *
 * Must be a config plugin, because `expo prebuild` regenerates android/ from
 * scratch and would discard a hand edit on the next native config change.
 *
 * LISTED BEFORE the CallKeep plugin in app.json, which reads backwards and is
 * not a mistake: Expo composes manifest mods by wrapping, so the one
 * registered LAST runs FIRST. Listing this after CallKeep — the intuitive
 * order — ran it against an <application> that still had no <service> at all.
 */
const withCallkeepLabel = (config) => {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    const services = application?.service;
    if (!Array.isArray(services)) {
      throw new Error(
        'withCallkeepLabel: no <service> array on <application>. Saw keys: ' +
        JSON.stringify(Object.keys(application || {})),
      );
    }

    const connectionService = services.find(
      (service) => service.$?.['android:name'] === 'io.wazo.callkeep.VoiceConnectionService',
    );
    // Absent means the CallKeep plugin did not run — ordering changed, or the
    // package was removed. Say so loudly rather than silently shipping a
    // build whose calling account is still called Wazo.
    if (!connectionService) {
      throw new Error(
        'withCallkeepLabel: VoiceConnectionService not found in the manifest. ' +
        'It must be listed AFTER @config-plugins/react-native-callkeep in app.json plugins.',
      );
    }
    connectionService.$['android:label'] = 'TheraHOME';
    return config;
  });
};

module.exports = withCallkeepLabel;
