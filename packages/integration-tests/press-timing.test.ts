/**
 * `minPressDuration`: a quick tap still shows its pressed look for that long, as React Native's
 * Pressability does, so a tap is visible at all. Press itself is not delayed, only press-out.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { cleanup, fireEvent, render, screen } from '@solidnative/testing';
import { createPressTiming } from './ui-press-fixture.tsx';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function quickTap() {
  const at = { pageX: 1, pageY: 1, touches: [{ pageX: 1, pageY: 1 }] };
  await fireEvent(screen.getByTestId('timed'), 'topTouchStart', at);
  await fireEvent(screen.getByTestId('timed'), 'topTouchEnd', { ...at, touches: [] });
}

describe('minPressDuration', () => {
  afterEach(cleanup);

  it('keeps the pressed look for minPressDuration on a quick tap', async () => {
    const { PressTiming, log } = createPressTiming(300);
    render(PressTiming);
    const tapped = Date.now();
    await quickTap();
    assert.deepEqual(log, ['in', 'press'], 'press-out waits');
    await wait(200); // past the 130ms default, so a minimum that was ignored shows here
    // A loaded machine can run this late, never early: only claim "not yet" while it is not yet.
    if (Date.now() - tapped < 290) assert.deepEqual(log, ['in', 'press'], 'still inside it');
    await wait(250);
    assert.deepEqual(log, ['in', 'press', 'out']);
  });

  it('defaults to 130ms, as React Native does', async () => {
    const { PressTiming, log } = createPressTiming();
    render(PressTiming);
    const tapped = Date.now();
    await quickTap();
    assert.deepEqual(log, ['in', 'press'], 'press-out waits');
    await wait(60);
    if (Date.now() - tapped < 120) assert.deepEqual(log, ['in', 'press'], 'still inside it');
    await wait(250);
    assert.deepEqual(log, ['in', 'press', 'out']);
  });

  it('releases at once with a minimum of zero', async () => {
    const { PressTiming, log } = createPressTiming(0);
    render(PressTiming);
    await quickTap();
    assert.deepEqual([...log].sort(), ['in', 'out', 'press'], 'press-out is not deferred');
  });
});
