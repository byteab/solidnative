/** Real Chrome checks the actual Vite preset and shared control/style adapter in dev and build. */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, build, preview } from 'vite';
import { chromium } from 'playwright';
import { solidNativeWeb } from '../solid-vite.mjs';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const fixture = mkdtempSync(
  path.join(fileURLToPath(new URL('./', import.meta.url)), 'host-browser-'),
);
const output = mkdtempSync(path.join(tmpdir(), 'solidnative-g13-browser-build-'));
const cache = mkdtempSync(path.join(tmpdir(), 'solidnative-g13-browser-cache-'));
// Kept after the run for inspection, and outside the tree so a CI run never writes into it.
const screenshots = mkdtempSync(path.join(tmpdir(), 'solidnative-web-host-screenshots-'));
writeFileSync(
  path.join(fixture, 'index.html'),
  '<!doctype html><html><body><div id="app"></div><script type="module" src="/entry.mjs"></script></body></html>',
);
writeFileSync(
  path.join(fixture, 'entry.mjs'),
  `import {mount} from '@solidnative/web/solid'; import {HostFixture} from '../host.solid.tsx'; window.mounted=mount(document.getElementById('app'),HostFixture,{inputs:{label:'Browser label',onChange:value=>window.changed=value}});`,
);
const config = {
  root: fixture,
  configFile: false,
  logLevel: 'warn',
  plugins: solidNativeWeb(),
  cacheDir: cache,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [workspace] } },
  build: { outDir: output, emptyOutDir: true },
  preview: { host: '127.0.0.1', port: 0 },
};
let browser, server, builtServer;
const errors = [],
  results = [];
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  async function check(url, mode) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    page.on('pageerror', (error) => errors.push(String(error)));
    try {
      await page.goto(url);
      await page.waitForFunction(() => window.mounted);
      assert.equal(await page.locator('.label').textContent(), 'Browser label');
      assert.equal(
        await page.locator('.label').evaluate((node) => getComputedStyle(node).color),
        'rgb(20, 40, 60)',
      );
      assert.equal(
        await page.locator('.label').evaluate((node) => getComputedStyle(node).fontWeight),
        '700',
      );
      assert.equal(
        await page
          .locator(
            '[data-h-' +
              (await page
                .locator('style[data-solidnative-style]')
                .getAttribute('data-solidnative-style')) +
              ']',
          )
          .evaluate((node) => getComputedStyle(node).paddingTop),
        '12px',
      );
      await page.locator('#input').fill('Browser edit');
      assert.equal(await page.evaluate(() => window.changed), 'Browser edit');
      await page.locator('#reject').fill('rejected');
      assert.equal(await page.locator('#reject').inputValue(), 'fixed');
      await page.locator('#switch').check();
      assert.equal(await page.locator('#conditional').textContent(), 'Browser edit');
      await page.locator('#reverse').focus();
      await page.keyboard.press('Enter');
      assert.deepEqual(
        await page
          .locator('[id="one"],[id="two"],[id="three"]')
          .evaluateAll((nodes) => nodes.map((n) => n.id)),
        ['three', 'two', 'one'],
      );
      await page.evaluate(() => window.mounted.setInputs({ label: 'Updated label' }));
      assert.equal(await page.locator('.label').textContent(), 'Updated label');
      assert.equal(await page.locator('#input').inputValue(), 'Browser edit');
      const screenshot = path.join(screenshots, `host-${mode}.png`);
      await page.screenshot({ path: screenshot });
      await page.evaluate(() => window.mounted.dispose());
      assert.equal(await page.locator('#app > *').count(), 0);
      assert.equal(await page.locator('[data-solidnative-style]').count(), 0);
      results.push({ mode, status: 'PASS', screenshot });
    } finally {
      await page.close();
    }
  }
  server = await createServer(config);
  await server.listen();
  await check(`http://127.0.0.1:${server.httpServer.address().port}`, 'development');
  await server.close();
  server = undefined;
  await build(config);
  builtServer = await preview(config);
  await check(`http://127.0.0.1:${builtServer.httpServer.address().port}`, 'production');
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ browser: await browser.version(), results, ownedResourcesClosedOnExit: true }),
  );
} finally {
  await browser?.close();
  await server?.close();
  if (builtServer) await new Promise((resolve) => builtServer.httpServer.close(resolve));
  for (const directory of [fixture, output, cache])
    rmSync(directory, { recursive: true, force: true });
}
