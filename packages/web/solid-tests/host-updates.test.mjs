import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEffect, createRoot, createSignal } from 'solid-js';
import { installJsdomEnvironment } from '../src/jsdom-env.ts';
import { Island, createElement, mountBrowser, setNativeStyleHost } from '../src/solid/index.ts';

test('Island keeps its platform marker through class, input and component updates', () => {
  const { document } = installJsdomEnvironment();
  const [inputs, setInputs] = createSignal({});
  const [name, setName] = createSignal('first');
  const [component, setComponent] = createSignal(() => createElement('view'));
  let island, dispose;
  createRoot((stop) => {
    dispose = stop;
    island = Island({
      document,
      get component() {
        return component();
      },
      get inputs() {
        return inputs();
      },
      get class() {
        return name();
      },
    });
  });
  try {
    setInputs({ changed: true });
    assert.ok(island.classList.contains('platform-web'));
    setName('second');
    assert.ok(island.classList.contains('platform-web'));
    assert.ok(island.classList.contains('second'));
    assert.ok(!island.classList.contains('first'));
    setComponent(() => () => createElement('text'));
    assert.ok(island.classList.contains('platform-web'));
  } finally {
    dispose();
  }
});

test('replacing and clearing a style host removes the previous selector marker', () => {
  const { document } = installJsdomEnvironment();
  const first = { browser: true, id: 'first', css: '[data-h-first]{color:red}' };
  const second = { browser: true, id: 'second', css: '[data-h-second]{color:blue}' };
  const [sheet, setSheet] = createSignal(first);
  let node;
  const root = mountBrowser(() => {
    node = createElement('view');
    createEffect(() => setNativeStyleHost(node, sheet()));
    return node;
  }, document.getElementById('app-root'));
  try {
    assert.ok(node.el.hasAttribute('data-h-first'));
    assert.throws(
      () => setSheet({ ...first, css: '[data-h-first]{color:green}' }),
      /Conflicting browser stylesheet/,
    );
    assert.ok(node.el.hasAttribute('data-h-first'));
    setSheet(second);
    assert.ok(node.el.hasAttribute('data-h-second'));
    assert.ok(!node.el.hasAttribute('data-h-first'));
    setSheet(null);
    assert.ok(!node.el.hasAttribute('data-h-second'));
  } finally {
    root.dispose();
  }
  assert.equal(document.querySelectorAll('[data-solid-native-style]').length, 0);
});
