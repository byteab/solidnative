import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { batch, createSignal } from 'solid-js';
import type { EngineNode, StyleRule, StyleSheet } from '@solidnative/fabric';
import {
  createElement,
  createNativeRoot,
  effect,
  insert,
  insertNode,
  setNativeStyleHost,
  setProp,
  withNativeStyles,
} from '../src/solid.ts';
import { createClock, createFakeFabric, type FakeNode } from './fake-fabric.ts';

function rule(classes: string[], declarations: Record<string, unknown>, order = 0): StyleRule {
  return {
    compounds: [{ classes }],
    combinators: [],
    specificity: classes.length * 1000,
    order,
    declarations,
  };
}

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);
const nativeNode = (fabric: ReturnType<typeof createFakeFabric>, node: EngineNode): FakeNode => {
  const found = flatten([...fabric.roots.values()].flat()).find(
    (candidate) => candidate.instanceHandle === node,
  );
  assert.ok(found, 'node must have a committed native view');
  return found;
};

describe('native scheduling', () => {
  it('mounts synchronously, coalesces writes and Solid batches, and skips no-op commits', () => {
    const fabric = createFakeFabric();
    const clock = createClock();
    const root = createNativeRoot({ fabric, rootTag: 1, clock });
    const [value, setValue] = createSignal(0);
    let node!: EngineNode;
    root.render(() => {
      node = createElement('view');
      effect(() => setProp(node, 'testID', String(value())));
      return node;
    });
    assert.equal(fabric.commits, 1);
    assert.equal(nativeNode(fabric, node).props['testID'], '0');
    setValue(1);
    batch(() => {
      setValue(2);
      setValue(3);
    });
    assert.equal(fabric.commits, 1);
    assert.equal(clock.microtasks.length, 1);
    clock.flushMicrotasks();
    assert.equal(fabric.commits, 2);
    assert.equal(nativeNode(fabric, node).props['testID'], '3');
    setValue(3);
    assert.equal(root.flush(), false);
    clock.flushMicrotasks();
    assert.equal(fabric.commits, 2);
    root.dispose();
  });

  it('invalidates an already queued microtask after an explicit flush', () => {
    const fabric = createFakeFabric();
    const clock = createClock();
    const root = createNativeRoot({ fabric, rootTag: 1, clock });
    let node!: EngineNode;
    root.render(() => (node = createElement('view')));
    setProp(node, 'testID', 'one');
    assert.equal(root.flush(), true);
    setProp(node, 'testID', 'two');
    clock.flushMicrotasks();
    assert.equal(fabric.commits, 3);
    assert.equal(nativeNode(fabric, node).props['testID'], 'two');
    root.dispose();
  });

  it('runs cancellable clean barriers without native commits and isolates callback errors', () => {
    const fabric = createFakeFabric();
    const clock = createClock();
    const reports: string[] = [];
    const root = createNativeRoot({
      fabric,
      rootTag: 1,
      clock,
      engineOptions: {
        onError(error) {
          reports.push((error as Error).message);
        },
      },
    });
    root.render(() => createElement('view'));
    const seen: string[] = [];
    const cancel = root.afterCommit(() => seen.push('cancelled'));
    cancel();
    root.afterCommit(() => {
      throw new Error('callback failed');
    });
    root.afterCommit(() => {
      seen.push('first');
      root.afterCommit(() => seen.push('next'));
    });
    assert.equal(root.flush(), false);
    assert.deepEqual(seen, ['first']);
    clock.flushMicrotasks();
    assert.deepEqual(seen, ['first', 'next']);
    assert.deepEqual(reports, ['callback failed']);
    assert.equal(fabric.commits, 1);
    root.dispose();
  });

  it('suppresses queued commits and callbacks after disposal', () => {
    const fabric = createFakeFabric();
    const clock = createClock();
    const root = createNativeRoot({ fabric, rootTag: 1, clock });
    let node!: EngineNode;
    root.render(() => (node = createElement('view')));
    let called = false;
    root.afterCommit(() => {
      called = true;
    });
    setProp(node, 'testID', 'pending');
    root.dispose();
    const commits = fabric.commits;
    clock.flushMicrotasks();
    clock.frame(100);
    assert.equal(root.flush(), false);
    assert.equal(called, false);
    assert.equal(fabric.commits, commits);
    assert.deepEqual(fabric.roots.get(1), []);
  });
});

describe('native styles', () => {
  it('unions base classes and classList, removes old flags, and skips identical sets', () => {
    const fabric = createFakeFabric();
    const root = createNativeRoot({ fabric, rootTag: 1, clock: createClock() });
    let node!: EngineNode;
    root.render(() => {
      node = createElement('view');
      setProp(node, 'class', 'base shared');
      setProp(node, 'classList', { shared: true, active: true, hidden: false });
      return node;
    });
    assert.deepEqual([...node.classes!].sort(), ['active', 'base', 'shared']);
    setProp(node, 'classList', { shared: false, active: false });
    root.flush();
    assert.deepEqual([...node.classes!].sort(), ['base', 'shared']);
    const commits = fabric.commits;
    setProp(node, 'className', 'shared base base');
    assert.equal(root.flush(), false);
    assert.equal(fabric.commits, commits);
    setProp(node, 'classList', { 'next selected': true });
    setProp(node, 'class', null);
    root.flush();
    assert.deepEqual([...node.classes!].sort(), ['next', 'selected']);
    assert.equal(node.props['classList'], undefined);
    root.dispose();
  });

  it('normalizes immutable style arrays, removes obsolete keys, and detects equivalent values', () => {
    const fabric = createFakeFabric();
    const root = createNativeRoot({ fabric, rootTag: 1, clock: createClock() });
    const transform = Object.freeze([{ translateX: '8px' }]);
    const first = Object.freeze({ 'margin-top': '4px', opacity: '0.5', transform });
    const next = Object.freeze({ width: '20px' });
    let node!: EngineNode;
    root.render(() => {
      node = createElement('view');
      setProp(node, 'style', [first, [null, next]]);
      return node;
    });
    assert.deepEqual(node.props['style'], {
      marginTop: 4,
      opacity: 0.5,
      transform: [{ translateX: 8 }],
      width: 20,
    });
    assert.equal(first['margin-top'], '4px');
    assert.equal(transform[0]!.translateX, '8px');
    setProp(node, 'style', [first, next]);
    assert.equal(root.flush(), false);
    setProp(node, 'style', { width: '24px' });
    root.flush();
    assert.deepEqual(node.props['style'], { width: 24 });
    assert.equal(nativeNode(fabric, node).props['marginTop'], null);
    setProp(node, 'style:height', '12px');
    root.flush();
    assert.equal(nativeNode(fabric, node).props['height'], 12);
    setProp(node, 'style', null);
    setProp(node, 'style:height', null);
    root.flush();
    assert.equal(node.props['style'], undefined);
    root.dispose();
  });

  it('preserves nested style owners in branches created later and contains scope rules', () => {
    const fabric = createFakeFabric();
    const clock = createClock();
    const root = createNativeRoot({ fabric, rootTag: 1, clock });
    const outerSheet: StyleSheet = { rules: [rule(['label'], { fontSize: 14 })] };
    const innerSheet: StyleSheet = { rules: [rule(['label'], { fontSize: 22 })] };
    const [shown, setShown] = createSignal(false);
    let later!: EngineNode;
    let outer!: EngineNode;
    let unscoped!: EngineNode;
    root.render(() => {
      unscoped = createElement('text');
      setProp(unscoped, 'class', 'label');
      outer = withNativeStyles(outerSheet, () => {
        const parent = createElement('view');
        const label = createElement('text');
        setProp(label, 'class', 'label');
        insertNode(parent, label);
        withNativeStyles(innerSheet, () =>
          insert(
            parent,
            () => {
              if (!shown()) return null;
              later = createElement('text');
              setProp(later, 'class', 'label');
              return later;
            },
            null,
          ),
        );
        return parent;
      });
      return [outer, unscoped];
    });
    setShown(true);
    clock.flushMicrotasks();
    assert.equal(later.sheet, innerSheet);
    assert.equal(outer.children[0]!.sheet, outerSheet);
    assert.equal(nativeNode(fabric, later).props['fontSize'], 22);
    assert.equal(nativeNode(fabric, outer.children[0]!).props['fontSize'], 14);
    assert.equal(nativeNode(fabric, unscoped).props['fontSize'], undefined);
    root.dispose();
  });

  it('inherits CSS values and custom properties, restores fallbacks, and invalidates explicit hosts', () => {
    const fabric = createFakeFabric();
    const root = createNativeRoot({ fabric, rootTag: 1, clock: createClock() });
    const sheet: StyleSheet = {
      rules: [
        rule(['container'], { fontSize: 18 }),
        {
          ...rule(['label'], {}),
          deferred: [
            { props: ['color'], kind: 'color', reference: '--tint', fallback: 'rgb(255, 0, 0)' },
          ],
        },
      ],
    };
    const hostSheet: StyleSheet = {
      rules: [
        {
          ...rule([], { backgroundColor: 'rgb(1, 2, 3)' }),
          compounds: [{ classes: [], host: true }],
        },
      ],
    };
    let parent!: EngineNode;
    let label!: EngineNode;
    root.render(() =>
      withNativeStyles(sheet, () => {
        parent = createElement('view');
        label = createElement('text');
        setProp(parent, 'class', 'container');
        setProp(parent, 'style', { '--tint': 'blue' });
        setProp(label, 'class', 'label');
        insertNode(parent, label);
        return parent;
      }),
    );
    assert.equal(nativeNode(fabric, label).props['fontSize'], 18);
    assert.equal(nativeNode(fabric, label).props['color'], 'blue');
    assert.equal(nodeHasCustomProp(nativeNode(fabric, parent)), false);
    setProp(parent, 'style', { '--tint': 'green' });
    root.flush();
    assert.equal(nativeNode(fabric, label).props['color'], 'green');
    setProp(parent, 'style', { '--tint': 'green' });
    assert.equal(root.flush(), false);
    setProp(parent, 'style', {});
    setNativeStyleHost(parent, hostSheet);
    root.flush();
    assert.equal(nativeNode(fabric, label).props['color'], 'rgb(255, 0, 0)');
    assert.equal(nativeNode(fabric, parent).props['backgroundColor'], 'rgb(1, 2, 3)');
    assert.equal(nativeNode(fabric, label).props['backgroundColor'], undefined);
    setNativeStyleHost(parent, hostSheet);
    assert.equal(root.flush(), false);
    setNativeStyleHost(parent, null);
    root.flush();
    assert.equal(nativeNode(fabric, parent).props['backgroundColor'], null);
    root.dispose();
  });
});

function nodeHasCustomProp(node: FakeNode): boolean {
  return Object.keys(node.props).some((key) => key.startsWith('--'));
}

describe('CSS animation frame scheduling', () => {
  const sheet: StyleSheet = {
    rules: [
      rule(['fade'], {
        opacity: 0,
        $transition: { opacity: { duration: 100, delay: 0, easing: [0, 0, 1, 1] } },
      }),
      rule(['fade', 'on'], { opacity: 1 }, 1),
    ],
  };

  it('advances real transitions on frames without redundant microtasks and cancels on dispose', () => {
    const fabric = createFakeFabric();
    const clock = createClock();
    const root = createNativeRoot({ fabric, rootTag: 1, clock, engineOptions: { now: () => 0 } });
    let node!: EngineNode;
    root.render(() =>
      withNativeStyles(sheet, () => {
        node = createElement('view');
        setProp(node, 'class', 'fade');
        return node;
      }),
    );
    setProp(node, 'classList', { on: true });
    clock.flushMicrotasks();
    assert.equal(clock.frames.size, 1);
    assert.equal(root.engine.animating, true);
    const commits = fabric.commits;
    clock.frame(50);
    assert.equal(fabric.commits, commits + 1);
    assert.ok(Math.abs((nativeNode(fabric, node).props['opacity'] as number) - 0.5) < 0.01);
    assert.equal(clock.microtasks.length, 0);
    assert.equal(clock.frames.size, 1);
    root.dispose();
    assert.equal(clock.frames.size, 0);
    const disposedCommits = fabric.commits;
    clock.frame(100);
    clock.flushMicrotasks();
    assert.equal(fabric.commits, disposedCommits);
    assert.equal(root.engine.animating, false);
  });

  it('stops after the final transition frame and commits transitionend mutations on a following frame', () => {
    const fabric = createFakeFabric();
    const clock = createClock();
    const root = createNativeRoot({ fabric, rootTag: 1, clock, engineOptions: { now: () => 0 } });
    let node!: EngineNode;
    root.render(() =>
      withNativeStyles(sheet, () => {
        node = createElement('view');
        setProp(node, 'class', 'fade');
        setProp(node, 'onTransitionend', () => setProp(node, 'testID', 'finished'));
        return node;
      }),
    );
    setProp(node, 'classList', { on: true });
    clock.flushMicrotasks();
    clock.frame(100);
    assert.equal(root.engine.animating, false);
    assert.equal(nativeNode(fabric, node).props['opacity'], 1);
    assert.equal(clock.frames.size, 1);
    assert.equal(clock.microtasks.length, 0);
    clock.frame(116);
    assert.equal(nativeNode(fabric, node).props['testID'], 'finished');
    assert.equal(clock.frames.size, 0);
    root.dispose();
  });
  it('flattens a style object shared by many nodes the same way for each of them', () => {
    const fabric = createFakeFabric();
    const root = createNativeRoot({ fabric, rootTag: 1, clock: createClock() });
    const shared = { 'margin-top': '4px', color: 'red', width: '50%' };
    const tinted = { '--tint': 'blue' };
    const sheet: StyleSheet = {
      rules: [
        {
          ...rule(['label'], {}),
          deferred: [{ props: ['color'], kind: 'color', reference: '--tint', fallback: 'red' }],
        },
      ],
    };
    const nodes: EngineNode[] = [];
    const labels: EngineNode[] = [];
    root.render(() =>
      withNativeStyles(sheet, () => {
        const page = createElement('view');
        for (let i = 0; i < 2; i++) {
          const row = createElement('view');
          const label = createElement('text');
          setProp(row, 'style', shared);
          setProp(label, 'style', tinted);
          setProp(label, 'class', 'label');
          insertNode(row, label);
          insertNode(page, row);
          nodes.push(row);
          labels.push(label);
        }
        return page;
      }),
    );
    // Each second use comes from the cache: the same names and numbers, and `tinted` still sets
    // the custom property rather than an inline style.
    for (const row of nodes) {
      assert.equal(nativeNode(fabric, row).props['marginTop'], 4);
      assert.equal(nativeNode(fabric, row).props['width'], '50%');
    }
    assert.equal(nativeNode(fabric, labels[0]!).props['color'], 'blue');
    assert.equal(nativeNode(fabric, labels[1]!).props['color'], 'blue');
    root.dispose();
  });
});
