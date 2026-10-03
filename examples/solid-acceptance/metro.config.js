const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solidnative/metro/solid-config.cjs');
const { withTailwind } = require('@solidnative/tailwind/config.cjs');
const path = require('node:path');

// The starter's config plus two things: the workspace root, because the framework packages live
// under packages/ rather than in this app's node_modules (an app installed from npm passes no
// options), and Tailwind, which compiles `src/tailwind.css` into `.solidnative/app.tailwind.js`.
module.exports = withTailwind(
  withSolidNative(getDefaultConfig(__dirname), {
    workspaceRoot: path.resolve(__dirname, '../..'),
  }),
  { input: './src/tailwind.css' },
);
