import 'jsdom';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSolidRuntime } from '@solidnative/metro/solid-runtime.cjs';
import { isSolidSource } from '@solidnative/metro/solid-transform.cjs';
import { transformSolidBrowser, compileBrowserCss } from '@solidnative/metro/solid-browser.cjs';
const runtime = createSolidRuntime(fileURLToPath(new URL('../', import.meta.url)));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@solidnative/platform/solid')
      return { url: new URL('../src/solid/index.ts', import.meta.url).href, shortCircuit: true };
    if (/^(?:react(?:\/|$)|react-native(?:\/|$)|solid-js\/web)/.test(specifier))
      throw new Error(`Browser universal host imported an unrelated renderer: ${specifier}`);
    const file = runtime.resolve(specifier);
    return file ? { url: pathToFileURL(file).href, shortCircuit: true } : next(specifier, context);
  },
  load(url, context, next) {
    if (!url.startsWith('file:')) return next(url, context);
    const filename = fileURLToPath(url);
    if (/\.native\.css$/.test(filename))
      return {
        format: 'module',
        source: `export default ${JSON.stringify(compileBrowserCss(readFileSync(filename, 'utf8'), filename))}`,
        shortCircuit: true,
      };
    if (/\.[jt]sx$/.test(filename)) {
      const source = readFileSync(filename, 'utf8');
      if (isSolidSource(source, filename))
        return {
          format: 'module',
          source: transformSolidBrowser(source, filename).code,
          shortCircuit: true,
        };
    }
    return next(url, context);
  },
});
