// Resolves @zebchat/react-native to ../src so library changes reload live, and keeps a single
// copy of react / react-native (the example's) even though the library has its own dev copies.
const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '..');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [root],
  resolver: {
    // The library's own node_modules (dev copies of react / react-native) stay invisible.
    blockList: [new RegExp(`^${escapeRegExp(path.join(root, 'node_modules'))}[\\\\/].*$`)],
    extraNodeModules: {
      '@zebchat/react-native': path.join(root, 'src'),
      react: path.join(__dirname, 'node_modules', 'react'),
      'react-native': path.join(__dirname, 'node_modules', 'react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
