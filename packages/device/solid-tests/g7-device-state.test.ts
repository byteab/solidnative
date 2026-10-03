import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot, getOwner, runWithOwner, type Owner } from 'solid-js';
import { provideService, useService, withServiceScope } from '@solidnative/device/solid';
import { AppState, appStateSource, type AppStatus } from '@solidnative/device/solid';
import { Direction, directionSource, type LayoutDirection } from '@solidnative/device/solid';
import { deferred, scope, service } from './g7-device-utils.ts';

test('app state is lazy and stays app-owned when first requested by a transient scope', () => {
  let subscriptions = 0;
  let removals = 0;
  let emit!: (state: AppStatus) => void;
  let parent: Owner | null = null;
  let app!: AppState;
  const root = scope(() =>
    withServiceScope(
      [
        provideService(AppState.SOURCE, () => ({
          current: () => 'inactive',
          subscribe(listener) {
            subscriptions++;
            emit = listener;
            return () => void removals++;
          },
        })),
      ],
      () => {
        parent = getOwner();
      },
    ),
  );
  assert.equal(subscriptions, 0);
  const screen = runWithOwner(parent, () =>
    scope(() =>
      withServiceScope([], () => {
        app = useService(AppState);
      }),
    ),
  )!;
  assert.equal(app.current(), 'inactive');
  assert.equal(app.active(), false);
  screen.dispose();
  assert.equal(removals, 0);
  emit('active');
  assert.equal(app.active(), true);
  root.dispose();
  root.dispose();
  emit('background');
  assert.equal(app.current(), 'active');
  assert.equal(removals, 1);
});

test('app state subscribes before snapshot and live events beat synchronous and asynchronous reads', async () => {
  for (const asynchronous of [false, true]) {
    const first = deferred<AppStatus>();
    const calls: string[] = [];
    let emit!: (state: AppStatus) => void;
    const root = service(AppState, {
      current: () => {
        calls.push('current');
        return asynchronous ? first.promise : 'active';
      },
      subscribe(listener) {
        calls.push('subscribe');
        emit = listener;
        listener('background');
        return () => {};
      },
    });
    assert.deepEqual(calls, ['subscribe', 'current']);
    assert.equal(root.value.current(), 'background');
    first.resolve('active');
    await first.promise;
    assert.equal(root.value.active(), false);
    emit('inactive');
    assert.equal(root.value.active(), false);
    emit('active');
    assert.equal(root.value.active(), true);
    root.dispose();
  }
});

test('app state failed or disposed initial snapshots cannot revive the service', async () => {
  for (const failure of ['throw', 'reject', 'late'] as const) {
    const first = deferred<AppStatus>();
    const root = service(AppState, {
      current: () => {
        if (failure === 'throw') throw new Error('unavailable');
        if (failure === 'reject') return Promise.reject(new Error('unavailable'));
        return first.promise;
      },
      subscribe: () => () => {},
    });
    assert.equal(root.value.current(), 'active');
    root.dispose();
    first.resolve('background');
    await first.promise;
    assert.equal(root.value.current(), 'active');
  }
});

test('app state rolls back subscription acquisition if the service scope dies synchronously', () => {
  let removals = 0;
  let reads = 0;
  createRoot((dispose) => {
    assert.throws(
      () =>
        withServiceScope(
          [
            provideService(AppState.SOURCE, () => ({
              current: () => {
                reads++;
                return 'active';
              },
              subscribe() {
                dispose();
                return () => void removals++;
              },
            })),
          ],
          () => useService(AppState),
        ),
      /disposed while creating/,
    );
  });
  // ServiceScope completes a pending factory before releasing it; the snapshot is never exposed.
  assert.equal(reads, 1);
  assert.equal(removals, 1);
});

test('native AppState normalization follows RN change events and releases the native listener', () => {
  let callback!: (state: string) => void;
  let removes = 0;
  const native = {
    AppState: {
      currentState: null as string | null,
      addEventListener(event: 'change', listener: (state: string) => void) {
        assert.equal(event, 'change');
        callback = listener;
        return { remove: () => void removes++ };
      },
    },
  };
  const source = appStateSource(native);
  assert.equal(source.current(), 'active');
  native.AppState.currentState = 'inactive';
  assert.equal(source.current(), 'inactive');
  const states: AppStatus[] = [];
  const stop = source.subscribe((state) => states.push(state));
  ['inactive', 'background', 'active', 'unknown', 'extension'].forEach((state) => callback(state));
  assert.deepEqual(states, ['inactive', 'background', 'active', 'active', 'active']);
  stop();
  assert.equal(removes, 1);
  assert.equal(appStateSource(null).current(), 'active');
  appStateSource(null).subscribe(() => assert.fail('inert source'))();
});

test('direction source overrides react, preserve nearest context, and ignore stale/disposed reads', async () => {
  const first = deferred<LayoutDirection>();
  let emit!: (direction: LayoutDirection) => void;
  let removes = 0;
  const root = scope(() =>
    withServiceScope(
      [
        provideService(Direction.SOURCE, () => ({
          current: () => first.promise,
          subscribe(listener) {
            emit = listener;
            return () => void removes++;
          },
        })),
      ],
      () => {
        const outer = useService(Direction);
        const inner = withServiceScope(
          [provideService(Direction, () => ({ current: () => 'rtl', rtl: () => true }))],
          () => useService(Direction),
        );
        assert.equal(outer.rtl(), false);
        assert.equal(inner.rtl(), true);
        return outer;
      },
    ),
  );
  emit('rtl');
  first.resolve('ltr');
  await first.promise;
  assert.equal(root.value.current(), 'rtl');
  assert.equal(root.value.rtl(), true);
  root.dispose();
  emit('ltr');
  assert.equal(root.value.rtl(), true);
  assert.equal(removes, 1);
  assert.equal(directionSource(null).current(), 'ltr');
  assert.equal(directionSource({ I18nManager: { isRTL: true } }).current(), 'rtl');
  directionSource(null).subscribe(() => assert.fail('native direction is fixed'))();
});
