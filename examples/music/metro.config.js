const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solidnative/metro/solid-config.cjs');
const { withTailwind } = require('@solidnative/tailwind/config.cjs');
const path = require('node:path');

// The framework packages are workspace members, so their real files live under packages/ rather
// than inside this app's node_modules. An app installing from npm passes no options at all.
const config = withSolidNative(getDefaultConfig(__dirname), {
  workspaceRoot: path.resolve(__dirname, '../..'),
});

// Runs the Tailwind CLI over `styles.css`, and leaves it watching: a class written in a screen
// appears in the generated sheet, which Metro then treats as a changed module.
module.exports = withTailwind(config, { input: './src/styles.css' });
