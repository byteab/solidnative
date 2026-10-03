/**
 * `stopPropagation` on the web host, which has to behave as the Fabric engine's does: a listener
 * that calls it stops the bubble after its own node, and other listeners on that node still run.
 * The web host used to hand listeners a plain `{ nativeEvent }`, so the call itself threw.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { installJsdomEnvironment } from './jsdom-env.ts';
import type { BrowserEngine as Engine } from './browser-engine.ts';

describe('stopPropagation on the web host', () => {
  let BrowserEngine: typeof Engine;
  let document: Document;

  before(async () => {
    document = installJsdomEnvironment().document;
    ({ BrowserEngine } = await import('./browser-engine.ts'));
  });

  function tree() {
    const engine = new BrowserEngine(document);
    const parent = engine.createElementNode('view');
    const child = engine.createElementNode('view');
    child.parent = parent;
    return { engine, parent, child };
  }

  it('stops the bubble after the node whose listener called it', () => {
    const { engine, parent, child } = tree();
    const heard: string[] = [];
    engine.setEventListener(child, 'topPress', (event) => {
      heard.push('child');
      (event as { stopPropagation(): void }).stopPropagation();
    });
    engine.setEventListener(parent, 'topPress', () => heard.push('parent'));

    engine.dispatchEvent(child, 'topPress', {});
    assert.deepEqual(heard, ['child']);
  });

  it('still runs the other listeners on the node that stopped it', () => {
    const { engine, child } = tree();
    const heard: string[] = [];
    engine.setEventListener(child, 'topPress', (event) => {
      heard.push('first');
      (event as { stopPropagation(): void }).stopPropagation();
    });
    engine.setEventListener(child, 'topPress', () => heard.push('second'));

    engine.dispatchEvent(child, 'topPress', {});
    assert.deepEqual(heard, ['first', 'second']);
  });

  it('bubbles as before when nothing stops it', () => {
    const { engine, parent, child } = tree();
    const heard: string[] = [];
    engine.setEventListener(child, 'topPress', () => heard.push('child'));
    engine.setEventListener(parent, 'topPress', () => heard.push('parent'));

    engine.dispatchEvent(child, 'topPress', {});
    assert.deepEqual(heard, ['child', 'parent']);
  });
});
