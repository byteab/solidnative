/**
 * A whole style object set as the `style` prop, which is how `AnimatedStyle` writes every frame
 * and how swipe-refresh-layout positions its scroll view.
 *
 * A `setProp(node, 'style', {...})` goes through `applyProp`, which once had no handler for
 * `style` and wrote only strings, numbers and booleans as attributes - so the object was dropped,
 * and a fade or a slide-in stood still in a browser while it moved on a device. The static style
 * string and the `style:key` bindings are covered in `solid-tests/styles.test.ts`.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { installJsdomEnvironment } from './jsdom-env.ts';
import type { BrowserEngine as Engine } from './browser-engine.ts';

describe('a style object set as a prop', () => {
  let BrowserEngine: typeof Engine;
  let document: Document;
  before(async () => {
    ({ document } = installJsdomEnvironment());
    ({ BrowserEngine } = await import('./browser-engine.ts'));
  });

  const scene = () => {
    const engine = new BrowserEngine(document);
    const node = engine.createElementNode('view');
    return { engine, node, style: (node.el as HTMLElement).style };
  };

  it('writes every key, in CSS units, with a transform list as a CSS transform', () => {
    const { engine, node, style } = scene();
    engine.setProp(node, 'style', {
      opacity: 0.5,
      top: 12,
      backgroundColor: 'red',
      transform: [{ translateY: 10 }, { scale: 0.5 }, { rotate: '45deg' }],
    });
    assert.equal(style.opacity, '0.5');
    assert.equal(style.top, '12px');
    assert.equal(style.backgroundColor, 'red');
    assert.equal(style.transform, 'translateY(10px) scale(0.5) rotate(45deg)');
  });

  it('takes the keys the renderer mirrored, already dash-cased, alongside camel-cased ones', () => {
    // `AnimatedStyle` merges an animation frame into the object the renderer keeps in sync.
    const { engine, node, style } = scene();
    engine.setProp(node, 'style', { 'margin-top': 4, opacity: 1 });
    assert.equal(style.marginTop, '4px');
    assert.equal(style.opacity, '1');
  });

  it('removes a key the next object leaves out, and everything when cleared', () => {
    const { engine, node, style } = scene();
    engine.setProp(node, 'style', { opacity: 0.5, top: 12 });
    engine.setProp(node, 'style', { opacity: 1 });
    assert.equal(style.top, '');
    assert.equal(style.opacity, '1');
    engine.setProp(node, 'style', null);
    assert.equal(style.opacity, '');
  });
});
