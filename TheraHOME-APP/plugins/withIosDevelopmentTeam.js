const { withXcodeProject } = require('expo/config-plugins');

/**
 * Writes the signing team into the generated Xcode project.
 *
 * `expo prebuild` regenerates `ios/` from scratch, and the team is a setting
 * Xcode stores in `project.pbxproj` — so every prebuild wiped it and the next
 * build died with
 *
 *   error: Signing for "TheraHOME" requires a development team.
 *
 * It had never bitten before because `ios/` had not been regenerated since
 * somebody set it by hand in Xcode. The first prebuild of 2026-10-25 (adding
 * HealthKit) lost it, and nothing in the repo remembered it.
 *
 * The team id is public — it is in every build's entitlements and in the
 * App Store listing — so it belongs in the repo rather than in one person's
 * Xcode preferences.
 */
const TEAM_ID = '8RB28GV7QT';

const withIosDevelopmentTeam = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (typeof entry !== 'object' || !entry.buildSettings) continue;
      // Pods targets sign themselves off the app's settings; only the app
      // target carries a team.
      if (!entry.buildSettings.PRODUCT_BUNDLE_IDENTIFIER) continue;
      entry.buildSettings.DEVELOPMENT_TEAM = TEAM_ID;
      entry.buildSettings.CODE_SIGN_STYLE = 'Automatic';
    }
    // The target section keeps its own copy, which is what Xcode's UI reads.
    const targets = project.pbxNativeTargetSection();
    for (const key of Object.keys(targets)) {
      const target = targets[key];
      if (typeof target !== 'object' || !target.name) continue;
      project.addTargetAttribute('DevelopmentTeam', TEAM_ID, target);
    }
    return cfg;
  });

module.exports = withIosDevelopmentTeam;
