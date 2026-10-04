import assert from 'node:assert/strict';
import { test } from 'node:test';
import { batch, createSignal, For as SolidFor, Show as SolidShow } from 'solid-js';
import { For, Show, createNativeRoot } from '@solidnative/platform/solid';
import { createFixture, UnknownIntrinsic, NumericChildren } from './compiled-fixture.tsx';
import { createFakeFabric, createClock, type FakeNode } from './fake-fabric.ts';

function flatten(nodes: readonly FakeNode[]): FakeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
function contents(node: FakeNode): string {
  return String(node.props['text'] ?? '') + node.children.map(contents).join('');
}

test('compiled numeric array children preserve zero, text spacing and string host payloads', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const errors: unknown[] = [];
  const root = createNativeRoot({
    fabric,
    clock,
    rootTag: 1,
    engineOptions: { onError: (error) => errors.push(error) },
  });
  const [value, setValue] = createSignal(0);
  root.render(() => NumericChildren({ value }));
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((node) => node.props['testID'] === id);
    assert.ok(node, `missing ${id}`);
    return node;
  };
  try {
    assert.deepEqual(errors, []);
    assert.equal(contents(find('numeric-label')), 'Count 0');
    assert.equal(contents(find('numeric-single')), '0');
    assert.equal(contents(find('numeric-array')), '10-1');
    assert.equal(contents(find('numeric-nested')), '01-1');
    for (const next of [-1, 2, 0]) {
      setValue(next);
      clock.flushMicrotasks();
      assert.deepEqual(errors, []);
      assert.equal(contents(find('numeric-label')), `Count ${next}`);
      assert.equal(contents(find('numeric-single')), String(next));
      assert.equal(contents(find('numeric-nested')), `${next}1-1`);
      for (const node of flatten(fabric.roots.get(1) ?? [])) {
        if (node.instanceHandle.kind === 'text') {
          assert.equal(typeof node.instanceHandle.text, 'string');
          assert.equal(typeof node.props['text'], 'string');
        }
      }
    }
    const commits = fabric.commits;
    setValue(0);
    clock.flushMicrotasks();
    assert.equal(fabric.commits, commits);
  } finally {
    root.dispose();
  }
});

test('compiled universal TSX drives native signals, stores, responders, keyed owners and remount', () => {
  const fixture = createFixture();
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((entry) => entry.props['testID'] === id);
    assert.ok(node, `native node ${id} exists`);
    return node;
  };
  root.render(fixture.View);
  assert.equal(fabric.commits, 1);
  assert.equal(contents(find('label')), 'Count 0 / initial');
  assert.equal(find('surface').props['opacity'], 0.5);
  const counter = find('counter');
  const labelTag = find('label').tag;
  const oldSurface = find('surface');
  const rowTags = new Map([1, 2, 3].map((id) => [id, find(`row-${id}`).tag]));
  const touch = (type: string) =>
    fabric.emit(counter, type, {
      identifier: 1,
      pageX: 1,
      pageY: 1,
      changedTouches: [{ identifier: 1, pageX: 1, pageY: 1 }],
      touches: type === 'topTouchStart' ? [{ identifier: 1, pageX: 1, pageY: 1 }] : [],
    });
  touch('topTouchStart');
  touch('topTouchEnd');
  assert.equal(fixture.count(), 1);
  assert.deepEqual(fixture.calls, ['first']);
  batch(() => {
    fixture.setState({ label: 'updated', opacity: 0.8 });
    fixture.setCount(2);
  });
  clock.flushMicrotasks();
  assert.equal(contents(find('label')), 'Count 2 / updated');
  assert.equal(find('label').tag, labelTag);
  assert.equal(find('surface').props['width'], 102);
  assert.equal(find('surface').props['opacity'], 0.8);
  assert.equal(oldSurface.props['opacity'], 0.5, 'committed snapshots remain immutable');

  fixture.setTouchHandler(() => () => fixture.calls.push('replacement'));
  clock.flushMicrotasks();
  touch('topTouchStart');
  touch('topTouchEnd');
  clock.flushMicrotasks();
  assert.equal(fixture.count(), 3);
  assert.deepEqual(fixture.calls, ['first', 'replacement']);
  assert.equal(find('counter').tag, counter.tag);

  const creates = fabric.creates;
  fixture.setItems([3, 1, 2]);
  clock.flushMicrotasks();
  assert.equal(fabric.creates, creates);
  assert.deepEqual(
    find('rows').children.map((node) => node.props['testID']),
    ['row-3', 'row-1', 'row-2'],
  );
  assert.deepEqual(find('rows').children.map(contents), ['3:0', '1:1', '2:2']);
  for (const [id, tag] of rowTags) assert.equal(find(`row-${id}`).tag, tag);
  fixture.setItems([3, 2, 4]);
  clock.flushMicrotasks();
  assert.deepEqual(fixture.cleanedRows, [1]);
  assert.equal(fixture.rows.get(1)!.committed, null);
  assert.equal(find('row-3').tag, rowTags.get(3));
  assert.ok(find('row-4'));

  fixture.setVisible(false);
  clock.flushMicrotasks();
  assert.equal(fixture.cleanups.branch, 1);
  assert.equal(contents(find('fallback')), 'Hidden');
  fixture.setVisible(true);
  clock.flushMicrotasks();
  assert.equal(contents(find('branch')), 'Visible updated');
  const commits = fabric.commits;
  fixture.setCount(3);
  fixture.setState('label', 'updated');
  clock.flushMicrotasks();
  assert.equal(fabric.commits, commits, 'unchanged signal/store values do not commit');

  root.dispose();
  root.dispose();
  assert.deepEqual(fixture.cleanups, { root: 1, branch: 2 });
  assert.deepEqual([...fixture.cleanedRows].sort(), [1, 2, 3, 4]);
  assert.deepEqual(fabric.roots.get(1), []);
  const afterDispose = fabric.commits;
  fixture.setCount(99);
  fixture.setState('label', 'disposed');
  touch('topTouchStart');
  touch('topTouchEnd');
  clock.flushMicrotasks();
  assert.equal(fixture.count(), 99, 'disposed responders cannot update state');
  assert.deepEqual(fixture.calls, ['first', 'replacement']);
  assert.equal(fabric.commits, afterDispose);
  const remountFixture = createFixture();
  const remount = createNativeRoot({ fabric, clock, rootTag: 1 });
  remount.render(remountFixture.View);
  assert.equal(contents(find('label')), 'Count 0 / initial');
  assert.equal(fabric.eventHandlerCount, 1);
  remount.dispose();
  assert.equal(clock.frames.size, 0);
});

test('native control-flow exports retain Solid identity but For, and all bare modules resolve to one production root', () => {
  // The platform's For disposes removed rows after the commit (for.ts).
  assert.notEqual(For, SolidFor);
  assert.equal(Show, SolidShow);
  const signal = import.meta.resolve('solid-js');
  assert.match(signal, /\/dist\/solid\.js$/);
  const root = signal.slice(0, -'dist/solid.js'.length);
  assert.equal(import.meta.resolve('solid-js/store'), `${root}store/dist/store.js`);
  assert.equal(import.meta.resolve('solid-js/universal'), `${root}universal/dist/universal.js`);
  assert.throws(() => import.meta.resolve('solid-js/web'), /DOM Solid is excluded/);
});

test('compiled native intrinsics have correct Fabric view names and clean development diagnostics', (t) => {
  const errors: unknown[][] = [];
  const warnings: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => errors.push(args));
  t.mock.method(console, 'warn', (...args: unknown[]) => warnings.push(args));
  const fabric = createFakeFabric();
  const root = createNativeRoot({
    fabric,
    clock: createClock(),
    rootTag: 1,
    engineOptions: { dev: true },
  });
  root.render(createFixture().View);
  const nodes = flatten(fabric.roots.get(1)!);
  assert.equal(nodes.find((node) => node.props['testID'] === 'surface')!.viewName, 'View');
  assert.equal(nodes.find((node) => node.props['testID'] === 'label')!.viewName, 'Paragraph');
  assert.ok(
    nodes.some((node) => node.viewName === 'VirtualText'),
    'nested text creates virtual text',
  );
  assert.ok(
    nodes.some((node) => node.viewName === 'RawText'),
    'text values create native text runs',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  root.dispose();
  const unknown = createNativeRoot({
    fabric,
    clock: createClock(),
    rootTag: 1,
    engineOptions: { dev: true },
  });
  unknown.render(UnknownIntrinsic);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]![0]), /unknown-native-element.*not a known element/);
  unknown.dispose();
});
