/**
 * Deep links into a native navigation, without a device.
 *
 * The router owns its own stack (covered in `packages/router/solid-tests`). This file covers the
 * deep-link contract: launch on the link the app was opened with, start at the root
 * otherwise, follow a link that arrives while running, and leave one for the current entry alone.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRoot } from 'solid-js';
import { bindNativeNavigation, type NativeNavigation } from '@solid-native/router';

/** Just the part of a navigation the binding reads, recording every path it pushes. */
function fakeNavigation(url = '/') {
  const pushed: string[] = [];
  let at = url;
  const navigation = {
    disposed: false,
    url: () => at,
    current: () => (at === url && pushed.length === 0 ? undefined : {}),
    busy: () => false,
    canGoBack: () => pushed.length > 0,
    back: async () => true,
    pushStack: async (paths: readonly string[]) => {
      pushed.push(...paths);
      at = paths.at(-1)!;
      return true;
    },
  } as unknown as NativeNavigation;
  return { navigation, pushed };
}

function links(initialUrl: string | null) {
  let listener: ((path: string) => void) | null = null;
  return {
    source: {
      ready: Promise.resolve(),
      initialUrl: () => initialUrl,
      subscribe: (fn: (path: string) => void) => {
        listener = fn;
        return () => (listener = null);
      },
    },
    arrive: (path: string) => listener!(path),
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('deep links', () => {
  it('opens on the url the app was launched with', async () => {
    const { navigation, pushed } = fakeNavigation();
    const { source } = links('/users/7');
    const binding = createRoot(() => bindNativeNavigation(navigation, { links: source }));
    assert.equal(await binding.ready, true);
    assert.deepEqual(pushed, ['/users/7']);
  });

  it('starts at the root when the app was launched normally', async () => {
    const { navigation, pushed } = fakeNavigation();
    const { source } = links(null);
    const binding = createRoot(() => bindNativeNavigation(navigation, { links: source }));
    assert.equal(await binding.ready, true);
    assert.deepEqual(pushed, ['/']);
  });

  it('navigates to a link that arrives while running', async () => {
    const { navigation, pushed } = fakeNavigation();
    const { source, arrive } = links('/users/7');
    const binding = createRoot(() => bindNativeNavigation(navigation, { links: source }));
    await binding.ready;
    arrive('/settings');
    await settle();
    assert.equal(navigation.url(), '/settings');
    assert.deepEqual(pushed, ['/users/7', '/settings']);
  });

  it('leaves a link that arrives on the entry it is already on alone', async () => {
    const { navigation, pushed } = fakeNavigation();
    const { source, arrive } = links('/users/7');
    const binding = createRoot(() => bindNativeNavigation(navigation, { links: source }));
    await binding.ready;
    arrive('/users/7');
    await settle();
    assert.deepEqual(
      pushed,
      ['/users/7'],
      'no navigation, so no duplicate entry to go back through',
    );
  });
});
