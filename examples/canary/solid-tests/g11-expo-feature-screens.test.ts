import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provideService } from '@solid-native/device/solid';
import { MapView, registerExpoMap } from '@solid-native/expo/solid/map-view';
import { LanguageModel } from '@solid-native/expo/solid/language-model';
import { MapsPage } from '../src/app/expo/maps.solid.tsx';
import { LanguageModelPage } from '../src/app/expo/language-model.solid.tsx';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} map preserves stations, waits for native readiness and rejects covered answers`, async (t) => {
    registerExpoMap(platform);
    let pending = deferred<void>();
    const calls: { tag: number; position: unknown }[] = [];
    const fixture = consumerFixture(
      () => [
        { path: 'maps', component: MapsPage },
        { path: 'cover', component: () => null },
      ],
      [
        provideService(MapView.SOURCE, () => ({
          setCameraPosition(position) {
            calls.push({ tag: this.nativeTag, position });
            return pending.promise;
          },
          selectMarker: async () => {},
        })),
      ],
    );
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/maps');
    h.finish();
    const map = () => h.nodes().find((node) => node.instanceHandle.name === 'expo-map')!;
    assert.ok(map());
    assert.equal(map().props['height'], 420);
    assert.equal((map().props['markers'] as unknown[]).length, 2);
    h.press("Zoom to King's Cross");
    assert.equal(calls.length, 0);
    h.fabric.emit(map(), 'topCameraMove', {
      coordinates: { latitude: 51.523, longitude: -0.15 },
      zoom: 12,
    });
    await settle();
    h.clock.flushMicrotasks();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.tag, map().tag);
    assert.deepEqual(calls[0]!.position, {
      coordinates: { latitude: 51.5308, longitude: -0.1238 },
      zoom: 16,
    });
    pending.resolve();
    await h.waitFor(() => h.renderedText().includes('Camera moved'));
    h.fabric.emit(map(), 'topMarkerClick', { id: 'paddington' });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Marker: paddington/);
    h.fabric.emit(map(), 'topMapClick', { coordinates: { latitude: 51.51234, longitude: -0.1 } });
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Map at 51\.5123/);
    // Cover the screen while another command is in flight. Its error must not reach the restored screen.
    pending = deferred<void>();
    h.press("Zoom to King's Cross");
    await settle();
    await nav.push('/cover');
    h.finish();
    pending.resolve();
    await settle();
    await nav.back();
    h.finish();
    assert.doesNotMatch(h.renderedText(), /No map to move|Could not move camera/);
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} on-device AI streams inputs and cancels superseded, covered and disposed work`, async (t) => {
    const streams: {
      text: (value: string) => void;
      result: ReturnType<typeof deferred<string>>;
      cancelled: number;
      released: number;
      prompt: string;
    }[] = [];
    let availability = 'available',
      removed = 0;
    const fixture = consumerFixture(
      () => [
        { path: 'language-model', component: LanguageModelPage },
        { path: 'cover', component: () => null },
      ],
      [
        provideService(LanguageModel.SOURCE, () => ({
          availability: () => availability,
          onAvailabilityChange: () => ({
            remove: () => {
              removed++;
            },
          }),
          onDownloadProgress: () => ({
            remove: () => {
              removed++;
            },
          }),
          download: async () => {},
          session(config) {
            assert.equal(config.instructions, 'Answer briefly, in British English.');
            const record = {
              text: (_value: string) => {},
              result: deferred<string>(),
              cancelled: 0,
              released: 0,
              prompt: '',
            };
            streams.push(record);
            return {
              respond: async () => '',
              stream: (prompt, text) => {
                record.prompt = prompt;
                record.text = text;
                return record.result.promise;
              },
              cancel: async () => {
                record.cancelled++;
              },
              release: () => {
                record.released++;
              },
            };
          },
        })),
      ],
    );
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    t.after(() => h.root.dispose());
    await nav.reset('/language-model');
    h.finish();
    h.input('On-device AI prompt', 'Write about Muscat.');
    h.press('Ask');
    assert.equal(streams[0]!.prompt, 'Write about Muscat.');
    streams[0]!.text('White houses');
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /White houses/);
    h.press('Ask');
    assert.equal(streams[0]!.cancelled, 1);
    streams[0]!.text('stale first answer');
    streams[0]!.result.resolve('stale final answer');
    streams[1]!.text('By the sea');
    await settle();
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /By the sea/);
    assert.doesNotMatch(h.renderedText(), /stale/);
    await nav.push('/cover');
    h.finish();
    assert.equal(streams[1]!.cancelled, 1);
    streams[1]!.text('stale covered answer');
    streams[1]!.result.resolve('stale covered final');
    await settle();
    await nav.back();
    h.finish();
    assert.doesNotMatch(h.renderedText(), /stale/);
    availability = 'notEnabled';
    h.press('Ask');
    h.clock.flushMicrotasks();
    assert.match(h.renderedText(), /Apple Intelligence is switched off/);
    assert.match(h.renderedText(), /unavailable/);
    availability = 'available';
    h.press('Check again');
    h.press('Ask');
    const last = streams.at(-1)!;
    h.root.dispose();
    assert.equal(last.cancelled, 1);
    last.result.resolve('disposed');
    await settle();
    assert.equal(removed, 2);
    assert.ok(streams.every((record) => record.released === 1));
    assert.deepEqual(fixture.errors, []);
  });
}
