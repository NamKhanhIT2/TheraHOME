module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last in the plugins array — react-native-reanimated 4 moved
    // its worklets transform into this package.
    plugins: ['react-native-worklets/plugin'],
  };
};
