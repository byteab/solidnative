import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot, createRenderEffect, createSignal } from 'solid-js';
import { FeedBackendSource, makePost } from '../src/app/feed/feed-backend.solid.ts';
import { createFeedStore } from '../src/app/feed/feed-store.solid.ts';
import { ChatBackendSource } from '../src/app/chat/chat-backend.solid.ts';
import { createChatStore } from '../src/app/chat/chat-store.solid.ts';
import { shelves, rowsOf, ShelfPositionsSource } from '../src/app/browse/browse-shelves.solid.ts';
import { createInbox, mailbox } from '../src/app/inbox/inbox-model.solid.ts';
const deferred = <T>() => {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const tick = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

test('feed preserves 20,000 generated posts, pages, refresh overlap, edit, removal and gallery state', async (t) => {
  const backend = new FeedBackendSource();
  backend.latency = 0;
  const store = createRoot((dispose) => {
    t.after(dispose);
    return createFeedStore(backend);
  });
  await store.loadMore();
  assert.equal(store.posts().length, 25);
  assert.deepEqual(store.posts()[0], makePost(100000));
  const second = store.posts()[1];
  store.edit('p100000');
  assert.match(store.posts()[0]!.text, /edited 1/);
  assert.equal(store.posts()[1], second);
  store.setGalleryPage('p100000', 2);
  assert.equal(store.galleryPage('p100000'), 2);
  await store.refresh();
  assert.equal(store.posts().length, 28);
  assert.equal(store.unseen(), 3);
  await store.loadMany(5000);
  assert.ok(store.posts().length >= 5000);
  assert.equal(new Set(store.posts().map((post) => post.id)).size, store.posts().length);
  store.remove('p100000');
  assert.ok(!store.posts().some((post) => post.id === 'p100000'));
  const all = await backend.page(null, backend.total);
  assert.equal(all.posts.length, 20000);
  assert.equal(all.next, null);
});

test('feed failed initial/page/refresh retry and latest optimistic failure preserve unrelated posts', async (t) => {
  const backend = new FeedBackendSource();
  backend.latency = 0;
  backend.failNext = true;
  const store = createRoot((dispose) => {
    t.after(dispose);
    return createFeedStore(backend);
  });
  await store.loadMore();
  assert.equal(store.pageState(), 'failed');
  await store.loadMore();
  assert.equal(store.posts().length, 25);
  const other = store.posts()[1],
    post = store.posts()[0]!;
  backend.offline = true;
  store.toggleLike(post.id);
  assert.equal(store.posts()[0]!.liked, true);
  await tick();
  assert.equal(store.posts()[0]!.liked, false);
  assert.equal(store.posts()[1], other);
  store.toggleBookmark(post.id);
  await tick();
  assert.equal(store.posts()[0]!.bookmarked, false);
  assert.equal(store.notice(), 'Could not save the bookmark');
  await store.refresh();
  assert.equal(store.notice(), 'Could not refresh the feed');
  assert.equal(store.refreshing(), false);
});

test('feed suppresses stale reset/disposal and never spins loadMany behind a pending page', async () => {
  const backend = new FeedBackendSource(),
    first = deferred<{ posts: readonly ReturnType<typeof makePost>[]; next: number | null }>();
  let requests = 0;
  backend.page = () => {
    requests++;
    return first.promise;
  };
  let dispose!: () => void;
  const store = createRoot((stop) => {
    dispose = stop;
    return createFeedStore(backend);
  });
  const load = store.loadMore();
  await store.loadMany(5000);
  assert.equal(requests, 1);
  dispose();
  first.resolve({ posts: [makePost(1)], next: null });
  await load;
  assert.deepEqual(store.posts(), []);
});

test('feed optimistic responses from older epochs and taps cannot rewrite current confirmation', async (t) => {
  const backend = new FeedBackendSource();
  backend.latency = 0;
  const pending: ReturnType<typeof deferred<void>>[] = [];
  backend.setLiked = () => {
    const next = deferred<void>();
    pending.push(next);
    return next.promise;
  };
  const store = createRoot((dispose) => {
    t.after(dispose);
    return createFeedStore(backend);
  });
  await store.loadMore();
  const id = store.posts()[0]!.id;
  store.toggleLike(id);
  await tick();
  store.toggleLike(id);
  await tick();
  pending[0]!.resolve();
  await tick();
  pending[1]!.reject();
  await tick();
  assert.equal(store.posts()[0]!.liked, false);
  store.toggleLike(id);
  await tick();
  await store.reset();
  pending[2]!.reject();
  await tick();
  assert.equal(store.notice(), null);
});

test('feed loading publication may synchronously dispose before a backend call', async () => {
  const backend = new FeedBackendSource();
  let calls = 0;
  backend.page = async () => {
    calls++;
    return { posts: [], next: null };
  };
  let dispose!: () => void;
  const store = createRoot((stop) => {
    dispose = stop;
    const value = createFeedStore(backend);
    createRenderEffect(() => {
      if (value.pageState() === 'loading') stop();
    });
    return value;
  });
  await store.loadMore();
  assert.equal(calls, 0);
  dispose();
});

test('chat keeps full history, retries initial failure and duplicate history and send failures', async (t) => {
  const backend = new ChatBackendSource();
  backend.latency = 0;
  const store = createRoot((dispose) => {
    t.after(dispose);
    return createChatStore(backend, () => true);
  });
  const history = backend.history.bind(backend);
  let fail = true;
  backend.history = (...args) => (fail ? Promise.reject(new Error('offline')) : history(...args));
  await store.loadOlder();
  assert.equal(store.historyFailed(), true);
  fail = false;
  await Promise.all([store.loadOlder(), store.loadOlder()]);
  assert.equal(store.messages().length, 40);
  assert.equal(store.historyRequests, 2);
  backend.offline = true;
  store.send('  hello  ');
  await tick();
  assert.equal(store.messages()[0]!.state, 'failed');
  assert.equal(store.messages()[0]!.text, 'hello');
  backend.offline = false;
  store.retry(store.messages()[0]!.id);
  await tick();
  assert.equal(store.messages()[0]!.state, 'sent');
  const all = await backend.history(null, 3000);
  assert.equal(all.messages.length, 3000);
  assert.equal(all.before, null);
  assert.deepEqual(all.messages[0], backend.historic(2999));
});

test('chat cancels typing/live work on coverage and ignores pending delivery/history after disposal', async () => {
  const backend = new ChatBackendSource();
  backend.latency = 0;
  let dispose!: () => void, setFront!: (value: boolean) => boolean;
  const store = createRoot((stop) => {
    dispose = stop;
    const [front, set] = createSignal(true);
    setFront = set;
    return createChatStore(backend, front);
  });
  store.receive(5);
  store.startLive(5);
  assert.equal(store.typing(), true);
  setFront(false);
  setFront(true);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(store.typing(), false);
  assert.equal(store.isLive(), false);
  assert.deepEqual(store.messages(), []);
  const history = deferred<{
    messages: readonly ReturnType<typeof backend.historic>[];
    before: null;
  }>();
  backend.history = () => history.promise;
  const pending = store.loadOlder();
  store.send('pending');
  dispose();
  history.resolve({ messages: [backend.historic(1)], before: null });
  await pending;
  await tick();
  assert.equal(store.messages().length, 1);
  assert.equal(store.messages()[0]!.state, 'sending');
});

test('browse retains all24 shelves/720 albums and per-shelf offsets; inbox retains all120 mails and bulk selection', (t) => {
  assert.equal(shelves().length, 24);
  assert.equal(rowsOf(shelves()).length, 48);
  assert.equal(shelves().flatMap((shelf) => shelf.albums).length, 720);
  const positions = new ShelfPositionsSource();
  positions.set('g0', 528);
  assert.equal(positions.get('g0'), 528);
  assert.equal(positions.get('g1'), 0);
  const inbox = createRoot((dispose) => {
    t.after(dispose);
    return createInbox();
  });
  assert.deepEqual(inbox.mails(), mailbox());
  assert.equal(inbox.inbox().length, 103);
  assert.equal(inbox.archive().length, 17);
  inbox.toggleSelected('m0');
  inbox.toggleSelected('m1');
  inbox.archiveSelected();
  assert.equal(inbox.archive().length, 19);
  assert.equal(inbox.selected().size, 0);
  inbox.markRead('m0');
  assert.equal(inbox.mails()[0]!.unread, false);
  inbox.remove('m0');
  assert.equal(inbox.mails().length, 119);
});
