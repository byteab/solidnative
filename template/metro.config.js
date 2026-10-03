const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solid-native/metro/solid-config.cjs');

// Registers the transformer that compiles Solid's JSX into native renderer calls, compiles each
// `.native.css` import into the sheet the engine reads, and resolves `solid-js` to its client
// build. No options: the framework packages are ordinary dependencies here.
module.exports = withSolidNative(getDefaultConfig(__dirname));
