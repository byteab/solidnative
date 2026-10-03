import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSolidRuntime } from '@solid-native/metro/solid-runtime.cjs';
import { isSolidSource, transformSolid } from '@solid-native/metro/solid-transform.cjs';

/** Synchronous Node 24 hook: no worker thread or export conditions required. */
export function registerCompiled({ dist = false } = {}) {
  const runtime = createSolidRuntime(fileURLToPath(new URL('../', import.meta.url)));
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      const client = runtime.resolve(specifier);
      if (client) return { url: pathToFileURL(client).href, shortCircuit: true };
      if (specifier === 'solid-js/web' || specifier.startsWith('solid-js/web/'))
        throw new Error('DOM Solid is excluded from the native compiled fixture.');
      if (dist && specifier === '@solid-native/platform/solid')
        return { url: new URL('../dist/solid.js', import.meta.url).href, shortCircuit: true };
      if (dist && specifier === '@solid-native/fabric')
        return {
          url: new URL('../../fabric/dist/index.js', import.meta.url).href,
          shortCircuit: true,
        };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.startsWith('file:') && /\.[jt]sx$/.test(new URL(url).pathname)) {
        const filename = fileURLToPath(url);
        const source = readFileSync(filename, 'utf8');
        if (isSolidSource(source, filename)) {
          const { code, map } = transformSolid(source, filename, { platform: 'ios' });
          const inlineMap = Buffer.from(JSON.stringify(map)).toString('base64');
          return {
            format: 'module',
            source: `${code}\n//# sourceMappingURL=data:application/json;base64,${inlineMap}`,
            shortCircuit: true,
          };
        }
      }
      return nextLoad(url, context);
    },
  });
}
