// Metro configuration for Expo.
// The two resolver tweaks below are required so the Firebase JS SDK (v9+)
// resolves correctly under Metro and we don't hit the
// "Component auth has not been registered yet" runtime error.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
