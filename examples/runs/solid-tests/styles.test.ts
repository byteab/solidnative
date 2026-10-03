import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { bootRuns } from './runs-harness.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs') as {
  compileCss(source: string, context: string, options: object): unknown;
};
const read = (file: string) => readFileSync(new URL(`../src/app/${file}`, import.meta.url), 'utf8');

test('every screen sheet compiles on both platforms, with nothing dropped', () => {
  for (const name of ['run/run', 'run-detail/run-detail', 'history/history', 'history/run-row'])
    for (const platform of ['ios', 'android']) {
      const dropped: string[] = [];
      const native = compileCss(read(`${name}.native.css`), name, {
        platform,
        onUnsupported: (message: string) => dropped.push(message),
      });
      assert.ok((native as { rules: unknown[] }).rules.length > 0, name);
      assert.deepEqual(dropped, [], name);
    }
});

test('the run screen sheet reaches its views', async (t) => {
  const h = bootRuns();
  t.after(() => h.root.dispose());
  await h.waitFor(() => h.byTestId('elapsed') !== undefined);
  const elapsed = h.byTestId('elapsed')!;
  assert.equal(elapsed.props['fontSize'], 30);
  assert.equal(elapsed.props['fontWeight'], '800');
  const start = h.button('Start run')!;
  assert.equal(start.props['width'] ?? (start.props['style'] as { width?: number })?.width, 68);
});
