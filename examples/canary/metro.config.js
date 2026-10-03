const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solid-native/metro/solid-config.cjs');
const { withTailwind } = require('@solid-native/tailwind/config.cjs');
const path = require('node:path');

// The framework packages are workspace members, so their real files live under packages/ rather
// than inside this app's node_modules. An app installing from npm passes no options at all.
const config = withTailwind(
  withSolidNative(getDefaultConfig(__dirname), {
    workspaceRoot: path.resolve(__dirname, '../..'),
  }),
  { input: './src/tailwind.css' },
);

// The renderer benchmark's instrument. A polyfill because it has to wrap `nativeFabricUIManager`
// before React Native's core loads the Fabric renderer, which copies the methods off it; see
// src/bench/instrument.js. Only in a benchmark build, and it costs nothing in any other.
if (process.env.EXPO_PUBLIC_BENCH) {
  // Metro's transform cache does not key on the environment, so a side's inlined
  // EXPO_PUBLIC_BENCH would otherwise be reused for the other side's bundle.
  config.cacheVersion = `${config.cacheVersion ?? ''}-bench-${process.env.EXPO_PUBLIC_BENCH}`;
  const polyfills = config.serializer.getPolyfills;
  config.serializer.getPolyfills = (options) => [
    ...polyfills(options),
    path.resolve(__dirname, 'src/bench/instrument.js'),
  ];
}

module.exports = config;
