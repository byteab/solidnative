import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSignal, untrack } from 'solid-js';
import { createNativeRoot } from '@solidnative/platform/solid';
import type { EngineNode } from '@solidnative/fabric';
import { View } from '../src/solid/primitive.ts';
import {
  AnimatedStyle,
  NativeGesture,
  WorkletStyle,
  WorkletScroll,
  type WorkletBackend,
  type WorkletStyleSpec,
  type NativeRef,
  type AnimationBackend,
} from './g8-binding-imports.ts';
import { createFakeFabric, createClock } from '../../platform/solid-tests/fake-fabric.ts';

function harness() {
  const fabric = createFakeFabric(),
    clock = createClock(),
    errors: unknown[] = [];
  const root = createNativeRoot({
    fabric,
    clock,
    rootTag: 1,
    engineOptions: { onError: (e) => errors.push(e) },
  });
  return { root, fabric, clock, errors };
}
const style: WorkletStyleSpec = { values: [], updater: () => ({ opacity: 1 }) };
test('worklet spec replacement cancels queued acquisition and null suspends exactly once', () => {
  const app = harness(),
    calls: string[] = [];
  const [spec, setSpec] = createSignal<WorkletStyleSpec | null>(style);
  const backend: WorkletBackend = {
    bind: (target, value) => {
      assert.ok(target.tag);
      assert.ok(target.shadowNode);
      calls.push(value === style ? 'old' : 'new');
      return () => {
        calls.push('stop');
      };
    },
    scroll: () => () => {},
  };
  app.root.render(() =>
    untrack(() => {
      const bind = WorkletStyle(spec, backend);
      return View({ ref: bind });
    }),
  );
  assert.deepEqual(calls, ['old']);
  setSpec({ ...style });
  setSpec(null);
  app.clock.flushMicrotasks();
  assert.deepEqual(calls, ['old', 'stop']);
  setSpec(style);
  app.clock.flushMicrotasks();
  assert.deepEqual(calls, ['old', 'stop', 'old']);
  app.root.dispose();
  app.root.dispose();
  assert.deepEqual(calls, ['old', 'stop', 'old', 'stop']);
});
test('native acquisition released synchronously when it disposes its owner', () => {
  const app = harness();
  let stops = 0;
  const backend: WorkletBackend = {
    bind: () => {
      app.root.dispose();
      return () => {
        stops++;
      };
    },
    scroll: () => () => {},
  };
  app.root.render(() => untrack(() => View({ ref: WorkletStyle(() => style, backend) })));
  assert.equal(stops, 1);
  assert.equal(app.clock.frames.size, 0);
});
test('worklet scroll and gesture wait for committed handles and detached queued bindings are discarded', () => {
  const app = harness();
  let ref!: NativeRef,
    attaches = 0,
    stops = 0;
  const [gesture, setGesture] = createSignal<object | null>(null);
  app.root.render(() =>
    untrack(() => {
      const bind = NativeGesture(gesture, {
        attach: () => {
          attaches++;
          return () => {
            stops++;
          };
        },
      });
      return View({
        ref: (r) => {
          ref = r;
          bind(r);
        },
      });
    }),
  );
  setGesture({});
  app.root.engine.removeChild(app.root.engine.root, ref.node as EngineNode);
  app.clock.flushMicrotasks();
  assert.equal(attaches, 0);
  app.root.engine.appendChild(app.root.engine.root, ref.node as EngineNode);
  setGesture({});
  app.clock.flushMicrotasks();
  assert.equal(attaches, 1);
  assert.equal(ref.node.props['collapsable'], false);
  app.root.dispose();
  assert.equal(stops, 1);
  const scroll = harness();
  let scrolls = 0;
  scroll.root.render(() =>
    untrack(() =>
      View({
        ref: WorkletScroll(() => ({ values: [], handler: () => {} }), {
          bind: () => () => {},
          scroll: (target) => {
            assert.ok(target.tag);
            scrolls++;
            return () => {
              scrolls--;
            };
          },
        }),
      }),
    ),
  );
  assert.equal(scrolls, 1);
  scroll.root.dispose();
  assert.equal(scrolls, 0);
});
test('animated frames commit independently, restore on suspension and ignore stale callbacks after replacement', () => {
  const app = harness();
  const frames: (() => void)[] = [];
  let stops = 0,
    connects = 0,
    value = 0.25;
  const [spec, setSpec] = createSignal<Record<string, unknown> | null>({ opacity: 'value' });
  const backend: AnimationBackend = {
    props: (_style, onFrame) => {
      frames.push(onFrame);
      return {
        attach: () => {},
        detach: () => {
          stops++;
        },
        read: () => ({ opacity: value }),
        connect: () => {
          connects++;
        },
      };
    },
  };
  app.root.render(() =>
    untrack(() => View({ style: { opacity: 0.8, width: 10 }, ref: AnimatedStyle(spec, backend) })),
  );
  const opacity = () => app.fabric.roots.get(1)![0]!.props['opacity'];
  assert.equal(opacity(), 0.25);
  assert.equal(connects, 1);
  const commits = app.fabric.commits;
  value = 0.5;
  frames[0]!();
  assert.equal(opacity(), 0.5);
  assert.equal(app.fabric.commits, commits + 1);
  setSpec(null);
  app.clock.flushMicrotasks();
  assert.equal(opacity(), 0.8);
  assert.equal(stops, 1);
  frames[0]!();
  assert.equal(opacity(), 0.8);
  setSpec({ opacity: 'next' });
  app.clock.flushMicrotasks();
  assert.equal(opacity(), 0.5);
  assert.equal(connects, 2);
  app.root.dispose();
  frames[1]!();
  assert.equal(stops, 2);
});
test('animated connect failure detaches once and reports through the existing root error boundary', () => {
  const app = harness();
  let stops = 0;
  app.root.render(() =>
    untrack(() =>
      View({
        ref: AnimatedStyle(() => ({ opacity: 1 }), {
          props: () => ({
            attach: () => {},
            detach: () => {
              stops++;
            },
            read: () => ({ opacity: 1 }),
            connect: () => {
              throw new Error('connect failed');
            },
          }),
        }),
      }),
    ),
  );
  assert.equal(stops, 1);
  assert.match(String(app.errors[0]), /connect failed/);
  app.root.dispose();
  assert.equal(stops, 1);
});

test('animated suspension restores newer caller styling after another graph frame overlays it', () => {
  const app = harness();
  const [opacity, setOpacity] = createSignal<number | undefined>(0.8);
  const [spec, setSpec] = createSignal<Record<string, unknown> | null>({ opacity: 'value' });
  let frame = () => {};
  app.root.render(() =>
    untrack(() =>
      View({
        get style() {
          return { opacity: opacity() };
        },
        ref: AnimatedStyle(spec, {
          props: (_style, callback) => {
            frame = callback;
            return {
              attach: () => {},
              detach: () => {},
              connect: () => {},
              read: () => ({ opacity: 0.3 }),
            };
          },
        }),
      }),
    ),
  );
  setOpacity(0.6);
  app.clock.flushMicrotasks();
  frame();
  setSpec(null);
  app.clock.flushMicrotasks();
  assert.equal(app.fabric.roots.get(1)![0]!.props['opacity'], 0.6);
  setSpec({ opacity: 'again' });
  app.clock.flushMicrotasks();
  setOpacity(undefined);
  app.clock.flushMicrotasks();
  frame();
  setSpec(null);
  app.clock.flushMicrotasks();
  assert.equal(app.fabric.roots.get(1)![0]!.props['opacity'] ?? undefined, undefined);
  app.root.dispose();
});

test('synchronous graph frames during attachment are applied before the initial commit', () => {
  const app = harness();
  let stops = 0;
  app.root.render(() =>
    untrack(() =>
      View({
        ref: AnimatedStyle(() => ({ opacity: 'value' }), {
          props: (_style, frame) => ({
            attach: frame,
            detach: () => {
              stops++;
            },
            connect: () => {},
            read: () => ({ opacity: 0.4 }),
          }),
        }),
      }),
    ),
  );
  assert.equal(app.fabric.roots.get(1)![0]!.props['opacity'], 0.4);
  assert.equal(stops, 0);
  app.root.dispose();
  assert.equal(stops, 1);
});

test('throwing graph attachment releases its acquired handle once', () => {
  const app = harness();
  let stops = 0;
  assert.throws(
    () =>
      app.root.render(() =>
        untrack(() =>
          View({
            ref: AnimatedStyle(() => ({}), {
              props: () => ({
                attach: () => {
                  throw new Error('attach failed');
                },
                detach: () => {
                  stops++;
                },
                connect: () => {},
                read: () => ({}),
              }),
            }),
          }),
        ),
      ),
    /attach failed/,
  );
  assert.equal(stops, 1);
  app.root.dispose();
  assert.equal(stops, 1);
});
