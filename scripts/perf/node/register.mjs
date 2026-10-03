// Resolve bare packages as the canary app does, then apply the platform's compiled Solid hooks.
import { registerHooks } from 'node:module';
const canary = new URL('../../../examples/canary/package.json', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      /^[@a-z]/.test(specifier) &&
      !specifier.startsWith('node:') &&
      context.parentURL?.includes('/perf/node/')
    )
      return nextResolve(specifier, { ...context, parentURL: canary });
    return nextResolve(specifier, context);
  },
});
await import('../../../packages/platform/solid-tests/compiled-register.mjs');
