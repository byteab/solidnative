// Bundle a bench entry for the headless Hermes runner: Solid JSX compiled by the platform's own
// transform, solid-js resolved to its client build, TypeScript stripped by rolldown, then hermesc -O.
//   node build.mjs <entry.ts> <out.hbc>
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const require = createRequire(resolve(repo, 'packages/platform/package.json'));
const { rolldown } = await import(
  resolve(repo, 'node_modules/.pnpm/rolldown@1.2.11/node_modules/rolldown/dist/index.mjs')
);
const { createSolidRuntime } = require('@solidnative/metro/solid-runtime.cjs');
const { isSolidSource, transformSolid } = require('@solidnative/metro/solid-transform.cjs');
const runtime = createSolidRuntime(resolve(repo, 'packages/platform'));
const appRequire = createRequire(resolve(repo, 'examples/canary/package.json'));
const [entry, out] = process.argv.slice(2);
const bundle = await rolldown({
  input: resolve(entry),
  platform: 'neutral',
  transform: { define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' } },
  plugins: [
    {
      name: 'solid',
      resolveId(id, importer) {
        if (/^react-native/.test(id)) return '\0rn-stub';
        const client = runtime.resolve(id);
        if (client) return client;
        if (/^@solidnative\//.test(id)) {
          try {
            return appRequire.resolve(id);
          } catch {
            return null;
          }
        }
        return null;
      },
      load(id) {
        if (id === '\0rn-stub')
          return 'export const Animated = undefined, Easing = undefined; export default {};';
        if (!/\.[jt]sx$/.test(id)) return null;
        const source = readFileSync(id, 'utf8');
        if (!isSolidSource(source, id)) return null;
        return {
          code: transformSolid(source, id, {
            platform: 'ios',
            lowerPrimitives: process.env.LOWER !== '0',
          }).code,
          moduleType: 'js',
        };
      },
    },
  ],
  resolve: { conditionNames: ['react-native', 'import', 'default'] },
});
await bundle.write({ file: out.replace(/\.hbc$/, '.js'), format: 'iife' });
const hermesc = resolve(repo, 'examples/canary/ios/Pods/hermes-engine/destroot/bin/hermesc');
execFileSync(hermesc, ['-O', '-emit-binary', '-out', out, out.replace(/\.hbc$/, '.js')], {
  stdio: 'inherit',
});
