/**
 * `translate`, `rotate` and `scale`: CSS's individual transform properties.
 *
 * They are three properties, not three ways of writing `transform`, and that is the whole point of
 * them: `.rotate-45.translate-x-4` turns and moves an element, because each class sets a property
 * the other does not touch. Native has only the list, so the compiler keeps each one under a key
 * of its own and the engine builds the list at the end, in the order CSS Transforms 2 gives:
 * translate, then rotate, then scale, then `transform`.
 *
 * Compiling all three into `transform` made them one property, so the cascade picked one class's
 * list and dropped the other's.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine, type StyleSheet } from '@solid-native/fabric';
import { createFakeFabric, type FakeFabricNode } from '@solid-native/testing';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');
const flatten = (n: FakeFabricNode[]): FakeFabricNode[] =>
  n.flatMap((x) => [x, ...flatten(x.children)]);

/** One view under a global sheet, with a clock the test drives. */
function scene(css: string, classes = '') {
  let now = 1000;
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1, {
    globalStyles: compileCss(css) as StyleSheet,
    now: () => now,
  });
  const view = engine.createElement('view');
  engine.setClasses(view, classes);
  engine.appendChild(engine.root, view);
  engine.commit();
  return {
    transform: () => flatten(fabric.committed)[0]!.props['transform'],
    classes(value: string) {
      engine.setClasses(view, value);
      engine.commit();
    },
    tick(ms: number) {
      now += ms;
      engine.advanceAnimations();
      engine.commit();
    },
  };
}

const TURN = [{ rotate: '45deg' }];
const MOVE = [{ translateX: 16 }, { translateY: 0 }];

describe('the individual transform properties', () => {
  it('applies two classes that each set one, rather than keeping the later', () => {
    const s = scene('.turn { rotate: 45deg } .move { translate: 16px 0 }', 'turn move');
    assert.deepEqual(s.transform(), [...MOVE, ...TURN], 'translate first, whatever the order');
  });

  it('applies all three from three rules, in translate, rotate, scale order', () => {
    const s = scene(
      '.grow { scale: 2 } .turn { rotate: 45deg } .move { translate: 16px 0 }',
      'grow turn move',
    );
    assert.deepEqual(s.transform(), [...MOVE, ...TURN, { scaleX: 2 }, { scaleY: 2 }]);
  });

  it('puts them before transform, which applies last', () => {
    // CSS Transforms 2, section 4: translate, rotate, scale, then transform, left to right.
    const s = scene(
      'view { transform: translateY(8px); scale: 3; rotate: 45deg; translate: 16px 0 }',
    );
    assert.deepEqual(s.transform(), [
      ...MOVE,
      ...TURN,
      { scaleX: 3 },
      { scaleY: 3 },
      { translateY: 8 },
    ]);
  });

  it('keeps a class of transform and a class of rotate apart', () => {
    const s = scene('.lift { transform: translateY(-4px) } .turn { rotate: 45deg }', 'lift turn');
    assert.deepEqual(s.transform(), [...TURN, { translateY: -4 }]);
  });

  it('ranks each by its own specificity', () => {
    // The stronger rule sets rotate only, so it wins rotate and leaves translate to the weaker.
    const s = scene(
      'view.a.b { rotate: 10deg } view.b { rotate: 45deg; translate: 16px 0 }',
      'a b',
    );
    assert.deepEqual(s.transform(), [...MOVE, { rotate: '10deg' }]);
  });

  it('lets none undo a weaker rule, for that property only', () => {
    const s = scene(
      'view.a { rotate: 45deg; translate: 16px 0 } view.a.flat { rotate: none }',
      'a flat',
    );
    assert.deepEqual(s.transform(), MOVE);
  });

  it('sends no transform at all when every one is none', () => {
    const s = scene('view.a { rotate: 45deg } view.a.flat { rotate: none }', 'a flat');
    assert.equal(s.transform(), undefined);
  });

  it('survives a sheet with nesting in it, which is printed again before compiling', () => {
    // lightningcss's printer folds these into `transform`, and drops them when `transform` comes
    // second in the block. A `@media` anywhere in the sheet is enough to send it through there.
    const s = scene(`
      view { rotate: 45deg; transform: translateY(8px) }
      @media (width > 1px) { view.wide { scale: 2 } }
    `);
    assert.deepEqual(s.transform(), [...TURN, { translateY: 8 }]);
  });

  it('does not re-send the list for a change that is not to one of them', () => {
    // The list is built at commit time, and a new array every time would be a changed prop on
    // every commit, for every element that has one.
    const s = scene('.turn { rotate: 45deg } .move { translate: 16px 0 } .dim { opacity: 0.5 }');
    s.classes('turn move');
    const before = s.transform();
    s.classes('turn move dim');
    assert.equal(s.transform(), before);
  });

  it('drops the other when a class comes off', () => {
    const s = scene('.turn { rotate: 45deg } .move { translate: 16px 0 }', 'turn move');
    s.classes('move');
    assert.deepEqual(s.transform(), MOVE);
  });
});

describe('transitioning an individual transform property', () => {
  it('keys the spec by the property, so `transition: rotate` names something', () => {
    const spec = compileCss('view { transition: rotate 200ms, translate 100ms, scale 50ms }')
      .rules[0].declarations['$transition'];
    const keys = Object.keys(spec);
    assert.equal(keys.length, 3, `three properties, three keys: ${keys.join(', ')}`);
    assert.ok(!keys.includes('transform'), 'none of them is transform');
  });

  it('eases rotate on its own, leaving translate where it is', () => {
    const s = scene(
      'view { translate: 16px 0; transition: rotate 100ms linear } view.on { rotate: 90deg }',
    );
    s.classes('on');
    s.tick(50);
    assert.deepEqual(s.transform(), [...MOVE, { rotate: '45deg' }], 'halfway round, not moved');
    s.tick(50);
    assert.deepEqual(s.transform(), [...MOVE, { rotate: '90deg' }]);
  });

  it('does not ease rotate for `transition: transform`, which is another property', () => {
    const s = scene('view { transition: transform 100ms linear } view.on { rotate: 90deg }');
    s.classes('on');
    assert.deepEqual(s.transform(), [{ rotate: '90deg' }]);
  });

  it('eases translate back to rest when the class comes off', () => {
    const s = scene('view { transition: translate 100ms linear } view.on { translate: 16px 0 }');
    s.classes('on');
    s.tick(100);
    s.classes('');
    s.tick(50);
    assert.deepEqual(s.transform(), [{ translateX: 8 }, { translateY: 0 }]);
  });
});

describe('an individual transform property in @keyframes', () => {
  it('animates rotate without taking over the rule translate', () => {
    const s = scene(`
      @keyframes spin { from { rotate: 0deg } to { rotate: 360deg } }
      view { translate: 16px 0; animation: spin 100ms linear infinite }
    `);
    s.tick(50);
    assert.deepEqual(s.transform(), [...MOVE, { rotate: '180deg' }]);
  });

  it('starts an implicit frame from the identity', () => {
    const s = scene(`
      @keyframes grow { to { scale: 2 } }
      view { animation: grow 100ms linear }
    `);
    s.tick(50);
    assert.deepEqual(s.transform(), [{ scaleX: 1.5 }, { scaleY: 1.5 }]);
  });

  it('plays beside a transform the frames also set, in spec order', () => {
    const s = scene(`
      @keyframes wobble {
        from { transform: translateY(0px); rotate: 0deg }
        to { transform: translateY(10px); rotate: 90deg }
      }
      view { animation: wobble 100ms linear }
    `);
    s.tick(50);
    assert.deepEqual(s.transform(), [{ rotate: '45deg' }, { translateY: 5 }]);
  });
});
