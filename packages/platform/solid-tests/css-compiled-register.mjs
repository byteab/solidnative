import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { isNativeCss, transformNativeCss } from '@solid-native/metro/solid-css.cjs';

// This hook adds only stylesheet data; compiled-register owns TSX and the canonical Solid graph.
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && isNativeCss(new URL(url).pathname)) {
      const filename = fileURLToPath(url);
      const { code } = transformNativeCss(readFileSync(filename, 'utf8'), filename, {
        platform: 'ios',
      });
      return { format: 'module', source: code, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
