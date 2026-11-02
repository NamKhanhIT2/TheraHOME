const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# [TheraHOME] select Debug prebuilt artifacts';

const SNIPPET = `
    ${MARKER}
    #
    # React Native ships its core, its C++ dependencies and Hermes as prebuilt
    # xcframeworks, and swaps in the Debug-flavoured artifact with a script
    # phase whose test is:
    #
    #   if echo $GCC_PREPROCESSOR_DEFINITIONS | grep -q "DEBUG=1"
    #
    # CocoaPods never puts DEBUG=1 on a pod target, so that test never fires
    # and a Debug build silently links the RELEASE artifacts. The Release core
    # carries no dev-support classes, so the app then fails to link with
    #
    #   Undefined symbol: _OBJC_CLASS_$_RCTPackagerConnection
    #   referenced from libexpo-dev-launcher.a
    #
    # which is what made the entire Debug configuration unbuildable, and with
    # it live reload. All three swap together on purpose — a Debug core
    # against a Release Hermes is not a combination anybody tests.
    %w[React-Core-prebuilt ReactNativeDependencies hermes-engine].each do |name|
      target = installer.pods_project.targets.find { |t| t.name == name }
      next if target.nil?
      target.build_configurations.each do |config|
        next unless config.name == 'Debug'
        defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs + ['DEBUG=1'] unless defs.join(' ').include?('DEBUG=1')
      end
    end
`;

/**
 * Makes a Debug build actually link React Native's Debug prebuilt artifacts.
 * See the comment in the injected snippet for what goes wrong without it.
 *
 * `ios/` is generated and gitignored here, so the Podfile edit has to be
 * reapplied on every prebuild rather than committed.
 */
const withIosPrebuiltDebugArtifacts = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');
      if (contents.includes(MARKER)) return cfg;

      // Append inside the existing post_install block, after
      // react_native_post_install's closing paren.
      const anchor = contents.lastIndexOf('    )\n  end\nend');
      if (anchor === -1) {
        throw new Error(
          'withIosPrebuiltDebugArtifacts: could not find the end of post_install in the Podfile. ' +
            'The Expo template changed — re-check where to inject before shipping a Debug build.',
        );
      }
      const insertAt = anchor + '    )\n'.length;
      fs.writeFileSync(podfile, contents.slice(0, insertAt) + SNIPPET + contents.slice(insertAt));
      return cfg;
    },
  ]);

module.exports = withIosPrebuiltDebugArtifacts;
