const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve("react-native-get-random-values"),
  stream: require.resolve("stream-browserify"),
};

module.exports = config;
