---
title: Maps
summary: MapView - Apple Maps on iOS and Google Maps on Android, with markers, shapes, a camera and taps.
---

# Maps

`MapView` is `expo-maps` as one Solid component: Apple Maps on iOS, Google Maps on Android. It
takes markers, shapes and a camera position, reports taps and camera moves, and moves the camera
from code. Every prop is the `expo-maps` prop of the same name; nothing is added on top.

## Install

```sh
npx expo install expo-maps
```

```ts
import { MapView, registerExpoMap } from '@solidnative/expo/solid/map-view';
```

`expo-maps` needs a native rebuild (`npx expo run:ios`, `npx expo run:android`, or a new EAS
build); it does not run in Expo Go.

**iOS** needs no key. The map renders on iOS 17+ (an empty view before), and marker taps need iOS 18.

**Android** needs a Google Maps API key with the Maps SDK for Android enabled, in `app.json`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": { "apiKey": "YOUR_ANDROID_MAPS_KEY" }
      }
    }
  }
}
```

**The user's location** (`isMyLocationEnabled`) needs the location permission. `expo-maps`' config
plugin writes `NSLocationWhenInUseUsageDescription` and the Android manifest permissions when asked:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-maps",
        {
          "requestLocationPermission": true,
          "locationPermission": "Allow $(PRODUCT_NAME) to show where you are on the map"
        }
      ]
    ]
  }
}
```

Then request it at runtime, e.g. with [Location](/packages/expo/location). A map without the
user's location needs neither.

## The smallest thing that works

```tsx
import { createSignal } from 'solid-js';
import { Platform } from 'react-native';
import { Pressable, Text } from '@solidnative/components/solid';
import {
  MapView,
  registerExpoMap,
  type MapMarker,
  type MapViewRef,
} from '@solidnative/expo/solid/map-view';

registerExpoMap(Platform.OS as 'ios' | 'android'); // once, before the app mounts

const KINGS_CROSS = { latitude: 51.5308, longitude: -0.1238 };
const stations: MapMarker[] = [
  { id: 'kings-cross', title: "King's Cross", coordinates: KINGS_CROSS },
  { id: 'paddington', title: 'Paddington', coordinates: { latitude: 51.5154, longitude: -0.1755 } },
];

export function Stations() {
  let map: MapViewRef | undefined;
  const [picked, setPicked] = createSignal('');

  return (
    <>
      <MapView
        class="flex-1"
        ref={(ref) => (map = ref)}
        markers={stations}
        cameraPosition={{ coordinates: { latitude: 51.52, longitude: -0.15 }, zoom: 12 }}
        onMarkerClick={(event) => setPicked(event.nativeEvent.title ?? '')}
      />
      <Text>{picked()}</Text>
      <Pressable onPress={() => map?.setCameraPosition({ coordinates: KINGS_CROSS, zoom: 16 })}>
        <Text>King's Cross</Text>
      </Pressable>
    </>
  );
}
```

The map has no size of its own: without a height or `flex: 1` it is not on screen.

## Registering the view

`registerExpoMap(platform)` maps the `expo-map` element to `ExpoAppleMaps`' view on iOS and
`ExpoGoogleMaps`' on Android (Fabric names `ViewManagerAdapter_ExpoAppleMaps` and
`ViewManagerAdapter_ExpoGoogleMaps`). Call it once at startup, before the first map commits.

To write each platform's element yourself, `registerExpoViews('expo-maps-apple')` and
`registerExpoViews('expo-maps-google')` register the same views under those names (see
[Native views](/packages/expo/native-views)), as untyped elements with no Solid component.

## Props

- **`markers`** - `id`, `coordinates` and `title` on both platforms; the `id` identifies a tapped
  marker. `systemImage` (an SF Symbol), `monogram` and `tintColor` are Apple's; `snippet`,
  `draggable`, `showCallout`, `anchor` and `zIndex` are Google's. Each ignores the other's.
- **`polylines`** - `{ id, coordinates, color, width }`. For a geodesic line set `contourStyle:
'GEODESIC'` (iOS) and `geodesic: true` (Android).
- **`polygons`** - `{ id, coordinates, color, lineColor, lineWidth }`, corners as `coordinates`.
- **`circles`** - `{ id, center, radius, color, lineColor, lineWidth }`, `radius` in meters.
- **`cameraPosition`** - `{ coordinates, zoom }`. Setting a new value moves the camera.
- **`properties`** - `expo-maps`' map properties: `mapType`, `isTrafficEnabled`,
  `isMyLocationEnabled`, `selectionEnabled`, and each platform's own (`elevation`,
  `pointsOfInterest` on iOS; `isBuildingEnabled`, `minZoomPreference`, `mapStyleOptions` on
  Android...).
- **`uiSettings`** - which controls are shown: `compassEnabled`, `myLocationButtonEnabled`,
  `scaleBarEnabled`, `togglePitchEnabled` on both, and Google's zoom, gesture and toolbar switches.
- **`colorScheme`** - `LIGHT` or `DARK` on both, `AUTOMATIC` on iOS, `FOLLOW_SYSTEM` on Android.

Enums are typed as their string values, so `mapType: 'HYBRID'` needs no `expo-maps` import. Shape
colors take any style color (`'#ff5a36'`, `'rgba(0, 128, 0, 0.5)'`, `'green'`), converted as
`expo-maps`' React components convert them.

A growing route is a `createMemo` over the fixes; the map redraws the line on each change:

```tsx
import { createMemo, createSignal } from 'solid-js';
import { MapView, type MapCoordinates, type MapPolyline } from '@solidnative/expo/solid/map-view';

export function Route() {
  const [fixes, setFixes] = createSignal<MapCoordinates[]>([]);
  // setFixes((all) => [...all, fix]) as each fix arrives
  const route = createMemo<MapPolyline[]>(() => [
    { id: 'route', coordinates: fixes(), color: '#ff5a36', width: 5 },
  ]);
  return <MapView class="flex-1" polylines={route()} />;
}
```

## Callbacks

Each receives the view's own event, so the payload is `event.nativeEvent`:

- **`onMapClick`** - a tap on the map, not on a marker: `{ coordinates }`.
- **`onMarkerClick`** - a tap on a marker: the marker as you gave it, with its `id`.
- **`onCameraMove`** - `coordinates`, `zoom`, `tilt`, `bearing`, and the visible region's
  `latitudeDelta` and `longitudeDelta`. Also sent once when the map first appears.
- **`onPolylineClick`**, **`onPolygonClick`**, **`onCircleClick`** - the shape, with its `id`;
  colors come back in native form, not as the strings you gave.

## Moving the camera from code

The `ref` callback receives a `MapViewRef`. **`setCameraPosition({ coordinates, zoom, duration })`**
moves the camera; **`selectMarker(id, { zoom, moveCamera })`** selects a marker as a tap would (no
`id` clears it). Both resolve to `true` once the view was asked, `false` without the module.

Calls made before the map is on screen are held and sent in order once it is, so calling from the
`ref` callback or an opening effect is safe. The first camera move marks the map present;
**`ready`** is an accessor of that. A held call resolves to `false` if the map is disposed first.
While an optional **`foreground`** accessor prop reads `false` (pass `SCREEN_IN_FRONT` from
`@solidnative/device/solid`), calls resolve to `false` instead of reaching an off-screen map.

These are view functions `expo-maps` defines, addressed by the view's committed tag, which
`MapView` supplies. In a test, `provideService(MapView.SOURCE, () => fake)` inside a
`ServiceScope` replaces them.

## Platform differences

- Enums differ: a plain map is `mapType: 'STANDARD'` on iOS, `'NORMAL'` on Android; satellite is
  `'IMAGERY'` and `'SATELLITE'`. Each side knows only its own values, so choose per platform.
- `duration` in `setCameraPosition` is Android-only.
- Marker and shape taps need iOS 18. On iOS 17 everything shows, but `onMarkerClick`,
  `onPolylineClick`, `onPolygonClick` and `onCircleClick` never fire.
- A tapped circle's center is `coordinates` on iOS and `center` on Android, where
  `clickCoordinates` also says where the tap landed.
- Apple markers take `systemImage`, `monogram` and a `tintColor` color string; Google markers take
  a `snippet` and can be dragged.

## Limits

- Only cross-platform props are typed. Apple's annotations and `selectAnnotation`, Google's
  `userLocation`, `contentPadding` and `mapOptions`, and a Google marker's `icon` (an image shared
  object) are not mapped.
- Google's `onMapLoaded`, `onMapLongClick` and `onPOIClick`, Google Street View, and Apple's Look
  Around are not wrapped.
- `expo-maps` is marked alpha by Expo and may change between SDK versions.

## Reference

`MapView` is exported from `@solidnative/expo/solid/map-view`.

<!-- api: MapView -->
