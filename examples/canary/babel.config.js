const { isSolidFile } = require('@solidnative/metro/solid-babel.cjs');

// Expo's development transform always enables React Refresh; native Solid files turn it off and
// reload cleanly instead (see solid-babel.cjs). React files, the benchmark's included, keep it.
// `expo/internal/babel-preset` is Expo's own re-export of babel-preset-expo, which the app does
// not depend on directly.
const preset = require.resolve('expo/internal/babel-preset');
// The React Compiler, for the compiled React benchmarks only (`src/bench/react-compiled-*.tsx`): the
// app is Solid. Resolved through Expo's preset, which depends on it. `all_errors` fails the build
// rather than leave a component it could not compile as written.
const compiler = require.resolve('babel-plugin-react-compiler', { paths: [preset] });

module.exports = {
  presets: [preset],
  overrides: [
    { test: isSolidFile, presets: [[preset, { enableReactFastRefresh: false }]] },
    {
      test: (filename) => /src[\\/]bench[\\/]react-compiled-[^\\/]*\.tsx$/.test(filename ?? ''),
      plugins: [[compiler, { target: '19', panicThreshold: 'all_errors' }]],
    },
  ],
};
