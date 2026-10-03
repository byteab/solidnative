/**
 * A scroll handled on the UI thread.
 *
 * The runtime is Reanimated's and is not retested here; what matters on this side is that the
 * binding registers against a node native can actually address - it has no react tag until it
 * has been committed - and that it unregisters, because a handler nobody removed keeps running
 * for the life of the app against a tag that will be reused.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { WorkletScrollSpec, WorkletTarget } from '@solidnative/components/solid';
import { mountSolid } from './css-solid-harness.ts';
import { scrolling } from './css-solid-fixtures.tsx';

interface Bound {
  target: WorkletTarget;
  spec: WorkletScrollSpec;
  stopped: number;
}

let mounted: ReturnType<typeof mountSolid> | undefined;
afterEach(() => mounted?.root.dispose());

function boot() {
  const bound: Bound[] = [];
  const fixture = scrolling({
    bind: () => () => {},
    scroll: (target, spec) => {
      const record: Bound = { target, spec, stopped: 0 };
      bound.push(record);
      return () => record.stopped++;
    },
  });
  mounted = mountSolid(fixture.View);
  const { engine } = mounted;
  const scroller = () => mounted!.nodes().find((n) => n.viewName === 'ScrollView')!;
  return { fixture, engine, bound, scroller, settle: () => mounted!.settle() };
}

describe('worklet scroll', () => {
  it('registers against the committed scroll view', () => {
    const { engine, bound, scroller } = boot();
    assert.equal(bound.length, 1);
    assert.equal(bound[0]!.target.tag, engine.tagOf(scroller().instanceHandle as never));
  });

  it('hands the worklet the values it was built with', () => {
    const { bound } = boot();
    const { values, handler } = bound[0]!.spec;
    handler({ contentOffset: { x: 0, y: 42 } } as never, ...values);
    assert.equal((values[0] as { value: number }).value, 42, 'the worklet wrote the shared value');
  });

  it('unregisters when the element goes away', () => {
    const { fixture, bound, settle } = boot();
    fixture.setShown(false);
    settle();
    assert.equal(bound[0]!.stopped, 1);
  });
});
