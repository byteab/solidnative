const { isSolidFile } = require('@solid-native/metro/solid-babel.cjs');

// Expo's development transform always enables React Refresh; native Solid files turn it off and
// reload cleanly instead (see solid-babel.cjs). React files keep it.
// `expo/internal/babel-preset` is Expo's own re-export of babel-preset-expo, which the app does
// not depend on directly.
const preset = require.resolve('expo/internal/babel-preset');

module.exports = {
  presets: [preset],
  overrides: [{ test: isSolidFile, presets: [[preset, { enableReactFastRefresh: false }]] }],
};
