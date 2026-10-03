/**
 * End-to-end tests for the course, in Chromium against the production build: the build is where
 * the preview's traps are (Babel bundled for the browser, WebAssembly loaded by
 * URL), so a dev server would pass tests the site fails.
 *
 * `pnpm e2e` builds the site without prerendering and serves it with `vite preview`. Set
 * `E2E_URL` to test a server that is already running instead.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 5313;
const url = process.env['E2E_URL'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: url ?? `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // A locally installed Chromium when the pinned one is not downloaded; unset in CI.
        launchOptions: {
          executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] || undefined,
        },
      },
    },
  ],
  webServer: url
    ? undefined
    : {
        command: `vite build && vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/learn`,
        timeout: 180_000,
        reuseExistingServer: !process.env['CI'],
      },
});
