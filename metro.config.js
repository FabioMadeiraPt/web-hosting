// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [...config.resolver.assetExts, 'css'];
console.log('Asset Extensions:', config.resolver.assetExts);
console.log('Source Extensions:', config.resolver.sourceExts);
module.exports = config;
