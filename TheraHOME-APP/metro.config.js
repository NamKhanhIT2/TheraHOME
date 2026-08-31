const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

const config = getDefaultConfig(__dirname);

// Expo disables inlineRequires by default, which breaks Worklets' module
// init order ("Cannot read property 'loadUnpackers'/'createSerializableString'
// of undefined") — see https://github.com/software-mansion/react-native-reanimated/issues/9445
config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: true,
  },
});

module.exports = wrapWithReanimatedMetroConfig(config);
