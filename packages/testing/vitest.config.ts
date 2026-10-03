// The Vitest half of this package's own suite, configured as an app's would be.
import { defineConfig } from 'vitest/config';
import { solidNative } from './vitest.mjs';

export default defineConfig({
  plugins: [solidNative()],
  test: { include: ['src/**/*.vitest.tsx'] },
});
