/** @jsxImportSource @solid-native/platform/solid */
import { createRenderEffect, createSignal, onCleanup } from 'solid-js';
import { Pressable, Text, View } from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { MapView, type MapMarker, type MapViewRef } from '@solid-native/expo/solid/map-view';
import { NativeHeader } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';

const KINGS_CROSS = { latitude: 51.5308, longitude: -0.1238 };
const stations: readonly MapMarker[] = [
  { id: 'kings-cross', title: "King's Cross", coordinates: KINGS_CROSS },
  { id: 'paddington', title: 'Paddington', coordinates: { latitude: 51.5154, longitude: -0.1755 } },
];
const camera = { coordinates: { latitude: 51.523, longitude: -0.15 }, zoom: 12 };

export function MapsPage() {
  const front = useService(SCREEN_IN_FRONT);
  const [tapped, setTapped] = createSignal('Tap a marker');
  const [moved, setMoved] = createSignal('');
  let view: MapViewRef | undefined;
  let active = true,
    revision = 0;
  createRenderEffect(() => {
    if (!front()) revision++;
  });
  onCleanup(() => {
    active = false;
    revision++;
  });
  const current = (token: number) => active && front() && token === revision;
  const zoom = async () => {
    if (!active || !front()) return;
    const token = ++revision;
    try {
      const reached = await view?.setCameraPosition({ coordinates: KINGS_CROSS, zoom: 16 });
      if (current(token)) setMoved(reached ? 'Camera moved' : 'No map to move');
    } catch (error) {
      if (current(token)) setMoved(`Could not move camera: ${String(error)}`);
    }
  };
  return (
    <>
      <NativeHeader title="Maps" />
      <View class="screen">
        <MapView
          style={{ height: 420 }}
          ref={(ref) => {
            view = ref;
          }}
          foreground={front}
          markers={stations}
          cameraPosition={camera}
          onMarkerClick={(event) => setTapped(`Marker: ${event.nativeEvent.id}`)}
          onMapClick={(event) =>
            setTapped(`Map at ${event.nativeEvent.coordinates.latitude?.toFixed(4)}`)
          }
        />
        <View style={page.content}>
          <Text class="body">{tapped()}</Text>
          <Pressable
            class="button"
            onPress={() => {
              void zoom();
            }}
          >
            <Text class="button-label">Zoom to King's Cross</Text>
          </Pressable>
          <Text class="hint">{moved()}</Text>
        </View>
      </View>
    </>
  );
}
