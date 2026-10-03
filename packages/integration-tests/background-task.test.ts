/**
 * `BackgroundTask`, over a fake of `expo-background-task` that records every call.
 *
 * The task itself is defined with `expo-task-manager` at the top level of `main.ts`, outside
 * any component; the service is what registers it, unregisters it, and says whether the platform will
 * run it at all.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  BackgroundTask,
  BackgroundTaskResult,
  BackgroundTaskStatus,
  type NativeBackgroundTask,
} from '@solid-native/expo/background-task';
import { disposeServices, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

function platform(status: BackgroundTaskStatus = BackgroundTaskStatus.Available) {
  const calls: unknown[][] = [];
  const record =
    <T>(name: string, answer?: T) =>
    async (...args: unknown[]) => (calls.push([name, ...args]), answer);
  const native = {
    getStatusAsync: record('getStatusAsync', status),
    registerTaskAsync: record('registerTaskAsync'),
    unregisterTaskAsync: record('unregisterTaskAsync'),
    triggerTaskWorkerForTestingAsync: record('triggerTaskWorkerForTestingAsync', true),
  } as unknown as NativeBackgroundTask;
  return Object.assign(native, { calls });
}

const serviceOn = (native: NativeBackgroundTask | null) => serviceWith(BackgroundTask, native);

describe('background task', () => {
  it('reaches every function of the module under its own name, with its arguments', async () => {
    const native = platform();
    const tasks = serviceOn(native);
    assert.equal(await tasks.status(), BackgroundTaskStatus.Available);
    await tasks.register('sync', { minimumInterval: 30 });
    await tasks.unregister('sync');
    assert.equal(await tasks.triggerForTesting(), true);
    assert.deepEqual(native.calls, [
      ['getStatusAsync'],
      ['registerTaskAsync', 'sync', { minimumInterval: 30 }],
      ['unregisterTaskAsync', 'sync'],
      ['triggerTaskWorkerForTestingAsync'],
    ]);
  });

  it('reports a platform that will not run background work', async () => {
    const tasks = serviceOn(platform(BackgroundTaskStatus.Restricted));
    assert.equal(await tasks.status(), BackgroundTaskStatus.Restricted);
  });

  it('is inert rather than broken with no module installed', async () => {
    const tasks = serviceOn(null);
    assert.equal(await tasks.status(), BackgroundTaskStatus.Restricted);
    await tasks.register('sync');
    await tasks.unregister('sync');
    assert.equal(await tasks.triggerForTesting(), false);
  });
});

describe('statuses and results', () => {
  it('are the module s own enums, so a task can answer without loading the module', () => {
    // The enums live in a file Node cannot load, so their compiled lines are read as text.
    const require = createRequire(import.meta.url);
    const types = readFileSync(
      require.resolve('expo-background-task/build/BackgroundTask.types.js'),
      'utf8',
    );
    const read = (name: string) =>
      Object.fromEntries(
        [...types.matchAll(new RegExp(`${name}\\["(\\w+)"\\] = (\\d+)`, 'g'))].map(
          ([, key, value]) => [key, Number(value)],
        ),
      );
    assert.ok(Object.keys(read('BackgroundTaskStatus')).length > 0, 'found the enum');
    assert.deepEqual({ ...BackgroundTaskStatus }, read('BackgroundTaskStatus'));
    assert.deepEqual({ ...BackgroundTaskResult }, read('BackgroundTaskResult'));
  });
});
