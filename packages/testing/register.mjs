/**
 * `node --import @solid-native/testing/register --test "src/**\/*.test.ts"`: compiles an app for
 * Node's own test runner the way Metro compiles it for a device. See `compile.mjs` for what that
 * covers. Synchronous hooks, so `require(esm)` and both export-condition modes go through them.
 *
 * `__DEV__` is true, as Metro's prelude defines it in a development bundle, because app code
 * reads it bare.
 */
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STAND_INS, compile, solidRuntime } from './compile.mjs';

globalThis.__DEV__ ??= true;

const runtime = solidRuntime();
/** The app's own files and solid-native's packages; any other installed package is left as it is. */
const ours = (filename) =>
  !/[\\/]node_modules[\\/]/.test(filename) ||
  /[\\/]node_modules[\\/]@solid-native[\\/]/.test(filename);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const file = Object.hasOwn(STAND_INS, specifier)
      ? STAND_INS[specifier]
      : runtime.resolve(specifier);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.startsWith('file:')) return nextLoad(url, context);
    const filename = fileURLToPath(url);
    if (/\.(?:[mc]?[jt]sx?|css)$/.test(filename) && ours(filename)) {
      const compiled = compile(readFileSync(filename, 'utf8'), filename);
      if (compiled) {
        const map = compiled.map
          ? `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(compiled.map)).toString('base64')}`
          : '';
        return {
          format: compiled.typescript ? 'module-typescript' : 'module',
          source: compiled.code + map,
          shortCircuit: true,
        };
      }
    }
    // An app's TypeScript is ES modules, which a package.json without `"type"` leaves Node to
    // guess, with a warning on every file.
    if (/\.ts$/.test(filename) && !/[\\/]node_modules[\\/]/.test(filename))
      return nextLoad(url, { ...context, format: 'module-typescript' });
    return nextLoad(url, context);
  },
});
