/**
 * `solidNative()`: the Vite plugin that lets Vitest run solidnative's Solid code in Node, compiled as
 * `@solidnative/testing/register` compiles it for `node --test` (see `compile.mjs`).
 *
 * The environment is Vitest's default, `node`: the renderer talks to a fake Fabric, not a DOM.
 */
import { readFileSync } from 'node:fs';
import { STAND_INS, compile, isNativeCss, solidRuntime } from './compile.mjs';

const CSS = '\0solidnative-css:';

/** @returns {import('vite').Plugin} */
export function solidNative() {
  let runtime;
  return {
    name: 'solidnative',
    enforce: 'pre',
    config: () => ({
      define: { __DEV__: 'true' },
      // Inlined, so their imports of `solid-js` and the native libraries come through the plugin:
      // left to Node, `solid-js/universal`'s own import of `solid-js` would take the server build.
      test: {
        server: { deps: { inline: [/[\\/]node_modules[\\/](?:@solidnative|solid-js)[\\/]/] } },
      },
    }),
    configResolved(config) {
      runtime = solidRuntime(config.root);
    },
    async resolveId(source, importer) {
      if (Object.hasOwn(STAND_INS, source)) return STAND_INS[source];
      const client = runtime.resolve(source);
      if (client) return client;
      // Out of reach of Vite's own CSS handling, which would treat the stylesheet as a stylesheet.
      if (isNativeCss(source)) {
        const resolved = await this.resolve(source, importer, { skipSelf: true });
        if (resolved) return `${CSS}${resolved.id}.js`;
      }
      return null;
    },
    load(id) {
      if (!id.startsWith(CSS)) return null;
      const filename = id.slice(CSS.length, -'.js'.length);
      this.addWatchFile(filename);
      return compile(readFileSync(filename, 'utf8'), filename).code;
    },
    transform(code, id) {
      const filename = id.split('?')[0];
      if (filename.startsWith('\0') || isNativeCss(filename)) return null;
      const compiled = compile(code, filename);
      return compiled && { code: compiled.code, map: compiled.map ?? null };
    },
  };
}
