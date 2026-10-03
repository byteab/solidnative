/**
 * A `var()` naming a custom property nothing in scope defines, and with no fallback, is dropped,
 * as a browser drops it. A browser's inspector shows the declaration struck out; a phone has no
 * inspector, so in development the engine says so, once per name.
 */
import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { mountSolid } from './css-solid-harness.ts';
import { undefinedToken } from './css-solid-fixtures.tsx';

describe('a custom property nothing defines', () => {
  const warnings: string[] = [];
  const warn = console.warn;
  let mounted: ReturnType<typeof mountSolid> | undefined;
  const render = (options: { dev: boolean }) => (mounted = mountSolid(undefinedToken(), options));

  before(() => {
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
  });

  after(() => {
    console.warn = warn;
  });

  afterEach(() => {
    mounted?.root.dispose();
    warnings.length = 0;
  });

  const said = () => warnings.filter((line) => line.includes('custom property'));

  it('drops the declaration, and says so once in development', () => {
    const a = render({ dev: true }).byId('a');
    assert.equal(a.props['backgroundColor'], undefined);
    const reports = said();
    assert.equal(reports.length, 1, reports.join('\n'));
    assert.match(reports[0]!, /var\(--backdrop\)/);
    assert.match(reports[0]!, /background-color|backgroundColor/);
  });

  it('says nothing of a fallback, a token defined on the node or one inherited', () => {
    const f = render({ dev: true }).byId('f');
    assert.equal(f.props['paddingTop'], 4);
    assert.ok(!said().some((line) => /--unset-tint|--tone|--edge/.test(line)), said().join('\n'));
  });

  it('says nothing in a release build', () => {
    render({ dev: false });
    assert.deepEqual(said(), []);
  });
});
