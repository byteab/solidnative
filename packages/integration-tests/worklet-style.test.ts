/**
 * Reanimated's worklets, at the seam.
 *
 * The UI runtime is Reanimated's and is not retested here. What matters on this side is that the
 * binding hands it a node it can actually write to - a react tag and the shadow node behind it,
 * neither of which exists before the first commit - and that it lets go of the runtime when the
 * style is replaced or the element goes away, because a mapper nobody stopped keeps running on
 * the UI thread for the life of the app.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { WorkletStyleSpec, WorkletTarget } from '@solidnative/components/solid';
import { mountSolid } from './css-solid-harness.ts';
import { sliding } from './css-solid-fixtures.tsx';

interface Binding {
  target: WorkletTarget;
  style: WorkletStyleSpec;
  stopped: number;
}

let mounted: ReturnType<typeof mountSolid> | undefined;
afterEach(() => mounted?.root.dispose());

function boot() {
  const bound: Binding[] = [];
  const fixture = sliding({
    bind: (target, style) => {
      const binding: Binding = { target, style, stopped: 0 };
      bound.push(binding);
      return () => binding.stopped++;
    },
    scroll: () => () => {},
  });
  mounted = mountSolid(fixture.View);
  const { engine } = mounted;
  // Fabric clones on write, so the node has to be looked up again after every commit.
  const animated = () => mounted!.nodes().find((n) => n.props['backgroundColor'] === 'red')!;
  return { fixture, engine, bound, animated, settle: () => mounted!.settle() };
}

describe('worklet style', () => {
  it('binds to the committed node, by tag and by shadow node', () => {
    const { engine, bound, animated } = boot();
    assert.equal(bound.length, 1);
    const node = animated().instanceHandle as never;
    assert.equal(bound[0]!.target.tag, engine.tagOf(node), 'the element it sits on');
    assert.equal(
      bound[0]!.target.shadowNode,
      engine.shadowNodeOf(node),
      'and the shadow node Fabric holds for it, which is what the UI thread writes to',
    );
  });

  it('runs the updater over the values it was given, with nothing captured', () => {
    const { bound } = boot();
    const { values, updater } = bound[0]!.style;
    (values[0] as { value: number }).value = 12;
    assert.deepEqual(updater(...values), { transform: [{ translateX: 12 }] });
  });

  it('stops the old mapper when the style is replaced', () => {
    const { fixture, bound, settle } = boot();

    fixture.setStyle({ values: [], updater: () => ({ opacity: 0.5 }) });
    settle();

    assert.equal(bound.length, 2, 'a mapper for the new style');
    assert.equal(bound[0]!.stopped, 1, 'and the old one stopped');
  });

  it('stops when the element goes away', () => {
    const { fixture, bound, settle } = boot();
    fixture.setShown(false);
    settle();
    assert.equal(bound[0]!.stopped, 1);
  });
});
