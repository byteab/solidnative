import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createComputed, createSignal, onCleanup } from 'solid-js';
import { installJsdomEnvironment } from '../src/jsdom-env.ts';
import { mountInWebView } from '../src/solid/web-view.ts';

test('DOM initialization callback failure rolls back the page ownership claim', async () => {
  const { window: page } = installJsdomEnvironment();
  page.__solidNativeEarlyCleanup = () => {
    throw new Error('early cleanup failed');
  };
  assert.throws(() => mountInWebView(() => null), /early cleanup failed/);
  delete page.__solidNativeEarlyCleanup;
  const next = await mountInWebView(() => null).mounted;
  next.dispose();
});

test('DOM cleanup reentry never loses an accepted replacement host', async () => {
  const { document } = installJsdomEnvironment();
  let replacement, refusal;
  const first = await mountInWebView(() => {
    onCleanup(() => {
      try {
        replacement = mountInWebView(() => document.createTextNode('replacement'));
      } catch (error) {
        refusal = error;
      }
    });
    return document.createTextNode('first');
  }).mounted;
  first.dispose();
  if (replacement) {
    const next = await replacement.mounted;
    assert.equal(
      next.host.isConnected,
      true,
      'replacement accepted during cleanup must stay connected',
    );
    assert.equal(next.host.textContent, 'replacement');
    next.dispose();
  } else {
    assert.match(String(refusal), /already owns|dispos/);
    const next = await mountInWebView(() => null).mounted;
    next.dispose();
  }
});

test('DOM output reentering pagehide during component construction cannot leave newly-created effects alive', async () => {
  const { document, window: page } = installJsdomEnvironment();
  const [value, setValue] = createSignal(0);
  let runs = 0;
  page.ReactNativeWebView = {
    postMessage(data) {
      if (JSON.parse(data).type === 'output')
        page.dispatchEvent(new document.defaultView.Event('pagehide'));
    },
  };
  const ref = await mountInWebView(
    (props) => {
      props.onConstructed('hello');
      createComputed(() => {
        value();
        runs++;
      });
      return document.createTextNode('late');
    },
    { outputs: { constructed: 'onConstructed' } },
  ).mounted;
  const baseline = runs;
  setValue(1);
  assert.equal(
    runs,
    baseline,
    'owner disposed during render cannot retain subsequent computations',
  );
  assert.equal(ref.host.isConnected, false);
  ref.dispose();
});

test('DOM throwing cleanup still releases sibling reactive computations and page reuse', async () => {
  const { document } = installJsdomEnvironment();
  const [value, setValue] = createSignal(0);
  let runs = 0,
    cleaned = 0;
  const oldError = console.error;
  console.error = () => {};
  try {
    const ref = await mountInWebView(() => {
      createComputed(() => {
        value();
        runs++;
      });
      onCleanup(() => {
        cleaned++;
      });
      onCleanup(() => {
        throw new Error('cleanup failed');
      });
      return document.createTextNode('view');
    }).mounted;
    ref.dispose();
    setValue(1);
    assert.equal(runs, 1);
    assert.equal(cleaned, 1);
    const next = await mountInWebView(() => null).mounted;
    next.dispose();
  } finally {
    console.error = oldError;
  }
});
