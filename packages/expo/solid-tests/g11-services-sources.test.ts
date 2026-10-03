import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { useService, withServiceScope, type ServiceToken } from '@solidnative/device/solid';
import { MissingModuleError } from '../src/native.ts';

const entries = [
  ['background-task', 'BackgroundTask', 'expo-background-task'],
  ['biometrics', 'Biometrics', 'expo-local-authentication'],
  ['document-picker', 'DocumentPicker', 'expo-document-picker'],
  ['image-editor', 'ImageEditor', 'expo-image-manipulator'],
  ['image-picker', 'ImagePicker', 'expo-image-picker'],
  ['location', 'Location', 'expo-location'],
  ['media-library', 'MediaLibrary', 'expo-media-library'],
  ['notifications', 'Notifications', 'expo-notifications'],
  ['screen-capture', 'ScreenCapture', 'expo-screen-capture'],
  ['store-review', 'StoreReview', 'expo-store-review'],
  ['tracking', 'Tracking', 'expo-tracking-transparency'],
] as const;

test('all eleven isolated entries load no optional modules and resolve only their own source lazily per scope', async () => {
  const host = globalThis as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(host, 'require');
  const calls: string[] = [];
  const sub = () => ({ remove() {} });
  const native = {
    addScreenshotListener: sub,
    addNotificationReceivedListener: sub,
    addNotificationResponseReceivedListener: sub,
    addNotificationsDroppedListener: sub,
    addPushTokenListener: sub,
    getLastNotificationResponseAsync: async () => null,
  };
  host['require'] = (id: string) => {
    calls.push(id);
    return native;
  };
  try {
    for (const [path, exported, module] of entries) {
      const before = calls.length;
      const entry = (await import(`../src/solid/${path}.ts`)) as Record<
        string,
        ServiceToken<unknown>
      >;
      assert.equal(calls.length, before, `${path} eagerly required native code`);
      let firstValue: unknown;
      createRoot((dispose) => {
        try {
          withServiceScope([], () => {
            const first = useService(entry[exported]!);
            firstValue = first;
            assert.equal(useService(entry[exported]!), first);
            assert.deepEqual(calls.slice(before), [module]);
            withServiceScope([], () => {
              assert.equal(useService(entry[exported]!), first);
            });
            assert.deepEqual(calls.slice(before), [module]);
          });
        } finally {
          dispose();
        }
      });
      createRoot((dispose) => {
        try {
          withServiceScope([], () => assert.notEqual(useService(entry[exported]!), firstValue));
        } finally {
          dispose();
        }
      });
      assert.deepEqual(calls.slice(before), [module, module]);
    }
  } finally {
    if (previous) Object.defineProperty(host, 'require', previous);
    else delete host['require'];
  }
});

test('missing module diagnostics remain native-specific across all eleven lazy service sources', async () => {
  const host = globalThis as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(host, 'require');
  host['require'] = (id: string) => {
    if (id === 'react-native') return { Platform: { OS: 'ios' } };
    throw Error(`absent: ${id}`);
  };
  try {
    for (const [path, exported, module] of entries) {
      const entry = (await import(`../src/solid/${path}.ts`)) as Record<
        string,
        ServiceToken<unknown>
      >;
      createRoot((dispose) => {
        try {
          withServiceScope([], () =>
            assert.throws(
              () => useService(entry[exported]!),
              (error) => error instanceof MissingModuleError && error.module === module,
            ),
          );
        } finally {
          dispose();
        }
      });
    }
  } finally {
    if (previous) Object.defineProperty(host, 'require', previous);
    else delete host['require'];
  }
});
