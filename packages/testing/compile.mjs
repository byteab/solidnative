/**
 * What `@solid-native/testing/register` and `@solid-native/testing/vitest` share: compiling a module the
 * way Metro compiles it for a device, with `@solid-native/metro`'s own Solid and CSS transforms.
 *
 * - Solid TSX (`.solid.tsx`, or the `@jsxImportSource @solid-native/platform/solid` pragma) through
 *   the universal native JSX transform.
 * - `.native.css` into stylesheet data.
 * - `solid-js` to its client build, which Node's own `node`/`worker` conditions would otherwise
 *   replace with the server one.
 * - `require('./logo.png')` and the other asset requires to `{ testUri }`, as React Native's Jest
 *   preset does: a test has no Metro asset registry, and an ES module no `require`.
 * - The native gesture and animation libraries, whose React Native source Node cannot load, to the
 *   stand-ins in `src/` (`STAND_INS`), including the internals `@solid-native/components/gestures` and
 *   `/reanimated` `require` by path, which become imports.
 *
 * The platform the stylesheets compile for is `SOLID_NATIVE_PLATFORM` (`ios` by default); `render()`'s
 * `platform` option picks the view names and component defaults.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSolidRuntime } from '@solid-native/metro/solid-runtime.cjs';
import { isSolidSource, transformSolid } from '@solid-native/metro/solid-transform.cjs';
import { isNativeCss, transformNativeCss } from '@solid-native/metro/solid-css.cjs';

export { isNativeCss };

export const platform = process.env.SOLID_NATIVE_PLATFORM === 'android' ? 'android' : 'ios';

/** The source in the workspace, the built copy once published (which ships `dist`, not `src`). */
const source = (file) => {
  const typescript = fileURLToPath(new URL(`./src/${file}`, import.meta.url));
  return existsSync(typescript)
    ? typescript
    : fileURLToPath(new URL(`./dist/${file.replace(/\.ts$/, '.js')}`, import.meta.url));
};
const internals = source('native-internals.ts');
const gestures = 'react-native-gesture-handler/src/handlers/gestures';

/** Specifier -> the file a test gets in its place. */
export const STAND_INS = {
  'react-native-gesture-handler': source('gesture-handler.ts'),
  'react-native-reanimated': source('reanimated-library.ts'),
  'react-native-worklets': source('worklets-library.ts'),
  [`${gestures}/GestureDetector/attachHandlers.ts`]: internals,
  [`${gestures}/GestureDetector/dropHandlers.ts`]: internals,
  [`${gestures}/gestureStateManager.ts`]: internals,
  'react-native-gesture-handler/src/init.ts': internals,
  'react-native-reanimated/src/core.ts': internals,
  'react-native-reanimated/src/updateProps/index.ts': internals,
};

/** The app's own `solid-js`, or failing that the one this package resolves. */
export function solidRuntime(root = process.cwd()) {
  try {
    return createSolidRuntime(root);
  } catch {
    return createSolidRuntime(fileURLToPath(new URL('.', import.meta.url)));
  }
}

const ASSET =
  /\brequire\(\s*(['"])([^'"]+\.(?:png|jpe?g|gif|webp|bmp|svg|ttf|otf|mp3|mp4|wav|m4a|mov))\1\s*\)/g;
const STAND_IN_REQUIRE = /\brequire\(\s*(['"])([^'"]+)\1\s*\)/g;

/** Asset requires to `{ testUri }`, and stand-in requires to imports hoisted onto line one. */
function rewriteRequires(code, assets = true) {
  const imports = [];
  const stubbed = assets
    ? code.replace(ASSET, (_, _quote, asset) => `({ testUri: ${JSON.stringify(asset)} })`)
    : code;
  const rewritten = stubbed.replace(STAND_IN_REQUIRE, (call, _quote, specifier) => {
    if (!Object.hasOwn(STAND_INS, specifier)) return call;
    const name = `__solidNativeStandIn${imports.length}`;
    imports.push(`import * as ${name} from ${JSON.stringify(specifier)};`);
    return name;
  });
  // On the first line, so every other line keeps its number.
  return rewritten === code ? code : imports.join(' ') + rewritten;
}

const installed = (filename) => /[\\/]node_modules[\\/]/.test(filename);

/**
 * The module as a test runs it, or null to leave it alone. `typescript` says whether the code
 * still has types for the runner to strip.
 *
 * @param {string} code
 * @param {string} filename
 * @returns {{ code: string, map?: object, typescript: boolean } | null}
 */
export function compile(code, filename) {
  if (isNativeCss(filename)) {
    const sheet = transformNativeCss(code, filename, { platform }).code;
    return { code: rewriteRequires(sheet), typescript: false };
  }
  if (/\.[jt]sx$/.test(filename) && isSolidSource(code, filename)) {
    const { code: compiled, map } = transformSolid(code, filename, { platform });
    return { code: rewriteRequires(compiled), map, typescript: false };
  }
  if (!/\.[mc]?[jt]s$/.test(filename) || !/\brequire\(/.test(code)) return null;
  // An installed package's assets are its own business; its stand-in requires are not.
  const rewritten = rewriteRequires(code, !installed(filename));
  return rewritten === code
    ? null
    : { code: rewritten, typescript: /\.[mc]?ts$/.test(path.extname(filename)) };
}
