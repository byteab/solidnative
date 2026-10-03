import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { Queue } from '../src/app/player/queue.solid.ts';
import type { Track } from '../src/app/catalogue/catalogue.solid.ts';

// A fake player source: three tracks with no real audio behind them, so the queue's own logic -
// order, position, shuffle, repeat - is exercised with nothing native involved.
const fake = (id: string): Track => ({
  id,
  title: id,
  albumId: 'fake-album',
  artist: 'Fake Artist',
  duration: 1,
  source: -1,
});
const TRACKS = [fake('a'), fake('b'), fake('c')];

/** Memos want an owner; each test gets its own, disposed with it. */
function queue(t: { after(fn: () => void): void }): Queue {
  return createRoot((dispose) => {
    t.after(dispose);
    return new Queue();
  });
}

test('loads a queue starting at the first track', (t) => {
  const q = queue(t);
  q.load(TRACKS);
  assert.equal(q.current()?.id, 'a');
  assert.equal(q.hasPrevious(), false);
  assert.equal(q.hasNext(), true);
  assert.deepEqual(
    q.upcoming().map((x) => x.id),
    ['b', 'c'],
  );
});

test('loads a queue starting at a chosen track', (t) => {
  const q = queue(t);
  q.load(TRACKS, 'b');
  assert.equal(q.current()?.id, 'b');
});

test('next and previous move through the queue in order', (t) => {
  const q = queue(t);
  q.load(TRACKS);

  q.next();
  assert.equal(q.current()?.id, 'b');
  q.next();
  assert.equal(q.current()?.id, 'c');
  q.next();
  assert.equal(q.current()?.id, 'c'); // nothing after the last track, with repeat off
  assert.equal(q.hasNext(), false);

  q.previous();
  assert.equal(q.current()?.id, 'b');
});

test('repeating all wraps at both ends', (t) => {
  const q = queue(t);
  q.load(TRACKS);
  q.cycleRepeat(); // off -> all

  q.next();
  q.next();
  assert.equal(q.current()?.id, 'c');
  q.next();
  assert.equal(q.current()?.id, 'a');

  q.previous();
  assert.equal(q.current()?.id, 'c');
});

test('repeat cycles off, all, one', (t) => {
  const q = queue(t);
  assert.equal(q.repeat(), 'off');
  q.cycleRepeat();
  assert.equal(q.repeat(), 'all');
  q.cycleRepeat();
  assert.equal(q.repeat(), 'one');
  q.cycleRepeat();
  assert.equal(q.repeat(), 'off');
});

test('shuffling keeps the current track first and visits every track once', (t) => {
  const q = queue(t);
  q.load(TRACKS, 'b');

  q.toggleShuffle();

  assert.equal(q.current()?.id, 'b');
  const seen = new Set([q.current()!.id]);
  q.next();
  seen.add(q.current()!.id);
  q.next();
  seen.add(q.current()!.id);
  assert.deepEqual(seen, new Set(['a', 'b', 'c']));
});

test('turning shuffle off restores the original order', (t) => {
  const q = queue(t);
  q.load(TRACKS);
  q.toggleShuffle();
  q.toggleShuffle();

  assert.equal(q.current()?.id, 'a');
  q.next();
  assert.equal(q.current()?.id, 'b');
});
