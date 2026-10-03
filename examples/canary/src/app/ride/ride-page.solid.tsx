/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal, onCleanup } from 'solid-js';
import { Pressable, Text, View } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { Show, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader, useNavigation } from '@solid-native/router/solid';
import { MapView, type MapMarker, type MapPolyline } from '@solid-native/expo/solid/map-view';
import { PICKUP, Trip, drivers, formatFare, fare } from './ride-model.solid.ts';
import sheet from './ride-page.native.css';

export function RidePage() {
  const trip = useService(Trip),
    nav = useNavigation();
  const camera = { coordinates: PICKUP, zoom: 13 },
    ui = { compassEnabled: false, myLocationButtonEnabled: false };
  const [tick, setTick] = createSignal(0);
  const markers = createMemo<MapMarker[]>(() => {
    const destination = trip.destination();
    return [
      { id: 'pickup', title: 'Pickup', coordinates: PICKUP, tintColor: '#16a34a' },
      ...drivers(tick()).map((driver) => ({
        id: driver.id,
        title: driver.name,
        coordinates: driver.coordinates,
        systemImage: 'car.fill',
      })),
      ...(destination
        ? [{ id: 'destination', title: destination.name, coordinates: destination.coordinates }]
        : []),
    ];
  });
  const route = createMemo<MapPolyline[]>(() => {
    const destination = trip.destination();
    return destination
      ? [
          {
            id: 'route',
            coordinates: [PICKUP, destination.coordinates],
            color: '#2563eb',
            width: 5,
          },
        ]
      : [];
  });
  const summary = createMemo(() => {
    const option = trip.option(),
      price = formatFare(fare(option, trip.km()));
    switch (trip.stage()) {
      case 'finding':
        return `Finding a ${option.name} driver`;
      case 'arriving':
        return `${trip.driver()?.name} is ${option.eta} min away, ${price}`;
      default:
        return `${option.name}, ${price}`;
    }
  });
  // The partially undimmed map remains live underneath its destination sheet.
  let active = true;
  const timer = setInterval(() => {
    if (active) setTick((tick) => tick + 1);
  }, 1000);
  onCleanup(() => {
    active = false;
    clearInterval(timer);
    trip.cancel();
  });
  const openSheet = () => {
    void nav.present('/ride/where', {
      as: 'formSheet',
      presentation: {
        sheetAllowedDetents: [0.35, 0.6, 1],
        sheetLargestUndimmedDetent: 0,
        sheetGrabberVisible: true,
      },
    });
  };
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title="Ride"></NativeHeader>
      <View class="ride">
        <MapView
          class="map"
          markers={markers()}
          polylines={route()}
          cameraPosition={camera}
          uiSettings={ui}
        ></MapView>
        <Show
          when={trip.stage() === 'idle'}
          fallback={
            <>
              <Show when={trip.destination()}>
                {(destination) => (
                  <>
                    <View accessibilityRole="summary" class="banner">
                      <Text class="banner-title">{destination().name}</Text>
                      <Text class="banner-hint">{summary()}</Text>
                    </View>
                  </>
                )}
              </Show>
            </>
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Where to?"
            class="where"
            onPress={() => {
              openSheet();
            }}
          >
            <View class="where-dot"></View>
            <Text class="where-label">{'Where to?'}</Text>
          </Pressable>
        </Show>
      </View>
    </view>
  ));
}
