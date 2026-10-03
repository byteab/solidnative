/**
 * The status bar, which React Native only offers as a component.
 *
 * `<StatusBar />` is a React element whose *rendering* is what applies the style, through a stack
 * of entries so a screen pushed on top can change it and the one underneath can get it back. None
 * of that survives without React, but the statics underneath do - and a stack is exactly what a
 * navigation-driven app needs, so it is kept: a screen claims the bar, and dropping the claim
 * restores whatever was underneath.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { StatusBar, useService, type StatusBarSource } from '@solid-native/device';
import { serviceWith } from './ui-services.ts';

/** What the platform was told, in order. */
function recorder() {
  const calls: [string, unknown][] = [];
  const source: StatusBarSource = {
    setStyle: (style, animated) => calls.push(['style', [style, animated]]),
    setHidden: (hidden, animation) => calls.push(['hidden', [hidden, animation]]),
    setBackgroundColor: (color, animated) => calls.push(['background', [color, animated]]),
    setTranslucent: (translucent) => calls.push(['translucent', translucent]),
    height: 47,
  };
  return { calls, source };
}

function build(source: StatusBarSource) {
  return serviceWith(StatusBar.SOURCE, source, () => useService(StatusBar));
}

describe('the status bar', () => {
  it('applies what a caller sets, and only what changed', () => {
    const { calls, source } = recorder();
    const bar = build(source);

    bar.set({ style: 'light', hidden: false });
    assert.deepEqual(calls, [
      ['style', ['light', undefined]],
      ['hidden', [false, undefined]],
    ]);
  });

  it('restores the entry underneath when a claim is dropped', () => {
    // The reason this is a stack rather than a setter. A modal makes the bar light; dismissing it
    // has to put back whatever the screen behind it asked for, which nothing else remembers.
    const { calls, source } = recorder();
    const bar = build(source);

    bar.set({ style: 'dark' });
    const claim = bar.push({ style: 'light' });
    calls.length = 0;

    claim();
    assert.deepEqual(calls, [['style', ['dark', undefined]]]);
  });

  it('keeps a property the claim above says nothing about', () => {
    // A modal that only wants light text should not un-hide a bar the screen below hid.
    const { source } = recorder();
    const bar = build(source);

    bar.set({ style: 'dark', hidden: true });
    bar.push({ style: 'light' });

    assert.deepEqual(bar.state(), { style: 'light', hidden: true });
  });

  it('reports its height, which a layout under a translucent bar needs', () => {
    const { source } = recorder();
    assert.equal(build(source).height(), 47);
  });

  it('does nothing off a device rather than throwing', () => {
    const bar = build({
      setStyle: () => {},
      setHidden: () => {},
      setBackgroundColor: () => {},
      setTranslucent: () => {},
      height: undefined,
    });
    bar.set({ style: 'light' });
    assert.equal(bar.height(), 0);
  });
});

describe('an animated status bar change', () => {
  it('fades the bar in and out, as React Native animates it', () => {
    const { calls, source } = recorder();
    build(source).set({ hidden: true, animated: true });
    assert.deepEqual(calls, [['hidden', [true, 'fade']]]);
  });
});
