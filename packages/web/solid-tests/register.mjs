import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSolidRuntime } from '@solidnative/metro/solid-runtime.cjs';
import { isSolidDomSource, transformSolidDom } from '@solidnative/metro/solid-dom.cjs';
// Node24 cannot synchronously link jsdom's CJS→ESM encoding graph through registerHooks.
// Load that test-only graph before installing the source compiler hook.
import 'jsdom';

const runtime = createSolidRuntime(fileURLToPath(new URL('../', import.meta.url)));
registerHooks({
  resolve(specifier, context, next) {
    if (/^(?:react(?:\/|$)|react-native(?:\/|$)|@solidnative\/platform\/solid)/.test(specifier))
      throw new Error(`The DOM page imported a native/framework wrapper: ${specifier}`);
    const file =
      specifier === 'solid-js/web' ? `${runtime.root}/web/dist/web.js` : runtime.resolve(specifier);
    return file ? { url: pathToFileURL(file).href, shortCircuit: true } : next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && /\.[jt]sx$/.test(url)) {
      const filename = fileURLToPath(url);
      const source = readFileSync(filename, 'utf8');
      if (isSolidDomSource(source, filename))
        return {
          format: 'module',
          source: transformSolidDom(source, filename).code,
          shortCircuit: true,
        };
    }
    return next(url, context);
  },
});
