import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createNativeRoot } from '@solid-native/platform/solid';
import { calmLoadingBanner, type LoadingBanner } from '../src/dev-loading-view.ts';
import { createFakeFabric } from './fake-fabric.ts';

/** The banner as one edit drives it: Expo's HMR, its bundle loader, React Native's HMR. */
function banner(clock = { now: 0 }) {
  const calls: string[] = [];
  const view: LoadingBanner = {
    showMessage: (message) => void calls.push(`show ${message}`),
    hide: () => void calls.push('hide'),
  };
  return { view, calls, at: (ms: number) => void (clock.now = ms), clock };
}

function calmed() {
  const b = banner();
  calmLoadingBanner(b.view, () => b.clock.now);
  return b;
}

describe('calmLoadingBanner', () => {
  it('turns one edit burst into one show and one hide', () => {
    // The calls and their timings, as logged on the simulator for a single save.
    const { view, calls, at } = calmed();
    view.showMessage('Refreshing...', 'refresh');
    at(1);
    view.hide();
    view.showMessage('Refreshing...', 'refresh');
    at(28);
    view.hide();
    at(492);
    view.showMessage('Downloading...', 'load');
    at(498);
    view.hide();
    at(728);
    view.hide();
    assert.deepEqual(calls, ['show Refreshing...', 'hide']);
  });

  it('shows again once the last hide has played out', () => {
    const { view, calls, at } = calmed();
    view.showMessage('Refreshing...', 'refresh');
    view.hide();
    at(5_000);
    view.showMessage('Refreshing...', 'refresh');
    view.hide();
    assert.deepEqual(calls, ['show Refreshing...', 'hide', 'show Refreshing...', 'hide']);
  });

  it('never holds back an error', () => {
    const { view, calls, at } = calmed();
    view.showMessage('Refreshing...', 'refresh');
    view.hide();
    at(10);
    view.showMessage('Fast Refresh disconnected', 'error');
    assert.deepEqual(calls, ['show Refreshing...', 'hide', 'show Fast Refresh disconnected']);
  });
});

describe('Solid native roots calm the dev banner', () => {
  const host = globalThis as Record<string, unknown>;
  afterEach(() => {
    delete host['require'];
    delete host['__DEV__'];
  });

  /** React Native's DevLoadingView behind the `require` a device bundle has. */
  function withDevLoadingView() {
    const b = banner();
    const requested: string[] = [];
    host['require'] = (id: string) => {
      requested.push(id);
      if (id === 'react-native/Libraries/Utilities/DevLoadingView') return { default: b.view };
      throw new Error(`Cannot find module '${id}'`);
    };
    return { ...b, requested };
  }

  function burst(view: LoadingBanner) {
    view.showMessage('Refreshing...', 'refresh');
    view.hide();
    view.showMessage('Refreshing...', 'refresh');
    view.hide();
  }

  it('in development, once per VM however many roots mount', () => {
    host['__DEV__'] = true;
    const { view, calls } = withDevLoadingView();
    const fabric = createFakeFabric();
    const first = createNativeRoot({ fabric, rootTag: 41 });
    const second = createNativeRoot({ fabric, rootTag: 42 });
    burst(view);
    // Wrapped twice, the second show would sneak through the first wrapper's settle window.
    assert.deepEqual(calls, ['show Refreshing...', 'hide']);
    first.dispose();
    second.dispose();
  });

  it('leaves the banner alone outside development', () => {
    host['__DEV__'] = false;
    const { view, calls, requested } = withDevLoadingView();
    const root = createNativeRoot({ fabric: createFakeFabric(), rootTag: 43 });
    burst(view);
    assert.equal(calls.length, 4);
    assert.ok(!requested.includes('react-native/Libraries/Utilities/DevLoadingView'));
    root.dispose();
  });

  it('mounts without React Native at all', () => {
    host['__DEV__'] = true;
    createNativeRoot({ fabric: createFakeFabric(), rootTag: 44 }).dispose();
  });
});
