/**
 * Tokens where a design system puts them in motion and in sums: inside `translate`, `rotate`,
 * `scale` and the `transform` functions, as Tailwind writes every transform utility, and in a
 * `calc()` with more than one of them, `calc((var(--end) - var(--start)) * 1px)`.
 *
 * A token is only known on device, so the compiler leaves the arithmetic as a tree with the
 * tokens as its leaves, and the device works it out once they are.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine, type StyleSheet } from '@solidnative/fabric';
import { createFakeFabric, type FakeFabricNode } from '@solidnative/testing';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');
const flatten = (n: FakeFabricNode[]): FakeFabricNode[] =>
  n.flatMap((x) => [x, ...flatten(x.children)]);

/** The props a view wearing `.a` is committed with, under `css`. */
function propsOf(css: string): Record<string, unknown> {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1, { globalStyles: compileCss(css) as StyleSheet });
  const view = engine.createElement('view');
  engine.setClasses(view, 'a');
  engine.appendChild(engine.root, view);
  engine.commit();
  return flatten(fabric.committed)[0]!.props;
}

const transformOf = (css: string) => propsOf(css)['transform'];

describe('tokens in the individual transform properties', () => {
  it('translate, one axis a token', () => {
    assert.deepEqual(transformOf('.a { --y: -4px; translate: 0 var(--y); }'), [
      { translateX: 0 },
      { translateY: -4 },
    ]);
  });

  it('translate, as Tailwind writes it, both axes tokens', () => {
    const css =
      '.a { --tw-translate-x: 0; --tw-translate-y: 8px; translate: var(--tw-translate-x) var(--tw-translate-y); }';
    assert.deepEqual(transformOf(css), [{ translateX: 0 }, { translateY: 8 }]);
  });

  it('translate, with arithmetic around a token', () => {
    const css = '.a { --x: 6px; translate: calc(var(--x) * -1) 2px; }';
    assert.deepEqual(transformOf(css), [{ translateX: -6 }, { translateY: 2 }]);
  });

  it('rotate, a token in any angle unit', () => {
    assert.deepEqual(transformOf('.a { --r: 0.25turn; rotate: var(--r); }'), [{ rotate: '90deg' }]);
    assert.deepEqual(transformOf('.a { --r: 12deg; rotate: var(--r); }'), [{ rotate: '12deg' }]);
  });

  it('scale, one token for both axes or one each', () => {
    assert.deepEqual(transformOf('.a { --s: 1.2; scale: var(--s); }'), [
      { scaleX: 1.2 },
      { scaleY: 1.2 },
    ]);
    assert.deepEqual(transformOf('.a { --sx: 2; --sy: 0.5; scale: var(--sx) var(--sy); }'), [
      { scaleX: 2 },
      { scaleY: 0.5 },
    ]);
  });
});

describe('tokens in transform functions', () => {
  it('each function takes its own', () => {
    const css =
      '.a { --y: 20px; --r: 10deg; --s: 1.1; transform: translateY(var(--y)) rotate(var(--r)) scale(var(--s)); }';
    assert.deepEqual(transformOf(css), [
      { translateY: 20 },
      { rotate: '10deg' },
      { scaleX: 1.1 },
      { scaleY: 1.1 },
    ]);
  });

  it('translate() with two', () => {
    const css = '.a { --x: 2px; --y: 3px; transform: translate(var(--x), var(--y)); }';
    assert.deepEqual(transformOf(css), [{ translateX: 2 }, { translateY: 3 }]);
  });

  it('beside functions with none', () => {
    const css = '.a { --r: 45deg; transform: translateX(10px) rotate(var(--r)); }';
    assert.deepEqual(transformOf(css), [{ translateX: 10 }, { rotate: '45deg' }]);
  });
});

describe('calc() turning a number token into a length', () => {
  it('multiplies a unitless token by a length, as calc(var(--n) * 1px) does', () => {
    assert.equal(propsOf('.a { --n: 40; height: calc(var(--n) * 1px); }')['height'], 40);
    assert.equal(propsOf('.a { --n: 40; width: calc(var(--n) * 2px + 4px); }')['width'], 84);
  });
});

describe('calc() with more than one token', () => {
  it('a difference, scaled into a length', () => {
    const css = '.a { --start: 30; --end: 90; height: calc((var(--end) - var(--start)) * 1px); }';
    assert.equal(propsOf(css)['height'], 60);
  });

  it('a sum of lengths, on every side', () => {
    const style = propsOf('.a { --a: 4px; --b: 8px; padding: calc(var(--a) + var(--b)); }');
    assert.equal(style['paddingTop'], 12);
    assert.equal(style['paddingLeft'], 12);
  });

  it('a length times a number token', () => {
    const style = propsOf('.a { --unit: 4px; --n: 3; margin-top: calc(var(--unit) * var(--n)); }');
    assert.equal(style['marginTop'], 12);
  });

  it('with a fallback for a token nobody sets', () => {
    const style = propsOf('.a { --b: 8px; top: calc(var(--missing, 4px) + var(--b)); }');
    assert.equal(style['top'], 12);
  });

  it('is not written when a token is not set and has no fallback', () => {
    const style = propsOf('.a { --b: 8px; top: calc(var(--missing) + var(--b)); }');
    assert.equal(style['top'], undefined);
  });

  it('inside a transform', () => {
    const css = '.a { --gap: 4px; --n: 2; translate: 0 calc(var(--gap) * var(--n) * -1); }';
    assert.deepEqual(transformOf(css), [{ translateX: 0 }, { translateY: -8 }]);
  });
});

describe('tokens in an animation’s timing', () => {
  const GROW = '@keyframes grow { from { opacity: 0 } to { opacity: 1 } }';

  function spec(css: string) {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: compileCss(css) as StyleSheet });
    const view = engine.createElement('view');
    engine.setClasses(view, 'a');
    engine.appendChild(engine.root, view);
    engine.commit();
    return {
      engine,
      view,
      playing: () => (view as unknown as { playing?: { spec: unknown } }).playing?.spec,
    };
  }

  it('staggers by a token: a delay of calc(var(--i) * 60ms)', () => {
    const { playing } = spec(
      `${GROW} .a { --i: 2; animation: grow 400ms ease-out both; animation-delay: calc(var(--i) * 60ms); }`,
    );
    assert.equal((playing() as { delay: number }).delay, 120);
    assert.equal((playing() as { duration: number }).duration, 400);
  });

  it('takes a duration or delay that is a token of time', () => {
    const { playing } = spec(
      `${GROW} .a { --slow: 0.6s; --wait: 90ms; animation: grow 1s both; animation-duration: var(--slow); animation-delay: var(--wait); }`,
    );
    assert.equal((playing() as { duration: number }).duration, 600);
    assert.equal((playing() as { delay: number }).delay, 90);
  });

  it('does not start again on a commit that changes nothing about it', () => {
    const { engine, view, playing } = spec(
      `${GROW} .a { --i: 1; animation: grow 400ms both; animation-delay: calc(var(--i) * 60ms); } .b { padding: 2px; }`,
    );
    const first = (view as unknown as { playing?: { start: number } }).playing;
    engine.setClasses(view, 'a b');
    engine.commit();
    assert.equal((view as unknown as { playing?: unknown }).playing, first);
    assert.ok(playing());
  });
});
