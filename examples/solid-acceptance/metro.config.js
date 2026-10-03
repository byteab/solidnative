const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solid-native/metro/solid-config.cjs');
const { withTailwind } = require('@solid-native/tailwind/config.cjs');
const path = require('node:path');

// The starter's config plus two things: the workspace root, because the framework packages live
// under packages/ rather than in this app's node_modules (an app installed from npm passes no
// options), and Tailwind, which compiles `src/tailwind.css` into `.solid-native/app.tailwind.js`.
module.exports = withTailwind(
  withSolidNative(getDefaultConfig(__dirname), {
    workspaceRoot: path.resolve(__dirname, '../..'),
  }),
  { input: './src/tailwind.css' },
);
