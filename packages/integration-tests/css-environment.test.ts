/**
 * Values only the device knows, reaching the stylesheet.
 *
 * The safe-area insets are the case that forces this. A layout has to clear the notch and the home
 * indicator, the numbers differ per device and change on rotation, and nothing about them exists
 * at build time - so a stylesheet cannot hold them, and yet a stylesheet is exactly where a
 * padding belongs. On the web these are `env()`; here they are custom properties seeded on the
 * root, which the cascade already knows how to carry and a rule can already override.
 *
 * The engine imports nothing from React Native, so it is told, the same way conditions are.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import type { Engine } from '@solid-native/fabric';
import { mountSolid } from './css-solid-harness.ts';
import { deviceTokenHost } from './css-solid-fixtures.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

describe('tokens the device supplies', () => {
  let mounted: ReturnType<typeof mountSolid> | undefined;
  let engine: Engine;
  let completeRootCalls: () => number;

  const boot = (css = '', tokens?: Record<string, { length: number }>) => {
    mounted = mountSolid(deviceTokenHost(), { globalStyles: compileCss(css, 'global'), tokens });
    engine = mounted.engine;
    completeRootCalls = () => mounted!.fabric.calls.completeRoot;
  };
  const settle = () => mounted!.settle();

  afterEach(() => mounted?.root.dispose());

  const node = (id: string) => mounted!.byId(id);

  it('falls back until a view has reported, which is a frame after mount', () => {
    // Insets are a property of a view, not of the device: nothing knows them until something has
    // been laid out. A layout that would jump should say so with a fallback.
    boot();
    assert.equal(node('button').props['marginBottom'], 16);
  });

  it('resolves what the device pushed in', () => {
    boot();
    engine.updateTokens({
      '--safe-area-inset-top': { length: 47 },
      '--safe-area-inset-bottom': { length: 34 },
    });
    settle();
    assert.equal(node('bar').props['paddingTop'], 47);
    assert.equal(node('button').props['marginBottom'], 34);
  });

  it('re-resolves when the numbers change, with nothing in the app dirty', () => {
    // A rotation changes no binding, so no view is dirty and a tick does no work. The engine has
    // to notice on its own, exactly as it does for a media query.
    boot();
    engine.updateTokens({ '--safe-area-inset-top': { length: 47 } });
    settle();
    engine.updateTokens({ '--safe-area-inset-top': { length: 20 } });
    settle();
    assert.equal(node('bar').props['paddingTop'], 20);
  });

  it('adds to an inset, which is what clearing the home indicator means', () => {
    // The insets are where the system's furniture ends, not where a layout should start. Almost
    // every real use of one is `the inset plus the padding this design already wanted`.
    boot();
    assert.equal(node('gap').props['paddingBottom'], 12, 'the fallback, still added to');
    engine.updateTokens({ '--safe-area-inset-bottom': { length: 34 } });
    settle();
    assert.equal(node('gap').props['paddingBottom'], 46);
  });

  it('takes whichever is larger, for a design that had a padding of its own', () => {
    boot();
    assert.equal(node('atleast').props['paddingBottom'], 16, 'no indicator, so the design wins');
    engine.updateTokens({ '--safe-area-inset-bottom': { length: 34 } });
    settle();
    assert.equal(node('atleast').props['paddingBottom'], 34);
  });

  it('scales one', () => {
    boot();
    engine.updateTokens({ '--safe-area-inset-top': { length: 20 } });
    settle();
    assert.equal(node('double').props['paddingTop'], 40);
  });

  it('takes what is known at startup from mount, so the first frame is right', () => {
    // The pixel density is not measured, it is asked for, and the answer never changes. Nothing
    // about it should wait for a second commit the way an inset has to.
    boot('', { '--hairline': { length: 1 / 3 } });
    assert.equal(node('divider').props['borderBottomWidth'], 1 / 3);
    assert.equal(completeRootCalls(), 1, 'no second commit to correct it');
  });

  it('keeps what one source pushed when another pushes its own', () => {
    // The insets arrive from a view and the hairline from the device: different owners, one map.
    boot('', { '--hairline': { length: 1 / 3 } });
    engine.updateTokens({ '--safe-area-inset-top': { length: 47 } });
    settle();
    assert.equal(node('divider').props['borderBottomWidth'], 1 / 3, 'not wiped by the insets');
    assert.equal(node('bar').props['paddingTop'], 47);
  });

  it('lets the stylesheet override what the device said', () => {
    // Seeded, not forced: they sit below `:root` in the cascade, so an app that wants to pin one
    // for a screenshot or a tablet layout still can.
    boot(':root { --safe-area-inset-top: 0px }');
    engine.updateTokens({ '--safe-area-inset-top': { length: 47 } });
    settle();
    assert.equal(node('bar').props['paddingTop'], 0);
  });
});

describe('env(), the way the web writes the insets', () => {
  // A stylesheet shared with the web writes env(safe-area-inset-*), and every one was refused
  // with "'padding-top: [object Object]' is not a value native can take". They read the tokens
  // the device supplies, exactly as the var() spelling does.
  const deferredOf = (css: string) => compileCss(`.a { ${css} }`).rules[0].deferred;

  it('reads a safe-area inset as the token of the same name', () => {
    assert.deepEqual(deferredOf('padding-top: env(safe-area-inset-top, 20px)'), [
      { props: ['paddingTop'], kind: 'length', reference: '--safe-area-inset-top', fallback: 20 },
    ]);
    assert.deepEqual(deferredOf('margin-bottom: calc(env(safe-area-inset-bottom) + 4px)'), [
      {
        props: ['marginBottom'],
        kind: 'length',
        reference: '--safe-area-inset-bottom',
        adjust: { offset: 4 },
      },
    ]);
  });

  it('refuses the environment values a device does not supply, by name', () => {
    assert.throws(() => deferredOf('padding-top: env(keyboard-inset-top)'), /keyboard-inset-top/);
  });
});
