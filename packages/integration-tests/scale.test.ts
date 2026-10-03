/**
 * Cost and leak behaviour at size. `incremental-commit.test.ts` proves incremental commit is
 * *correct*; these prove it stays cheap as the tree grows, and that churn does not accumulate.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { EngineNode } from '@solid-native/fabric';
import { mountSolid } from './css-solid-harness.ts';
import { scaleList } from './css-solid-fixtures.tsx';

const ROWS = 1000;

const makeRows = (count: number, prefix = 'row') =>
  Array.from({ length: count }, (_, i) => ({ id: i, label: `${prefix} ${i}` }));

function walk(node: EngineNode): EngineNode[] {
  return [node, ...node.children.flatMap(walk)];
}

describe('engine at scale', () => {
  let app: ReturnType<typeof mountSolid>;
  let instance: ReturnType<typeof scaleList>;
  const settle = () => app.settle();

  beforeEach(() => {
    instance = scaleList(false);
    app = mountSolid(instance.View);
  });

  it(`mounts ${ROWS} rows in one commit`, () => {
    app.fabric.reset();
    const started = performance.now();
    instance.setRows(makeRows(ROWS));
    settle();
    const elapsed = performance.now() - started;

    assert.equal(app.fabric.calls.completeRoot, 1, 'one commit for the whole list');
    // pressable + text + raw text per row.
    assert.equal(app.fabric.calls.createNode, ROWS * 3, 'each row created exactly once');
    console.log(`      ${ROWS} rows mounted in ${elapsed.toFixed(0)}ms`);
  });

  it('updates one row in a large list without touching the rest', () => {
    instance.setRows(makeRows(ROWS));
    settle();
    app.fabric.reset();

    const rows = makeRows(ROWS);
    rows[500] = { id: 500, label: 'edited' };
    const started = performance.now();
    instance.setRows(rows);
    settle();
    const elapsed = performance.now() - started;

    assert.equal(app.fabric.calls.createNode, 0, 'nothing new is created');
    // The changed raw text, its <text>, its <pressable>, the list <view>, and the host.
    const clones =
      app.fabric.calls.cloneWithChildren +
      app.fabric.calls.cloneWithProps +
      app.fabric.calls.cloneWithChildrenAndProps;
    assert.ok(clones <= 8, `only the spine re-clones, got ${clones}`);
    console.log(`      1 of ${ROWS} rows updated with ${clones} clones in ${elapsed.toFixed(0)}ms`);
  });

  it('does not accumulate nodes or listeners across add/remove churn', () => {
    /** Every listener the retained tree is holding, which is not the same as none. */
    const listeners = () =>
      walk(app.engine.root).reduce((total, node) => total + (node.listeners?.size ?? 0), 0);

    const baseline = walk(app.engine.root).length;
    /*
     * A count rather than an assertion that there are none, which is what this used to say.
     *
     * That held by accident: nothing in the starting tree happened to register a listener, so
     * "no accumulation" and "nothing at all" gave the same answer. They stopped agreeing the day
     * every pressable began listening for pointer enter and leave, and the test failed for a
     * change that leaked nothing. What it is actually about is the difference across the churn.
     */
    const baselineListeners = listeners();

    for (let cycle = 0; cycle < 5; cycle++) {
      instance.setRows(makeRows(200, `cycle ${cycle}`));
      settle();
      instance.setRows([]);
      settle();
    }

    assert.equal(
      walk(app.engine.root).length,
      baseline,
      'the retained tree returns to its starting size',
    );
    assert.equal(
      listeners(),
      baselineListeners,
      'and holds no more listeners than it started with',
    );
  });

  it('releases committed handles for removed subtrees', () => {
    const committed = () =>
      walk(app.engine.root)
        .filter((node) => node.committed !== null)
        .map((node) => node.name)
        .sort();
    const atMount = committed();
    instance.setRows(makeRows(200));
    settle();
    instance.setRows([]);
    settle();

    // Only the surviving static subtree holds a Fabric handle. The empty text Solid keeps as the
    // list's placeholder is left out of the commit: outside a paragraph it would show nothing. The
    // engine root is never committed itself: commit() walks its children straight into the root
    // child set.
    assert.deepEqual(committed(), ['#text', 'text', 'view', 'view']);
    assert.deepEqual(committed(), atMount, 'nothing the churn created is still held');
  });
});
