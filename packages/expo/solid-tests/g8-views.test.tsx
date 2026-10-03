/** @jsxImportSource @solid-native/platform/solid */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSignal } from 'solid-js';
import { createNativeRoot } from '@solid-native/platform/solid';
import {
  ExpoImage,
  ExpoSymbol,
  ExpoGlass,
  ExpoGlassContainer,
  ExpoVideo,
  SegmentedControl,
  liquidGlassAvailable,
} from '@solid-native/expo/solid';
import type { NativeRef } from '@solid-native/components/solid';
import { createFakeFabric } from '../../platform/solid-tests/fake-fabric.ts';

test('compiled direct Expo views preserve native props, reactive updates and events', () => {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 401 });
  const [size, setSize] = createSignal(24);
  const [name, setName] = createSignal('heart.fill');
  const [index, setIndex] = createSignal(0);
  const [color, setColor] = createSignal<string | undefined>('red');
  const [handler, setHandler] = createSignal(true);
  const events: unknown[] = [];
  let ref!: NativeRef;
  root.render(() => (
    <ExpoGlassContainer spacing={8}>
      <ExpoGlass isInteractive colorScheme="dark">
        <ExpoSymbol
          name={name()}
          size={size()}
          colors={color()}
          animationSpec={{ effect: { type: 'bounce' } }}
        />
        <ExpoImage
          source={{ uri: 'image.png' }}
          placeholder={[{ uri: 'blur.png' }]}
          ref={(value) => {
            ref = value;
          }}
          onLoad={handler() ? (event) => events.push(event.nativeEvent) : undefined}
        />
        <SegmentedControl
          values={['one', 'two']}
          selectedIndex={index()}
          onChange={(event) => setIndex(event.nativeEvent.selectedSegmentIndex)}
        />
      </ExpoGlass>
    </ExpoGlassContainer>
  ));
  const outer = fabric.roots.get(401)![0]!;
  const glass = outer.children[0]!;
  const [symbol, image, segmented] = glass.children;
  assert.match(outer.viewName, /GlassContainer/);
  assert.equal(outer.props['spacing'], 8);
  assert.match(glass.viewName, /GlassView/);
  assert.equal(glass.props['isInteractive'], true);
  assert.match(symbol!.viewName, /SymbolModule/);
  assert.equal(symbol!.props['type'], 'monochrome');
  assert.deepEqual(symbol!.props['colors'], ['red']);
  assert.equal(symbol!.props['animated'], true);
  assert.equal(
    (symbol!.props['style'] as Record<string, unknown>)?.['width'] ?? symbol!.props['width'],
    24,
  );
  assert.match(image!.viewName, /ExpoImage/);
  assert.deepEqual(image!.props['source'], [{ uri: 'image.png' }]);
  assert.equal(ref.isAttached(), true);
  fabric.emit(image!, 'topLoad', { loaded: true });
  assert.deepEqual(events, [{ loaded: true }]);
  fabric.emit(segmented!, 'topChange', { selectedSegmentIndex: 1, value: 'two' });
  root.flush();
  assert.equal(index(), 1);
  setSize(32);
  setName('star.fill');
  setColor(undefined);
  setHandler(false);
  root.flush();
  const updated = fabric.roots.get(401)![0]!.children[0]!.children;
  assert.equal(updated[0]!.tag, symbol!.tag);
  assert.equal(updated[0]!.props['name'], 'star.fill');
  assert.equal(updated[0]!.props['colors'], null);
  assert.equal(updated[2]!.props['selectedIndex'], 1);
  fabric.emit(updated[1]!, 'topLoad', { loaded: false });
  assert.equal(events.length, 1);
  root.dispose();
  assert.equal(ref.isAttached(), false);
  assert.deepEqual(fabric.roots.get(401), []);
});
test('Liquid Glass availability queries only native installed capability', () => {
  const host = globalThis as { expo?: { modules?: Record<string, unknown> } };
  const original = host.expo;
  try {
    delete host.expo;
    assert.equal(liquidGlassAvailable(), false);
    host.expo = { modules: { ExpoGlassEffect: { isLiquidGlassAvailable: true } } };
    assert.equal(liquidGlassAvailable(), true);
  } finally {
    if (original === undefined) delete host.expo;
    else host.expo = original;
  }
});

test('the typed video view commits VideoView with the player as its shared-object id', () => {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 402 });
  const [player, setPlayer] = createSignal<{ __expo_shared_object_id__: number } | number>({
    __expo_shared_object_id__: 7,
  });
  const events: unknown[] = [];
  root.render(() => (
    <ExpoVideo
      player={player()}
      nativeControls
      contentFit="cover"
      fullscreenOptions={{ enable: false }}
      onFirstFrameRender={(event) => events.push(event.nativeEvent)}
    />
  ));
  const video = fabric.roots.get(402)![0]!;
  assert.match(video.viewName, /ExpoVideo.*VideoView/);
  assert.equal(video.props['player'], 7);
  assert.equal(video.props['nativeControls'], true);
  assert.equal(video.props['contentFit'], 'cover');
  assert.deepEqual(video.props['fullscreenOptions'], { enable: false });
  fabric.emit(video, 'topFirstFrameRender', {});
  assert.deepEqual(events, [{}]);
  setPlayer(9);
  root.flush();
  assert.equal(fabric.roots.get(402)![0]!.props['player'], 9);
  root.dispose();
});
