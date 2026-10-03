import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { createSearchState } from '../src/app/search/search-state.solid.ts';
import {
  CATALOGUE,
  createRecentSearches,
  createStoreSearch,
  type CatalogueItem,
  type Scope,
  type StoreSearch,
} from '../src/app/search/catalogue.solid.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function setup() {
  const calls: {
    query: string;
    scope: Scope;
    signal: AbortSignal;
    resolve: (items: CatalogueItem[]) => void;
    reject: (error: Error) => void;
  }[] = [];
  const store: StoreSearch = {
    latency: 0,
    failing: false,
    requests: 0,
    cancelled: 0,
    find(query, scope, signal) {
      return new Promise((resolve, reject) =>
        calls.push({ query, scope, signal: signal!, resolve, reject }),
      );
    },
  };
  let dispose!: () => void;
  const state = createRoot((stop) => {
    dispose = stop;
    return createSearchState(store, 0);
  });
  return { state, calls, dispose };
}

test('search preserves catalogue, local scopes and recent ordering/cap across visits', () => {
  assert.equal(CATALOGUE.length, 1206);
  assert.equal(CATALOGUE[0]!.title, 'Miles Davis');
  const h = setup();
  h.state.setQuery('blue');
  assert.ok(h.state.local().length > 0);
  h.state.setScope('artist');
  assert.equal(h.state.local().length, 0);
  h.dispose();
  createRoot((dispose) => {
    const recents = createRecentSearches();
    recents.remember(' coltrane ');
    assert.deepEqual(recents.items(), ['coltrane', 'Blue Train']);
    for (let n = 0; n < 9; n++) recents.remember(String(n));
    assert.deepEqual(recents.items(), ['8', '7', '6', '5', '4', '3']);
    recents.forget('7');
    assert.equal(recents.items().includes('7'), false);
    dispose();
  });
});
test('search debounces, cancels superseded work, rejects late answers, retries and stops on disposal', async () => {
  const h = setup();
  h.state.setQuery('Blue');
  h.state.setQuery('Miles');
  assert.equal(h.calls.length, 0);
  await tick();
  await tick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0]!.query, 'Miles');
  h.state.setQuery('Coltrane');
  h.state.submit('Coltrane');
  await tick();
  assert.ok(h.calls[0]!.signal.aborted);
  h.calls[0]!.resolve([{ id: 'stale', kind: 'song', title: 'Stale', subtitle: '' }]);
  await tick();
  assert.deepEqual(h.state.remote(), []);
  h.calls[1]!.reject(new Error('offline'));
  await tick();
  assert.equal(h.state.status(), 'failed');
  h.state.reload();
  await tick();
  assert.equal(h.calls.length, 3);
  h.calls[2]!.resolve([{ id: 'fresh', kind: 'song', title: 'Fresh', subtitle: '' }]);
  await tick();
  assert.equal(h.state.remote()[0]!.id, 'fresh');
  h.state.setScope('album');
  await tick();
  assert.equal(h.calls.at(-1)!.scope, 'album');
  const latest = h.calls.at(-1)!;
  h.dispose();
  assert.ok(latest.signal.aborted);
  latest.resolve([{ id: 'late', kind: 'album', title: 'Late', subtitle: '' }]);
  await tick();
  assert.deepEqual(h.state.remote(), []);
});
test('aborting an old search cannot steal a reentrant newer request', async () => {
  const h = setup();
  h.state.submit('first');
  await tick();
  h.calls[0]!.signal.addEventListener('abort', () => h.state.submit('newest'));
  h.state.submit('second');
  await tick();
  assert.equal(h.calls.at(-1)!.query, 'newest');
  h.dispose();
  assert.ok(h.calls.at(-1)!.signal.aborted);
});
test('store removes finished abort listeners and already aborted calls cancel promptly', async () => {
  const store = createStoreSearch();
  store.latency = 0;
  const done = new AbortController();
  assert.equal((await store.find('long query', 'all', done.signal)).length, 8);
  done.abort();
  assert.equal(store.cancelled, 0);
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(store.find('x', 'all', aborted.signal), { name: 'AbortError' });
  assert.equal(store.cancelled, 1);
});
