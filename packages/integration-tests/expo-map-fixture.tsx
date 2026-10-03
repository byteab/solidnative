/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { provideService, withServiceScope } from '@solid-native/device/solid';
import {
  MapView,
  type MapCircle,
  type MapPolygon,
  type MapPolyline,
  type MapViewFunctions,
  type MapViewRef,
} from '@solid-native/expo/map-view';

/** A map of central London, under a scope that provides `functions` as the module. */
export function expoMapFixture(functions: MapViewFunctions | null) {
  let map: MapViewRef | undefined;
  const [polylines, setPolylines] = createSignal<readonly MapPolyline[]>([
    {
      id: 'route',
      coordinates: [
        { latitude: 51.53, longitude: -0.12 },
        { latitude: 51.51, longitude: -0.17 },
      ],
      color: '#ff5a36',
      width: 5,
      contourStyle: 'GEODESIC',
      geodesic: true,
    },
  ]);
  const polygons: MapPolygon[] = [
    {
      id: 'park',
      coordinates: [
        { latitude: 51.53, longitude: -0.16 },
        { latitude: 51.52, longitude: -0.15 },
        { latitude: 51.52, longitude: -0.16 },
      ],
      color: 'rgba(0, 128, 0, 0.5)',
      lineColor: 'green',
      lineWidth: 2,
    },
  ];
  const circles: MapCircle[] = [
    { id: 'zone-1', center: { latitude: 51.51, longitude: -0.13 }, radius: 2000, color: 'blue' },
  ];
  const mapClicks: unknown[] = [];
  const markerClicks: unknown[] = [];
  const zooms: unknown[] = [];
  const shapeClicks: unknown[] = [];
  const View = () =>
    withServiceScope([provideService(MapView.SOURCE, () => functions)], () => (
      <MapView
        ref={(value) => (map = value)}
        markers={[
          {
            id: 'kings-cross',
            title: "King's Cross",
            coordinates: { latitude: 51.53, longitude: -0.12 },
          },
          {
            id: 'paddington',
            title: 'Paddington',
            coordinates: { latitude: 51.51, longitude: -0.17 },
          },
        ]}
        polylines={polylines()}
        polygons={polygons}
        circles={circles}
        cameraPosition={{ coordinates: { latitude: 51.52, longitude: -0.14 }, zoom: 12 }}
        properties={{ isTrafficEnabled: true, mapType: 'STANDARD' }}
        uiSettings={{ compassEnabled: false }}
        colorScheme="DARK"
        onMapClick={(event) => mapClicks.push(event.nativeEvent.coordinates)}
        onMarkerClick={(event) => markerClicks.push(event.nativeEvent.id)}
        onCameraMove={(event) => zooms.push(event.nativeEvent.zoom)}
        onPolylineClick={(event) => shapeClicks.push(event.nativeEvent.id)}
        onPolygonClick={(event) => shapeClicks.push(event.nativeEvent.id)}
        onCircleClick={(event) => shapeClicks.push(event.nativeEvent.id)}
      />
    ));
  return {
    View,
    map: () => map!,
    setPolylines,
    mapClicks,
    markerClicks,
    zooms,
    shapeClicks,
  };
}
