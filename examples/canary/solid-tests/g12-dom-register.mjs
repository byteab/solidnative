import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { isSolidDomComponent, domComponentReference } from '@solidnative/metro/solid-dom.cjs';

// The real native lowering: a browser page is a URL reference, never executed by Fabric.
registerHooks({
  load(url, context, next) {
    if (url.startsWith('file:') && url.endsWith('.dom.tsx')) {
      const filename = fileURLToPath(url);
      const source = readFileSync(filename, 'utf8');
      if (isSolidDomComponent(source))
        return {
          format: 'module',
          source: domComponentReference(filename, { dev: false }).code,
          shortCircuit: true,
        };
    }
    return next(url, context);
  },
});
