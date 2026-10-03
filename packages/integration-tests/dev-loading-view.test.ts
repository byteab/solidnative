import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calmLoadingBanner, type LoadingBanner } from '../platform/src/dev-loading-view.ts';

/** The banner as one edit drives it: Expo's HMR, its bundle loader, React Native's HMR. */
function banner() {
  let clock = 0;
  const calls: string[] = [];
  const view: LoadingBanner = {
    showMessage: (message) => void calls.push(`show ${message}`),
    hide: () => void calls.push('hide'),
  };
  calmLoadingBanner(view, () => clock);
  return { view, calls, at: (ms: number) => void (clock = ms) };
}

describe('calmLoadingBanner', () => {
  it('turns one edit burst into one show and one hide', () => {
    // The calls and their timings, as logged on the simulator for a single save.
    const { view, calls, at } = banner();
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
    const { view, calls, at } = banner();
    view.showMessage('Refreshing...', 'refresh');
    view.hide();
    at(5_000);
    view.showMessage('Refreshing...', 'refresh');
    view.hide();
    assert.deepEqual(calls, ['show Refreshing...', 'hide', 'show Refreshing...', 'hide']);
  });

  it('never holds back an error', () => {
    const { view, calls, at } = banner();
    view.showMessage('Refreshing...', 'refresh');
    view.hide();
    at(10);
    view.showMessage('Fast Refresh disconnected', 'error');
    assert.deepEqual(calls, ['show Refreshing...', 'hide', 'show Fast Refresh disconnected']);
  });
});
