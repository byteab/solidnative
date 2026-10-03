/**
 * Pseudo-state: `:disabled`, `:focus` and `:active`.
 *
 * The sources already exist. `:disabled` is a prop, so it reduces to an attribute test. Focus and
 * the active gesture are engine state, so those two need the engine to invalidate the nodes it
 * changes, which it can do precisely rather than by generation, since it knows exactly which
 * nodes moved.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { mountSolid } from './css-solid-harness.ts';
import { active, stateful } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');

let mounted: ReturnType<typeof mountSolid> | undefined;
afterEach(() => mounted?.root.dispose());

const fire = (id: string, type: string) => {
  mounted!.fabric.emit(mounted!.byId(id), type, {});
  mounted!.settle();
};

describe('pseudo-state', () => {
  beforeEach(() => {
    mounted = mountSolid(stateful());
  });

  const byId = (id: string) => mounted!.byId(id);

  it('counts :disabled as a class for specificity, like the attribute test it is', () => {
    assert.equal(
      compileCss('view:disabled { color: red }').rules[0].specificity,
      compileCss('view.x { color: red }').rules[0].specificity,
    );
  });

  it('matches :disabled from the prop', () => {
    assert.equal(byId('a').props['opacity'], 0.4);
    assert.equal(byId('b').props['opacity'], undefined);
  });

  it('applies :focus on a focus event and drops it again on blur', () => {
    assert.equal(byId('b').props['borderTopWidth'], undefined);

    fire('b', 'topFocus');
    assert.equal(byId('b').props['borderTopWidth'], 2);

    fire('b', 'topBlur');
    // Null, not absent: clearing a prop on a persistent tree means sending an explicit null, or
    // Fabric keeps the value the previous revision had.
    assert.equal(byId('b').props['borderTopWidth'], null);
  });

  it('moves focus rather than accumulating it', () => {
    fire('a', 'topFocus');
    fire('b', 'topFocus');

    assert.equal(byId('a').props['borderTopWidth'], null, 'the first field gave it up');
    assert.equal(byId('b').props['borderTopWidth'], 2);
  });
});

describe(':active through the responder system', () => {
  it('applies while a press is held and clears when it ends', () => {
    const fixture = active();
    mounted = mountSolid(fixture.View);
    const { fabric } = mounted;
    const id = (name: string) => mounted!.byId(name);
    const settle = () => mounted!.settle();

    assert.equal(id('btn').props['backgroundColor'], 'rgb(1, 1, 1)');

    // A touch on the text inside: the responder election runs up the tree from the target.
    fabric.emit(id('inner'), 'topTouchStart', { touches: [{}], changedTouches: [{}] });
    settle();
    assert.equal(id('btn').props['backgroundColor'], 'rgb(2, 2, 2)', 'held');
    assert.equal(id('outer').props['borderTopWidth'], 3, ':active runs up the chain');

    fabric.emit(id('inner'), 'topTouchEnd', { touches: [], changedTouches: [{}] });
    settle();
    assert.equal(id('btn').props['backgroundColor'], 'rgb(1, 1, 1)', 'released');
  });
});
