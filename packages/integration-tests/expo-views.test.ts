/**
 * The typed native views: `<expo-glass>`, `<expo-glass-container>`, `<expo-symbol>` and
 * `<apple-sign-in-button>`. Each input reaches its view as the prop native reads, with what the
 * module's React wrapper would have done to it first - a symbol's size, type and colours, the
 * Apple button's type and style as the numbers native takes.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { liquidGlassAvailable } from '@solidnative/expo';
import { createNativeRoot } from '@solidnative/platform/solid';
import { createFakeFabric, type FakeFabricNode as FakeNode } from '@solidnative/testing';
import { expoViewsFixture } from './expo-views-fixture.tsx';

const all = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...all(node.children)]);

function render() {
  const fixture = expoViewsFixture();
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 1 });
  root.render(fixture.View);
  const byId = (id: string) => all(fabric.committed).find((node) => node.props['nativeID'] === id)!;
  return { root, fabric, byId, presses: fixture.presses };
}

describe('the typed native views', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => unmount?.());

  it('commits each as its module s view', () => {
    const { root, byId } = render();
    unmount = () => root.dispose();
    assert.equal(byId('glass').viewName, 'ViewManagerAdapter_ExpoGlassEffect_GlassView');
    assert.equal(byId('container').viewName, 'ViewManagerAdapter_ExpoGlassEffect_GlassContainer');
    assert.equal(byId('heart').viewName, 'ViewManagerAdapter_SymbolModule');
    assert.equal(byId('apple').viewName, 'ViewManagerAdapter_ExpoAppleAuthentication');
  });

  it('passes the glass effect s props through, and leaves unset ones to native', () => {
    const { root, byId } = render();
    unmount = () => root.dispose();
    const glass = byId('glass').props;
    assert.equal(glass['glassEffectStyle'], 'clear');
    assert.equal(glass['tintColor'], '#ff000033');
    assert.equal(glass['isInteractive'], true, 'a bare attribute is on');
    assert.equal(byId('container').props['spacing'], 12);
    assert.equal(byId('plain').props['glassEffectStyle'], undefined);
    assert.equal(byId('plain').props['isInteractive'], undefined);
  });

  it('sizes, types and colours a symbol as the React wrapper does', () => {
    const { root, byId } = render();
    unmount = () => root.dispose();
    const heart = byId('heart').props;
    assert.equal(heart['name'], 'heart.fill');
    assert.equal(heart['type'], 'monochrome', 'the type native needs, unset');
    assert.equal(heart['tintColor'], 'red');
    assert.equal(heart['weight'], 'bold');
    assert.equal(heart['animated'], false);
    assert.equal(heart['width'], 32);
    assert.equal(heart['height'], 32);

    const palette = byId('palette').props;
    assert.equal(palette['type'], 'palette');
    assert.deepEqual(palette['colors'], ['#fff', '#fc0']);
    assert.equal(palette['animated'], true, 'an animation spec is what animates it');
    assert.deepEqual(palette['animationSpec'], { effect: { type: 'bounce' } });

    const plain = byId('default').props;
    assert.equal(plain['width'], 24, 'the wrapper s default size');
    assert.equal(plain['height'], 24);

    const unsized = byId('unsized').props;
    assert.equal(unsized['width'], 24, 'a size bound to undefined is the default too');
    assert.deepEqual(unsized['colors'], ['red'], 'one colour is a list of one');
  });

  it('gives the Apple button its type and style as native s numbers, and reports a press', () => {
    const { root, fabric, byId, presses } = render();
    unmount = () => root.dispose();
    const apple = byId('apple');
    assert.equal(apple.props['buttonType'], 1, 'continue');
    assert.equal(apple.props['buttonStyle'], 2, 'black');
    assert.equal(apple.props['cornerRadius'], 8);
    const plain = byId('plain-apple').props;
    assert.equal(plain['buttonType'], 0, 'sign-in unless set');
    assert.equal(plain['buttonStyle'], 2, 'black unless set');

    fabric.emit(apple, 'topButtonPress', {});
    root.flush();
    assert.equal(presses(), 1);
  });
});

describe('liquidGlassAvailable', () => {
  const global = globalThis as { expo?: unknown };
  const before = global.expo;
  afterEach(() => (global.expo = before));

  it('is what the glass module reports, and false without it', () => {
    global.expo = { modules: { ExpoGlassEffect: { isLiquidGlassAvailable: true } } };
    assert.equal(liquidGlassAvailable(), true);
    global.expo = { modules: { ExpoGlassEffect: { isLiquidGlassAvailable: false } } };
    assert.equal(liquidGlassAvailable(), false);
    global.expo = { modules: {} };
    assert.equal(liquidGlassAvailable(), false);
  });
});
