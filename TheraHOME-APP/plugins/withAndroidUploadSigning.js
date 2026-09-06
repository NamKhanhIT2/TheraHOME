const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with the Play upload key instead of the debug key.
 *
 * This has to be a config plugin rather than a hand edit: `expo prebuild`
 * regenerates `android/` from scratch, so anything written straight into
 * app/build.gradle is gone the next time the native config changes. Expo's
 * own template leaves `release` pointing at `signingConfigs.debug`, which
 * builds an installable APK but one Play rejects outright — the debug key is
 * a well-known shared key.
 *
 * The credentials themselves are NOT in this repo. They are read from Gradle
 * properties, which belong in ~/.gradle/gradle.properties (outside any repo,
 * never committed, survives prebuild):
 *
 *   THERAHOME_UPLOAD_STORE_FILE=/Users/<you>/Documents/TheraHOME-keystore/upload.jks
 *   THERAHOME_UPLOAD_KEY_ALIAS=therahome-upload
 *   THERAHOME_UPLOAD_STORE_PASSWORD=...
 *   THERAHOME_UPLOAD_KEY_PASSWORD=...
 *
 * When those properties are absent the config falls back to the debug key, so
 * a machine without the upload key (CI, another developer) still builds — it
 * just produces something that cannot be uploaded, which is the correct
 * outcome rather than a confusing failure.
 */
const RELEASE_CONFIG = `        release {
            storeFile file(project.findProperty('THERAHOME_UPLOAD_STORE_FILE') ?: 'debug.keystore')
            storePassword project.findProperty('THERAHOME_UPLOAD_STORE_PASSWORD') ?: 'android'
            keyAlias project.findProperty('THERAHOME_UPLOAD_KEY_ALIAS') ?: 'androiddebugkey'
            keyPassword project.findProperty('THERAHOME_UPLOAD_KEY_PASSWORD') ?: 'android'
        }
`;

const DEBUG_BLOCK = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;

// Anchored on the template's own comment so this can only ever match the
// `release` build type, never the `debug` one a few lines above it.
const RELEASE_BUILD_TYPE =
  `            // Caution! In production, you need to generate your own keystore file.\n` +
  `            // see https://reactnative.dev/docs/signed-apk-android.\n` +
  `            signingConfig signingConfigs.debug`;

module.exports = function withAndroidUploadSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (!gradle.includes('THERAHOME_UPLOAD_STORE_FILE')) {
      if (!gradle.includes(DEBUG_BLOCK)) {
        throw new Error(
          'withAndroidUploadSigning: the debug signingConfig block does not look the way this plugin expects. ' +
            'The Expo template changed — update the plugin rather than letting it silently sign with the debug key.',
        );
      }
      gradle = gradle.replace(DEBUG_BLOCK, DEBUG_BLOCK + RELEASE_CONFIG);
    }

    if (gradle.includes(RELEASE_BUILD_TYPE)) {
      gradle = gradle.replace(RELEASE_BUILD_TYPE, `            signingConfig signingConfigs.release`);
    } else if (!gradle.includes('signingConfig signingConfigs.release')) {
      throw new Error(
        'withAndroidUploadSigning: could not find the release build type to repoint at the upload key.',
      );
    }

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
