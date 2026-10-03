import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { useService, withServiceScope } from '@solidnative/device/solid';
import { MissingModuleError } from '../src/native.ts';
import { AppInfo } from '../src/solid/app-info.ts';
import { Assets, assets } from '../src/solid/assets.ts';
import { expoFonts, loadFonts } from '../src/solid/fonts.ts';
import { expoSplashScreen, SplashScreen } from '../src/solid/splash-screen.ts';
import { Updates } from '../src/solid/updates.ts';

function withModules<T>(modules: Record<string, unknown>, run: (calls: string[]) => T): T {
  const host = globalThis as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(host, 'require');
  const calls: string[] = [];
  host['require'] = (id: string) => {
    calls.push(id);
    if (Object.hasOwn(modules, id)) return modules[id];
    throw Error(`Missing: ${id}`);
  };
  try {
    return run(calls);
  } finally {
    if (previous) Object.defineProperty(host, 'require', previous);
    else delete host['require'];
  }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('native startup factories stay lazy, map real module entry methods and preserve pre-owner helpers', async () => {
  const maps: Record<string, unknown>[] = [];
  const modules: unknown[] = [];
  const calls: string[] = [];
  let stop!: () => void;
  const result = withModules(
    {
      'expo-application': {
        nativeApplicationVersion: '1',
        nativeBuildVersion: '2',
        applicationId: 'id',
        applicationName: 'name',
      },
      'expo-device': {
        modelName: 'Phone',
        brand: 'Brand',
        osName: 'OS',
        osVersion: '10',
        isDevice: true,
        deviceType: 1,
      },
      'expo-asset': {
        Asset: {
          loadAsync: async (ids: unknown) => {
            modules.push(ids);
            return [{ uri: 'local', width: 1, height: 2 }];
          },
        },
      },
      'expo-font': {
        loadAsync: async (map: Record<string, unknown>) => {
          maps.push(map);
        },
        isLoaded: () => true,
        getLoadedFonts: () => ['Inter'],
      },
      'expo-splash-screen': {
        preventAutoHideAsync: async () => {
          calls.push('hold');
          return true;
        },
        hideAsync: async () => {
          calls.push('hide');
        },
      },
      'expo-updates': {
        isEnabled: true,
        checkForUpdateAsync: async () => ({ isAvailable: true }),
        fetchUpdateAsync: async () => ({ isNew: true }),
        reloadAsync: async () => {
          calls.push('reload');
        },
      },
    },
    (required) => {
      assert.deepEqual(required, []);
      const load = loadFonts({ fonts: [{ family: 'Inter', source: 7, weight: 700 }] });
      const fonts = expoFonts()!;
      assert.equal(fonts.isLoaded('Inter'), true);
      assert.deepEqual(fonts.getLoadedFonts(), ['Inter']);
      return createRoot((dispose) => {
        stop = dispose;
        return withServiceScope([], () => {
          const info = useService(AppInfo);
          const resource = assets(() => [7, 8]);
          const splash = useService(SplashScreen);
          splash.hold();
          return { load, info, resource, splash, updates: useService(Updates) };
        });
      });
    },
  );
  try {
    await result.load;
    await settle();
    assert.deepEqual(maps, [{ Inter: 7, 'Inter-700': 7 }]);
    assert.deepEqual(modules, [[7, 8]]);
    assert.equal(result.info.device.model, 'Phone');
    assert.equal(result.resource.value()?.[0]?.uri, 'local');
    await result.splash.hide();
    assert.equal(await result.updates.check(), true);
    await result.updates.apply();
    assert.deepEqual(calls, ['hold', 'hide', 'reload']);
  } finally {
    stop();
  }
});

test('absent optional startup modules are neutral in Node and diagnosed on a supported native platform', async () => {
  await withModules({}, async () => {
    assert.equal(expoFonts(), null);
    assert.equal(expoSplashScreen(), null);
    await loadFonts({ fonts: [{ family: 'fallback', source: 1 }] });
  });
  withModules({ 'react-native': { Platform: { OS: 'ios' } } }, () => {
    assert.throws(
      () => expoFonts(),
      (error) => error instanceof MissingModuleError && error.module === 'expo-font',
    );
    assert.throws(
      () => expoSplashScreen(),
      (error) => error instanceof MissingModuleError && error.module === 'expo-splash-screen',
    );
  });
  createRoot((dispose) => {
    try {
      withModules({}, () =>
        withServiceScope([], () => {
          assert.equal(useService(AppInfo).version, null);
          assert.equal(useService(Updates).enabled, false);
          assert.ok(useService(Assets));
        }),
      );
    } finally {
      dispose();
    }
  });
});
