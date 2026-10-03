import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { solidNativeWeb } from '../solid-vite.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
async function bundle(source) {
  return build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [
      solidNativeWeb(),
      {
        name: 'browser-build-fixture',
        resolveId: (id) => (id === 'browser-fixture' ? '\0browser-fixture' : null),
        load: (id) => (id === '\0browser-fixture' ? source : null),
      },
    ],
    build: { write: false, minify: false, rolldownOptions: { input: 'browser-fixture' } },
  });
}

test('production shared controls use the browser source without bundling native code', async () => {
  const result = await bundle(`
    import { mount } from '@solidnative/web/solid';
    import { HostFixture } from ${JSON.stringify(fileURLToPath(new URL('./host.solid.tsx', import.meta.url)))};
    globalThis.mountFixture = element => mount(element, HostFixture, { inputs: { label: 'build' } });
  `);
  const chunks = result.output.filter((item) => item.type === 'chunk');
  assert.ok(chunks.length);
  const modules = chunks.flatMap((chunk) => Object.keys(chunk.modules));
  assert.ok(modules.some((id) => id.includes('src/solid/root.ts')));
  assert.ok(modules.some((id) => id.includes('solid-browser-native-unavailable')));
  assert.ok(!modules.some((id) => /node_modules\/react-native\//.test(id)));
  assert.ok(!modules.some((id) => /device\/src\/react-native\.ts$/.test(id)));
  assert.ok(chunks.some((chunk) => chunk.code.includes('needs a browser source override')));
});

test('direct native imports are rejected rather than externalized or shimmed', async () => {
  await assert.rejects(
    bundle("import { Platform } from 'react-native'; globalThis.native = Platform;"),
    /Unsupported runtime import.*react-native/s,
  );
});

test('a .native.css imported with a query (?raw, ?url) is left to that query, not compiled', async () => {
  const css = fileURLToPath(new URL('./card.native.css', import.meta.url));
  const result = await bundle(`
    import text from ${JSON.stringify(`${css}?raw`)};
    import href from ${JSON.stringify(`${css}?url`)};
    import compiled from ${JSON.stringify(css)};
    globalThis.parts = { text, href, compiled };
  `);
  const code = result.output.find((item) => item.type === 'chunk').code;
  const source = (await import('node:fs')).readFileSync(css, 'utf8');
  assert.ok(code.includes(JSON.stringify(source)), 'the ?raw import is the file text');
  assert.ok(
    result.output.some((item) => item.type === 'asset' && item.fileName.endsWith('.css')),
    'the ?url import emits the file as an asset',
  );
});
