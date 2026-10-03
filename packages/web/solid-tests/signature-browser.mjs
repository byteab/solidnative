/** Real Chromium acceptance for the original signature page; owns its server and browser. */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isSolidDomSource, transformSolidDom } from '@solid-native/metro/solid-dom.cjs';
import { createSolidRuntime } from '@solid-native/metro/solid-runtime.cjs';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const root = process.env.SOLID_NATIVE_G12_CONSUMER ?? workspace;
const runtime = createSolidRuntime(root);
const artifact = path.join(
  tmpdir(),
  `g12-signature-${root === workspace ? 'browser' : 'packed-browser'}.png`,
);
const script = `${root === workspace ? '/examples' : ''}/canary/src/app/dom-components/signature.dom.tsx`;
const server = await createServer({
  root,
  configFile: false,
  logLevel: 'warn',
  cacheDir: '/private/tmp/solid-native-g12-vite-cache',
  server: { host: '127.0.0.1', port: 0 },
  resolve: {
    alias: [
      { find: /^solid-js\/web$/, replacement: path.join(runtime.root, 'web/dist/web.js') },
      { find: /^solid-js$/, replacement: runtime.resolve('solid-js') },
    ],
  },
  optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [
    {
      name: 'g12-real-solid-dom-page',
      enforce: 'pre',
      transform(source, id) {
        if (isSolidDomSource(source, id)) return transformSolidDom(source, id);
      },
      configureServer(server) {
        server.middlewares.use('/g12-signature', (_request, response) => {
          response.setHeader('Content-Type', 'text/html');
          response.end(`<!doctype html><html><body><script>
          window.__g12Messages=[];
          window.ReactNativeWebView={injectedObjectJson:()=>JSON.stringify({inputs:{name:'Ada Lovelace',ink:'#1c1c1e'}}),postMessage:data=>window.__g12Messages.push(JSON.parse(data))};
          </script><script type="module">import signature from '${script}'; window.__g12Mounted=await signature.mounted;</script></body></html>`);
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({
    viewport: { width: 390, height: 500 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${address.port}/g12-signature`);
  await page.waitForFunction(() => window.__g12Mounted);
  const canvas = page.locator('canvas');
  assert.equal(await page.locator('.bar span').textContent(), 'Sign as Ada Lovelace');
  assert.deepEqual(await page.evaluate(() => window.__g12Messages), [
    { type: 'ready', outputs: ['strokes', 'cleared'] },
  ]);
  assert.deepEqual(
    await canvas.evaluate((node) => ({
      width: node.width,
      height: node.height,
      touch: getComputedStyle(node).touchAction,
    })),
    { width: 776, height: 356, touch: 'none' },
  );
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 60, { steps: 5 });
  await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => window.__g12Messages.at(-1)), {
    type: 'output',
    name: 'strokes',
    value: 1,
  });
  await page.evaluate(() =>
    window.__solidNative.receive({
      type: 'inputs',
      inputs: { name: 'Grace Hopper', ink: '#c4002d' },
    }),
  );
  assert.equal(await page.locator('.bar span').textContent(), 'Sign as Grace Hopper');
  assert.equal(await canvas.evaluate((node) => node.getContext('2d').strokeStyle), '#c4002d');
  await page.screenshot({ path: artifact });
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.__g12Messages.at(-1)), {
    type: 'output',
    name: 'cleared',
  });
  assert.equal(
    await canvas.evaluate((node) =>
      node
        .getContext('2d')
        .getImageData(0, 0, node.width, node.height)
        .data.some((value) => value !== 0),
    ),
    false,
  );
  await page.evaluate(() => window.__g12Mounted.dispose());
  assert.equal(await page.locator('canvas').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: 'PASS',
      browser: await browser.version(),
      originalPage: script,
      screenshot: artifact,
      ownedServerClosedOnExit: true,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
