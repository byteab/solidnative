/** @jsxImportSource @solid-native/platform/solid */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSignal } from 'solid-js';
import { createNativeRoot } from '@solid-native/platform/solid';
import { provideService, withServiceScope } from '@solid-native/device/solid';
import type { NativeRef } from '@solid-native/components/solid';
import { createFakeFabric } from '../../platform/solid-tests/fake-fabric.ts';
import { Camera, type CameraRef } from '../src/solid/camera.ts';
import { MapView, registerExpoMap, type MapViewRef } from '../src/solid/map-view.ts';
import { DomComponent } from '../src/solid/dom-component.ts';
import { registerExpoViews } from '../src/views.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { resolve, reject, promise };
}

test('Camera JSX forwards props/events and commands only attached native tags; cleanup settles pending replies', async () => {
  registerExpoViews('expo-camera');
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 1151 });
  const [facing, setFacing] = createSignal<'front' | 'back'>('back');
  let ref!: CameraRef;
  let early!: Promise<unknown>;
  const calls: unknown[] = [];
  const events: unknown[] = [];
  const photo = deferred<{ width: number; height: number; uri: string; format: 'jpg' }>();
  root.render(() =>
    withServiceScope(
      [
        provideService(Camera.SOURCE, () => ({
          takePicture(options) {
            calls.push([this.nativeTag, options]);
            return photo.promise;
          },
        })),
      ],
      () => (
        <Camera
          facing={facing()}
          zoom={0.4}
          ref={(value) => {
            ref = value;
            early = value.takePicture();
          }}
          onCameraReady={(event) => events.push(event.nativeEvent)}
        />
      ),
    ),
  );
  assert.equal(await early, null);
  const camera = fabric.roots.get(1151)![0]!;
  assert.equal(camera.props['facing'], 'back');
  assert.equal(camera.props['zoom'], 0.4);
  fabric.emit(camera, 'topCameraReady', { ready: true });
  assert.deepEqual(events, [{ ready: true }]);
  setFacing('front');
  root.flush();
  assert.equal(fabric.roots.get(1151)![0]!.props['facing'], 'front');
  const pending = ref.takePicture({ quality: 0.9, base64: true });
  assert.deepEqual(calls, [[camera.tag, { quality: 0.9, base64: true }]]);
  root.dispose();
  assert.equal(await pending, null);
  photo.reject(Error('late native error'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(await ref.takePicture(), null);
});

test('Map JSX converts shapes, forwards events, and drains commands in request order after ready', async () => {
  registerExpoMap('ios');
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 1153 });
  let ref!: MapViewRef;
  const calls: unknown[] = [];
  const events: unknown[] = [];
  root.render(() =>
    withServiceScope(
      [
        provideService(MapView.SOURCE, () => ({
          async setCameraPosition(position) {
            calls.push(['move', this.nativeTag, position]);
          },
          async selectMarker(id, options) {
            calls.push(['select', this.nativeTag, id, options]);
          },
        })),
      ],
      () => (
        <MapView
          ref={(value) => {
            ref = value;
          }}
          markers={[{ id: 'a', coordinates: { latitude: 1, longitude: 2 } }]}
          polylines={[{ coordinates: [], color: 'red' }]}
          polygons={[{ coordinates: [], color: 'blue', lineColor: 'white' }]}
          circles={[{ center: {}, radius: 3, color: 'green' }]}
          onMarkerClick={(event) => events.push(event.nativeEvent)}
        />
      ),
    ),
  );
  const map = fabric.roots.get(1153)![0]!;
  assert.match(map.viewName, /ExpoAppleMaps/);
  assert.deepEqual(map.props['polylines'], [{ coordinates: [], color: 'red' }]);
  assert.deepEqual(map.props['polygons'], [{ coordinates: [], color: 'blue', lineColor: 'white' }]);
  assert.equal(ref.ready(), false);
  const a = ref.setCameraPosition({ zoom: 8, duration: 300 }),
    b = ref.selectMarker('a', { zoom: 9, moveCamera: false });
  assert.deepEqual(calls, []);
  fabric.emit(map, 'topCameraMove', { coordinates: {}, zoom: 1 });
  assert.equal(ref.ready(), true);
  assert.deepEqual(await Promise.all([a, b]), [true, true]);
  assert.deepEqual(calls, [
    ['move', map.tag, { zoom: 8, duration: 300 }],
    ['select', map.tag, 'a', { zoom: 9, moveCamera: false }],
  ]);
  fabric.emit(map, 'topMarkerClick', { id: 'a' });
  assert.deepEqual(events, [{ id: 'a' }]);
  root.dispose();
  assert.equal(await ref.selectMarker('a'), false);
});

test('Map holds are canceled when covered; camera/map stale failures stay suppressed after return', async () => {
  registerExpoMap('android');
  registerExpoViews('expo-camera');
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 1155 });
  const [front, setFront] = createSignal(true);
  const moved = deferred<void>(),
    photo = deferred<never>();
  let map!: MapViewRef;
  let camera!: CameraRef;
  let moves = 0;
  root.render(() =>
    withServiceScope(
      [
        provideService(MapView.SOURCE, () => ({
          setCameraPosition: () => {
            moves++;
            return moved.promise;
          },
          selectMarker: async () => {},
        })),
        provideService(Camera.SOURCE, () => ({ takePicture: () => photo.promise })),
      ],
      () => [
        <MapView
          foreground={front}
          ref={(value) => {
            map = value;
          }}
        />,
        <Camera
          foreground={front}
          ref={(value) => {
            camera = value;
          }}
        />,
      ],
    ),
  );
  const held = map.setCameraPosition({ zoom: 4 });
  setFront(false);
  assert.equal(await held, false);
  setFront(true);
  fabric.emit(fabric.roots.get(1155)![0]!, 'topCameraMove', { coordinates: {}, zoom: 1 });
  const pending = map.setCameraPosition({ zoom: 8 }),
    shooting = camera.takePicture();
  setFront(false);
  setFront(true);
  moved.reject(Error('old move'));
  photo.reject(Error('old picture'));
  assert.deepEqual(await Promise.all([pending, shooting]), [false, null]);
  assert.equal(moves, 1);
  root.dispose();
});

test('DOM JSX retains JSON bridge, reactive inputs, native ref and declared output/error contracts', () => {
  const fabric = createFakeFabric();
  const reported: unknown[] = [];
  const root = createNativeRoot({
    fabric,
    rootTag: 1157,
    engineOptions: { onError: (error) => reported.push(error) },
  });
  let ref!: NativeRef;
  const scripts: unknown[] = [];
  const outputs: unknown[] = [];
  const errors: Error[] = [];
  const [inputs, setInputs] = createSignal({ text: 'first' });
  root.render(() =>
    withServiceScope(
      [
        provideService(DomComponent.SOURCE, () => ({
          baseUrl: 'file://pages',
          functions: {
            async injectJavaScript(script) {
              scripts.push([this.nativeTag, script]);
            },
          },
        })),
      ],
      () => (
        <DomComponent
          src={{ domComponent: 'note?hash=1' }}
          inputs={inputs()}
          outputs={{ saved: (value) => outputs.push(value) }}
          ref={(value) => {
            ref = value;
          }}
          onError={(error) => errors.push(error)}
          webviewDebuggingEnabled={false}
        />
      ),
    ),
  );
  const node = fabric.roots.get(1157)![0]!;
  assert.equal(ref.isAttached(), true);
  assert.deepEqual(node.props['source'], { uri: 'file://pages/note?hash=1' });
  assert.equal(node.props['injectedJavaScriptObject'], '{"inputs":{"text":"first"}}');
  assert.equal(node.props['webviewDebuggingEnabled'], false);
  const send = (message: unknown) =>
    fabric.emit(node, 'topMessage', { data: JSON.stringify(message) });
  send({ type: 'ready', outputs: ['other'] });
  assert.match(String(reported[0]), /note has no output 'saved'/);
  send({ type: 'ready', outputs: ['saved'] });
  assert.equal(scripts.length, 1);
  setInputs({ text: 'second' });
  root.flush();
  assert.equal(scripts.length, 2);
  assert.match(String(scripts[1]), /window\.__solidNative.*second/);
  send({ type: 'output', name: 'saved', value: { ok: true } });
  send({ type: 'error', message: 'page failed' });
  assert.deepEqual(outputs, [{ ok: true }]);
  assert.match(errors[0]!.message, /note: page failed/);
  root.dispose();
  assert.equal(ref.isAttached(), false);
});
