const { withXcodeProject } = require('expo/config-plugins');

/**
 * Turns off Xcode 16's "debug dylib" split for the iOS app target.
 *
 * With it on, a Debug build links the app's own code into a separate
 * `TheraHOME.debug.dylib`, and on this project that link step fails:
 *
 *   cannot link directly with 'SwiftUICore' because product being built
 *   is not an allowed client of it
 *   ld: symbol(s) not found for architecture arm64
 *
 * The damage is quiet. `xcodebuild` reports the error, but a partially
 * written `.app` is left behind with no dylib inside it, and installing that
 * gives a binary that dies on launch with
 * `Library not loaded: @rpath/TheraHOME.debug.dylib` — which reads like a
 * packaging bug, not a build failure. That is exactly what the 2026-10-17
 * Debug build in DerivedData was, and why it could not be used.
 *
 * Switching the feature off puts the app's code back in the main binary,
 * which is where it was before Xcode 16. Release builds never used it.
 */
const withIosNoDebugDylib = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (typeof entry !== 'object' || !entry.buildSettings) continue;
      if (entry.name !== 'Debug') continue;
      entry.buildSettings.ENABLE_DEBUG_DYLIB = 'NO';
    }
    return cfg;
  });

module.exports = withIosNoDebugDylib;
