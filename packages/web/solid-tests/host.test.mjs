import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot, createSignal, createEffect, getOwner, onCleanup } from 'solid-js';
import { installJsdomEnvironment } from '../src/jsdom-env.ts';
import {
  mountBrowser,
  createBrowserRoot,
  createElement,
  insert,
  spread,
  useHostAdapter,
} from '../src/solid/index.ts';
import { HostFixture } from './host.solid.tsx';

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function setup() {
  const { document, window } = installJsdomEnvironment();
  return { document, window, element: document.getElementById('app-root') };
}
test('shared Solid controls, keyed identity, conditional owners and reactive props run on BrowserEngine', async () => {
  const { document, window, element } = setup();
  let disposed = 0,
    change;
  const [label, setLabel] = createSignal('first');
  const root = mountBrowser(
    () =>
      HostFixture({
        get label() {
          return label();
        },
        onChange: (value) => (change = value),
        cleanup: () => disposed++,
      }),
    element,
  );
  try {
    const one = document.getElementById('one');
    setLabel('second');
    assert.match(element.textContent, /second/);
    const input = document.getElementById('input');
    input.value = 'edited';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(change, 'edited');
    const rejected = document.getElementById('reject');
    rejected.value = 'no';
    rejected.dispatchEvent(new window.Event('input', { bubbles: true }));
    await settle();
    assert.equal(rejected.value, 'fixed');
    const control = document.getElementById('switch');
    control.checked = true;
    control.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(document.getElementById('conditional').textContent, 'edited');
    document
      .getElementById('reverse')
      .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(document.getElementById('one'), one);
    assert.deepEqual(
      [...element.querySelectorAll('[id="one"],[id="two"],[id="three"]')].map((n) => n.id),
      ['three', 'two', 'one'],
    );
    assert.equal(
      element
        .querySelector('.label')
        .getAttributeNames()
        .some((n) => n.startsWith('data-s-')),
      true,
    );
    assert.equal(document.querySelectorAll('[data-solidnative-style]').length, 1);
  } finally {
    root.dispose();
  }
  assert.equal(disposed, 1);
  assert.equal(element.children.length, 0);
  assert.equal(document.querySelectorAll('[data-solidnative-style]').length, 0);
});
test('root teardown cancels observers, callbacks and sibling effects after a throwing cleanup', async () => {
  const { element } = setup();
  let disconnects = 0,
    runs = 0,
    barriers = 0;
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {
      disconnects++;
    }
  };
  const [value, setValue] = createSignal(0);
  const errors = [];
  const root = mountBrowser(
    () => {
      const view = createElement('view');
      spread(view, { onLayout() {} });
      createEffect(() => {
        value();
        runs++;
      });
      onCleanup(() => {
        throw new Error('cleanup failure');
      });
      return view;
    },
    element,
    { onError: (error) => errors.push(error) },
  );
  root.afterCommit(() => barriers++);
  root.dispose();
  root.dispose();
  const before = runs;
  setValue(1);
  await settle();
  assert.equal(runs, before);
  assert.equal(barriers, 0);
  assert.equal(disconnects, 1);
  assert.equal(errors.length, 1);
});
test('two roots isolate keyboard responders and releasing one retains shared styles', () => {
  const { document, window, element } = setup();
  const other = document.createElement('div');
  document.body.append(other);
  const a = mountBrowser(() => HostFixture({ label: 'a' }), element);
  const b = mountBrowser(() => HostFixture({ label: 'b' }), other);
  try {
    other
      .querySelector('[id="reverse"]')
      .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(other.querySelectorAll('[id="one"],[id="two"],[id="three"]')[0].id, 'three');
    assert.equal(element.querySelectorAll('[id="one"],[id="two"],[id="three"]')[0].id, 'one');
    a.dispose();
    assert.equal(document.querySelectorAll('[data-solidnative-style]').length, 1);
  } finally {
    a.dispose();
    b.dispose();
  }
});
test('failed mount and disposal during construction release the root lease and all effects', async () => {
  const { element } = setup();
  const errors = [];
  assert.throws(
    () =>
      mountBrowser(
        () => {
          onCleanup(() => {
            throw new Error('cleanup');
          });
          throw new Error('mount');
        },
        element,
        { onError: (e) => errors.push(e) },
      ),
    /mount/,
  );
  const root = createBrowserRoot(element);
  const [value, setValue] = createSignal(0);
  let runs = 0;
  root.render(() => {
    root.dispose();
    createEffect(() => {
      value();
      runs++;
    });
    return null;
  });
  const previous = runs;
  setValue(1);
  await settle();
  assert.equal(runs, previous);
  const replacement = mountBrowser(() => createElement('text'), element);
  replacement.dispose();
});
test('retained detach keeps identity but attachment-sensitive commands and released bindings stop', async () => {
  const { element } = setup();
  let adapter, parent, child;
  const root = mountBrowser(() => {
    adapter = useHostAdapter();
    parent = createElement('view');
    child = createElement('text');
    insert(parent, child);
    return parent;
  }, element);
  assert.equal(adapter.isAttached(child), true);
  assert.throws(() => adapter.createElement('view'), /owner/);
  root.dispose();
  assert.equal(adapter.isAttached(child), false);
  await settle();
});
test('owned islands inherit owner disposal without destroying a sibling app', () => {
  const { document, element } = setup();
  const other = document.createElement('div');
  document.body.append(other);
  let dispose, island;
  const sibling = mountBrowser(() => createElement('text'), other);
  createRoot((d) => {
    dispose = d;
    island = mountBrowser(() => createElement('text'), element, {
      owner: getOwner(),
      island: true,
    });
  });
  dispose();
  assert.equal(island.disposed, true);
  assert.equal(sibling.disposed, false);
  island.dispose();
  sibling.dispose();
});
