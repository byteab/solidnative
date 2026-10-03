/**
 * The site's unit tests: the course's in-browser compile pipeline, the lesson model and the
 * checks, run in Node against the fake Fabric, plus the plain tests under `build/`.
 *
 * `solidNative()` from `@solidnative/testing/vitest` is what an app's tests run with: `solid-js` as its
 * client build, as Metro resolves it for a device, and the native libraries' stand-ins. The
 * learner's code in these tests is compiled the way the preview compiles it, by
 * `src/learn/preview/compiler.ts`: Babel and Solid's JSX transform, from `@solidnative/metro`'s own
 * dependencies, as `vite.config.ts` resolves them.
 */
import { solidNative } from '@solidnative/testing/vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import url from 'node:url';
import { defineConfig } from 'vitest/config';
import { markdown } from './build/markdown.ts';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const tooling = createRequire(
  createRequire(path.join(dirname, 'package.json')).resolve(
    '@solidnative/metro/solid-browser.cjs',
  ),
);

export default defineConfig({
  // `markdown()` because the lesson tests load each lesson as the site does, `lesson.md` and all.
  plugins: [markdown(), solidNative()],
  resolve: {
    alias: Object.fromEntries(
      ['@babel/core', 'babel-preset-solid', '@babel/plugin-transform-typescript'].map((name) => [
        name,
        tooling.resolve(name),
      ]),
    ),
  },
  test: {
    // `build/**` alongside `src/**` so a Vite plugin under `build/` is covered by the same
    // `vitest run` the rest of the site's unit tests are. `css: true` so that a stylesheet
    // imported with `?raw` is its text, not an empty string.
    include: ['src/**/*.test.ts', 'build/**/*.test.ts'],
    css: true,
    setupFiles: ['src/learn/preview/off-device.ts'],
  },
});
