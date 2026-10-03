import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EngineNode } from '@solidnative/fabric';
import { createElement, createNativeRoot, Defer, insert, useHostAdapter } from '../src/solid.ts';
import { createClock, createFakeFabric, type FakeNode } from './fake-fabric.ts';

const texts = (nodes: readonly FakeNode[]): string[] =>
  nodes.flatMap((node) => [
    ...(node.viewName === 'RawText' ? [String(node.props['text'])] : []),
    ...texts(node.children),
  ]);

function label(text: string): EngineNode {
  const node = createElement('text');
  insert(node, text);
  return node;
}

test('Defer shows its fallback in the first commit and mounts its children a frame after it', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, rootTag: 1, clock });
  let made = 0;
  root.render(() => {
    const page = createElement('view');
    insert(page, [
      label('header'),
      Defer({
        get fallback() {
          return label('loading');
        },
        get children() {
          made++;
          return label('body');
        },
      }),
    ]);
    return page;
  });
  assert.deepEqual(texts(fabric.roots.get(1)!), ['header', 'loading']);
  assert.equal(made, 0, 'the children are not created for the first frame');
  clock.flushMicrotasks();
  assert.equal(made, 0, 'nor by the commit after it');
  clock.frame(16);
  clock.flushMicrotasks();
  assert.deepEqual(texts(fabric.roots.get(1)!), ['header', 'body']);
  assert.equal(made, 1);
  clock.frame(32);
  clock.flushMicrotasks();
  assert.equal(made, 1, 'created once');
  root.dispose();
});

test('Defer without a fallback leaves nothing, and disposal before its frame cancels it', () => {
  const fabric = createFakeFabric();
  const clock = createClock();
  const root = createNativeRoot({ fabric, rootTag: 1, clock });
  let made = 0;
  root.render(() =>
    Defer({
      get children() {
        made++;
        return label('body');
      },
    }),
  );
  assert.deepEqual(texts(fabric.roots.get(1)!), []);
  clock.flushMicrotasks();
  assert.equal(clock.frames.size, 1);
  root.dispose();
  assert.equal(clock.frames.size, 0);
  clock.frame(16);
  assert.equal(made, 0);
});

test('a frame callback that throws is reported, and none is requested after disposal', () => {
  const errors: unknown[] = [];
  const clock = createClock();
  const root = createNativeRoot({
    fabric: createFakeFabric(),
    rootTag: 1,
    clock,
    engineOptions: { onError: (error) => errors.push(error) },
  });
  let requestFrame!: (callback: () => void) => () => void;
  root.render(() => {
    requestFrame = useHostAdapter().requestFrame;
    return createElement('view');
  });
  requestFrame(() => {
    throw new Error('frame');
  });
  const cancelled = requestFrame(() => errors.push('ran'));
  cancelled();
  cancelled();
  clock.frame(16);
  assert.deepEqual(
    errors.map((error) => (error instanceof Error ? error.message : error)),
    ['frame'],
  );
  root.dispose();
  requestFrame(() => errors.push('late'))();
  assert.equal(clock.frames.size, 0);
});
