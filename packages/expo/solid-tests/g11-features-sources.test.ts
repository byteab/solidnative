import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot } from 'solid-js';
import { useService, withServiceScope } from '@solid-native/device/solid';
import { MissingModuleError } from '../src/native.ts';
import { Camera } from '../src/solid/camera.ts';
import { MapView } from '../src/solid/map-view.ts';
import { DomComponent } from '../src/solid/dom-component.ts';
import { Database, database } from '../src/solid/database.ts';
import { LanguageModel } from '../src/solid/language-model.ts';
import { videoPlayer, audioPlayer } from '../src/solid/player.ts';
function withModules<T>(modules: Record<string, unknown>, run: (calls: string[]) => T): T {
  const host = globalThis as Record<string, unknown>;
  const prior = Object.getOwnPropertyDescriptor(host, 'require');
  const calls: string[] = [];
  host['require'] = (name: string) => {
    calls.push(name);
    if (Object.hasOwn(modules, name)) return modules[name];
    throw Error(`Missing: ${name}`);
  };
  try {
    return run(calls);
  } finally {
    if (prior) Object.defineProperty(host, 'require', prior);
    else delete host['require'];
  }
}

test('view factories resolve default Expo native view prototypes lazily and preserve DOM page resolution', () => {
  const camera = { takePicture: async () => ({ uri: 'x' }) },
    map = { setCameraPosition: async () => {} },
    dom = { injectJavaScript: async () => {} };
  const looked: string[] = [];
  withModules(
    {
      'expo-modules-core': {
        requireOptionalNativeModule: (name: string) => {
          looked.push(name);
          const functions = (
            { ExpoCamera: camera, ExpoGoogleMaps: map, ExpoDomWebViewModule: dom } as Record<
              string,
              unknown
            >
          )[name];
          return functions ? { ViewPrototypes: { [name]: functions } } : null;
        },
      },
      'expo/src/dom/base': { getBaseURL: () => 'file://www.bundle' },
    },
    (calls) => {
      assert.deepEqual(calls, []);
      assert.equal(Camera.SOURCE.create(), camera);
      assert.equal(MapView.SOURCE.create(), map);
      assert.deepEqual(DomComponent.SOURCE.create(), {
        baseUrl: 'file://www.bundle',
        functions: dom,
      });
      assert.deepEqual(looked, [
        'ExpoCamera',
        'ExpoAppleMaps',
        'ExpoGoogleMaps',
        'ExpoDomWebViewModule',
      ]);
    },
  );
});

test('database/player native factories map installed constructors lazily without replacing returned handles', async () => {
  const opened: string[] = [];
  const playerCalls: unknown[] = [];
  const native = {
    execAsync: async () => {},
    closeAsync: async () => {},
    getFirstAsync: async () => null,
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  };
  const player = { addListener: () => ({ remove: () => {} }), release: () => {} };
  let stop!: () => void;
  const result = withModules(
    {
      'expo-sqlite': {
        openDatabaseAsync: async (name: string) => {
          opened.push(name);
          return native;
        },
      },
      'expo-video': {
        createVideoPlayer: (source: unknown) => {
          playerCalls.push(source);
          return player;
        },
      },
      'expo-audio': {
        createAudioPlayer: (source: unknown, options: unknown) => {
          playerCalls.push([source, options]);
          return player;
        },
      },
    },
    (calls) => {
      const source = Database.SOURCE.create();
      assert.deepEqual(calls, []);
      const first = source.open('first');
      const value = createRoot((dispose) => {
        stop = dispose;
        return withServiceScope([], () => {
          const db = database('second');
          assert.deepEqual(opened, ['first']);
          return {
            db,
            ready: db.ready(),
            video: videoPlayer('video'),
            audio: audioPlayer('audio', { timeUpdate: 2 }),
          };
        });
      });
      return { first, ...value };
    },
  );
  try {
    assert.equal(await result.first, native);
    assert.equal(await result.ready, native);
    assert.deepEqual(opened, ['first', 'second']);
    assert.equal(result.video.native, player);
    assert.equal(result.audio.native, player);
    assert.deepEqual(playerCalls, ['video', ['audio', { updateInterval: 2000 }]]);
    await result.db.close();
  } finally {
    stop();
  }
});

test('language model native factory maps availability/download/session/token cleanup and options', async () => {
  const configs: unknown[] = [];
  const calls: string[] = [];
  const subscriptions: Record<string, (value: never) => void> = {};
  let stop!: () => void;
  let model!: LanguageModel;
  withModules(
    {
      'expo-local-llm': {
        ExpoLocalLlmModule: {
          getAvailability: () => 'available',
          addListener: (name: string, callback: (value: never) => void) => {
            subscriptions[name] = callback;
            return { remove: () => calls.push(`remove:${name}`) };
          },
          downloadModel: async () => {
            calls.push('download');
          },
        },
        createLLMSession: (config: unknown) => {
          configs.push(config);
          return {
            respond: async () => 'plain',
            addListener: (_name: string, callback: (value: { accumulated: string }) => void) => {
              callback({ accumulated: 'part' });
              return { remove: () => calls.push('remove:token') };
            },
            streamResponse: async () => 'whole',
            cancelStream: async () => {
              calls.push('cancel');
            },
            release: () => calls.push('release'),
          };
        },
      },
    },
    () =>
      createRoot((dispose) => {
        stop = dispose;
        withServiceScope([], () => {
          model = useService(LanguageModel);
        });
      }),
  );
  try {
    assert.equal(model.available(), true);
    await model.download();
    assert.equal(await model.generate('x', { instructions: 'short', temperature: 0.1 }), 'plain');
    const stream = model.stream('x');
    assert.equal(stream.text(), 'part');
    assert.equal(await stream.result, 'whole');
    assert.deepEqual(configs, [{ instructions: 'short', options: { temperature: 0.1 } }, {}]);
    assert.deepEqual(calls, ['download', 'release', 'remove:token', 'release']);
    subscriptions['downloadProgress']!({ progress: 0.5 } as never);
    assert.equal(model.downloadProgress(), 0.5);
  } finally {
    stop();
  }
  assert.deepEqual(calls.slice(-2), ['remove:availabilityChange', 'remove:downloadProgress']);
});

test('missing feature factories are neutral in Node and diagnose supported platform modules', async () => {
  withModules({}, () => {
    assert.equal(Camera.SOURCE.create(), null);
    assert.equal(MapView.SOURCE.create(), null);
    assert.deepEqual(DomComponent.SOURCE.create(), { baseUrl: null, functions: null });
    assert.equal(videoPlayer.SOURCE.create(), null);
    assert.equal(audioPlayer.SOURCE.create(), null);
  });
  await withModules({}, () =>
    assert.rejects(Database.SOURCE.create().open('missing'), /not installed/),
  );
  withModules({ 'react-native': { Platform: { OS: 'ios' } } }, () => {
    for (const token of [Camera.SOURCE, MapView.SOURCE, videoPlayer.SOURCE, audioPlayer.SOURCE])
      assert.throws(() => token.create(), MissingModuleError);
  });
});
