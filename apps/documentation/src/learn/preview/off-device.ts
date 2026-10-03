/**
 * A Vitest setup file: React Native is not there, as it is not in the preview.
 *
 * `@solidnative/device` asks `require('react-native')` for each capability when it has a
 * `require`, and takes `null` to mean "not on a device", where every capability does nothing.
 * Vitest gives modules a `require`, which would load React Native's Flow source and fail to parse
 * it, so it is answered with `null` here, as `frame.ts` answers it in the page.
 */
import { registerHooks } from 'node:module';

const ABSENT = 'learn:react-native-absent';

registerHooks({
  resolve: (specifier, context, next) =>
    specifier === 'react-native' ? { url: ABSENT, shortCircuit: true } : next(specifier, context),
  load: (url, context, next) =>
    url === ABSENT
      ? { format: 'commonjs', source: 'module.exports = null;', shortCircuit: true }
      : next(url, context),
});
