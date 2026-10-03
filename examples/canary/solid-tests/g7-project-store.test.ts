import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import {
  createProjectStore,
  ProjectBackend,
  type Task,
} from '../src/app/projects/project-data.solid.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function boot() {
  const server = new ProjectBackend();
  server.latency = 0;
  let dispose!: () => void;
  const store = createRoot((cleanup) => {
    dispose = cleanup;
    return createProjectStore(server);
  });
  await store.load();
  return { server, store, dispose };
}

test('real project seed, optimistic save, rollback, duplicate and delete remain shared', async () => {
  const { server, store, dispose } = await boot();
  assert.equal(store.projects().length, 6);
  assert.equal(store.tasks().size, 240);
  assert.equal(store.comments().length, 720);
  const task = store.task('t2')!;
  const promise = store.save({ ...task, title: 'Edited' });
  assert.equal(store.task('t2')?.title, 'Edited');
  await promise;
  assert.equal(store.task('t2')?.version, 2);
  server.offline = true;
  await store.save({ ...store.task('t2')!, title: 'Rejected' });
  assert.equal(store.task('t2')?.title, 'Edited');
  assert.equal(store.notice(), 'Could not save the task');
  store.dismissNotice();
  server.offline = false;
  const copy = store.duplicate('t2')!;
  assert.equal(store.task(copy.id)?.title, 'Edited (copy)');
  await store.remove('t2');
  assert.equal(store.task('t2'), undefined);
  dispose();
});

test('out-of-order writes and failed deletion never overwrite a newer local edit', async () => {
  const { server, store, dispose } = await boot();
  const first = deferred<Task>();
  const second = deferred<Task>();
  const task = store.task('t1')!;
  let count = 0;
  server.save = () => (++count === 1 ? first.promise : second.promise);
  const p1 = store.save({ ...task, title: 'Older' });
  const p2 = store.save({ ...task, title: 'Newer' });
  second.resolve({ ...task, title: 'Newer', version: 3 });
  await p2;
  first.resolve({ ...task, title: 'Older', version: 2 });
  await p1;
  assert.equal(store.task('t1')?.title, 'Newer');
  const remove = deferred<void>();
  server.remove = () => remove.promise;
  const deletion = store.remove('t1');
  server.save = async (task) => ({ ...task, version: 4 });
  await store.save({ ...task, title: 'Restored' });
  remove.reject(new Error('offline'));
  await deletion;
  assert.equal(store.task('t1')?.title, 'Restored');
  assert.equal(store.notice(), null);
  dispose();
});

test('a stale refresh cannot resurrect a confirmed deletion or overwrite a confirmed save', async () => {
  const { server, store, dispose } = await boot();
  const stale = [...store.tasks().values()];
  const read = deferred<Task[]>();
  server.tasks = () => read.promise;
  const loading = store.load();
  await store.remove('t1');
  await store.save({ ...store.task('t2')!, title: 'After refresh began' });
  read.resolve(stale);
  await loading;
  assert.equal(store.task('t1'), undefined);
  assert.equal(store.task('t2')?.title, 'After refresh began');
  dispose();
});

test('store disposal prevents late loading, save and rollback publications', async () => {
  const { server, store, dispose } = await boot();
  const response = deferred<Task>();
  server.save = () => response.promise;
  const pending = store.save({ ...store.task('t1')!, title: 'Pending' });
  dispose();
  response.reject(new Error('late'));
  await pending;
  assert.equal(store.task('t1')?.title, 'Pending');
  assert.equal(store.notice(), null);
});

test('a failed edit cannot hide a newer server version arriving in an already-running refresh', async (t) => {
  const { store, server, dispose } = await boot();
  t.after(dispose);
  const original = store.task('t2')!;
  const remote = { ...original, title: 'Changed remotely', version: original.version + 1 };
  const response = deferred<Task[]>();
  server.tasks = () => response.promise;
  const refresh = store.load();
  server.save = async () => {
    throw new Error('write rejected');
  };
  await store.save({ ...original, title: 'Rejected local edit' });
  response.resolve(
    [...store.tasks().values()].map((task) => (task.id === original.id ? remote : task)),
  );
  await refresh;
  assert.equal(store.task(original.id)?.title, remote.title);
  assert.equal(store.task(original.id)?.version, remote.version);
});

test('a failed stale editor save cannot resurrect a task absent from the last successful refresh', async (t) => {
  const { store, server, dispose } = await boot();
  t.after(dispose);
  const original = store.task('t2')!;
  const remaining = [...store.tasks().values()].filter((task) => task.id !== original.id);
  server.tasks = async () => remaining;
  await store.load();
  assert.equal(store.task(original.id), undefined);
  server.save = async () => {
    throw new Error('deleted by another person');
  };
  await store.save({ ...original, title: 'Stale edit' });
  assert.equal(store.task(original.id), undefined);
});
