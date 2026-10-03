/**
 * `<expo-map>`: `expo-maps`' Apple map on iOS and its Google map on Android, as one element.
 *
 * A fake Fabric stands in for both. What is pinned is what the app depends on and cannot see:
 * the name each platform's view commits under (a wrong one commits as nothing, silently), the
 * props reaching the view as `expo-maps` names them, the view's events reaching the template, and
 * a camera move reaching the view's own function with the tag the view was committed under.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Engine } from '@solidnative/fabric';
import { createNativeRoot } from '@solidnative/platform/solid';
import { createFakeFabric, type FakeFabric } from '@solidnative/testing';
import { registerExpoViews } from '@solidnative/expo';
import { registerExpoMap, type MapViewFunctions } from '@solidnative/expo/map-view';
import { expoMapFixture } from './expo-map-fixture.tsx';

describe('the map view', () => {
  const roots: { dispose(): void }[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) root.dispose();
  });

  const render = (platform: 'ios' | 'android', functions: MapViewFunctions | null = null) => {
    registerExpoMap(platform);
    const fixture = expoMapFixture(functions);
    const fabric = createFakeFabric();
    const root = createNativeRoot({
      fabric,
      rootTag: 1,
      // Marks what went through the engine's colour conversion, which is RN's `processColor`.
      engineOptions: { processColor: (value) => `processed ${String(value)}` },
    });
    root.render(fixture.View);
    roots.push(root);
    return { fabric, root, fixture };
  };
  const view = (fabric: FakeFabric) => fabric.committed[0]!;

  it("commits as expo-maps' Apple view on iOS: the default view of ExpoAppleMaps", () => {
    // `requireNativeView('ExpoAppleMaps')`, no view name. `ExpoMaps` is the permissions module
    // and has no view at all, so `ExpoMaps_AppleMapsView` would commit as nothing.
    const { fabric } = render('ios');
    assert.equal(view(fabric).viewName, 'ViewManagerAdapter_ExpoAppleMaps');
  });

  it("commits as expo-maps' Google view on Android: the default view of ExpoGoogleMaps", () => {
    const { fabric } = render('android');
    assert.equal(view(fabric).viewName, 'ViewManagerAdapter_ExpoGoogleMaps');
  });

  it("registers the table's element names under the same views", () => {
    // `EXPO_VIEWS` had named these `ExpoMaps_GoogleMapsView` and `ExpoMaps_AppleMapsView`, which
    // exist on neither platform.
    for (const [element, name] of [
      ['expo-maps-apple', 'ViewManagerAdapter_ExpoAppleMaps'],
      ['expo-maps-google', 'ViewManagerAdapter_ExpoGoogleMaps'],
    ] as const) {
      const fabric = createFakeFabric();
      const engine = new Engine(fabric, 1, { processColor: (value) => value });
      registerExpoViews(element);
      engine.appendChild(engine.root, engine.createElement(element));
      engine.commit();
      assert.equal(fabric.committed[0]!.viewName, name, element);
    }
  });

  it('passes markers, camera and options as the props expo-maps reads', () => {
    const { fabric } = render('ios');
    const props = view(fabric).props;
    assert.deepEqual(props['markers'], [
      {
        id: 'kings-cross',
        title: "King's Cross",
        coordinates: { latitude: 51.53, longitude: -0.12 },
      },
      { id: 'paddington', title: 'Paddington', coordinates: { latitude: 51.51, longitude: -0.17 } },
    ]);
    assert.deepEqual(props['cameraPosition'], {
      coordinates: { latitude: 51.52, longitude: -0.14 },
      zoom: 12,
    });
    assert.deepEqual(props['properties'], { isTrafficEnabled: true, mapType: 'STANDARD' });
    assert.deepEqual(props['uiSettings'], { compassEnabled: false });
    assert.equal(props['colorScheme'], 'DARK');
  });

  it('passes polylines, polygons and circles with their colours converted, as expo-maps does', () => {
    // expo-maps' own React components run each shape's colours through processColor before
    // native sees them. Native reads the converted value.
    for (const platform of ['ios', 'android'] as const) {
      const { fabric } = render(platform);
      const props = view(fabric).props;
      assert.deepEqual(
        props['polylines'],
        [
          {
            id: 'route',
            coordinates: [
              { latitude: 51.53, longitude: -0.12 },
              { latitude: 51.51, longitude: -0.17 },
            ],
            color: 'processed #ff5a36',
            width: 5,
            contourStyle: 'GEODESIC',
            geodesic: true,
          },
        ],
        platform,
      );
      assert.deepEqual(props['polygons'], [
        {
          id: 'park',
          coordinates: [
            { latitude: 51.53, longitude: -0.16 },
            { latitude: 51.52, longitude: -0.15 },
            { latitude: 51.52, longitude: -0.16 },
          ],
          color: 'processed rgba(0, 128, 0, 0.5)',
          lineColor: 'processed green',
          lineWidth: 2,
        },
      ]);
      assert.deepEqual(props['circles'], [
        {
          id: 'zone-1',
          center: { latitude: 51.51, longitude: -0.13 },
          radius: 2000,
          color: 'processed blue',
          lineColor: undefined,
        },
      ]);
    }
  });

  it('sends a changed route to the view', () => {
    const { fabric, root, fixture } = render('ios');
    const line = { coordinates: [{ latitude: 1, longitude: 2 }], color: 'red' };
    fixture.setPolylines([line]);
    root.flush();
    assert.deepEqual(view(fabric).props['polylines'], [{ ...line, color: 'processed red' }]);
  });

  it("hands a tap on a polyline, a polygon or a circle to the screen, by the shape's id", () => {
    const { fabric, root, fixture } = render('ios');
    fabric.emit(view(fabric), 'topPolylineClick', { id: 'route', coordinates: [] });
    fabric.emit(view(fabric), 'topPolygonClick', { id: 'park', coordinates: [] });
    fabric.emit(view(fabric), 'topCircleClick', { id: 'zone-1', radius: 2000 });
    root.flush();
    assert.deepEqual(fixture.shapeClicks, ['route', 'park', 'zone-1']);
  });

  it("hands the view's taps and camera moves to the screen", async () => {
    const { fabric, root, fixture } = render('ios');
    fabric.emit(view(fabric), 'topMapClick', { coordinates: { latitude: 1, longitude: 2 } });
    fabric.emit(view(fabric), 'topMarkerClick', { id: 'paddington', title: 'Paddington' });
    fabric.emit(view(fabric), 'topCameraMove', { zoom: 14, coordinates: {} });
    root.flush();
    assert.deepEqual(fixture.mapClicks, [{ latitude: 1, longitude: 2 }]);
    assert.deepEqual(fixture.markerClicks, ['paddington']);
    assert.deepEqual(fixture.zooms, [14]);
  });

  /** View functions that only record what they were called with. */
  const recorder = () => {
    const calls: { name: string; tag: number; args: unknown[] }[] = [];
    const record = (name: string) =>
      async function (this: { nativeTag: number }, ...args: unknown[]) {
        calls.push({ name, tag: this.nativeTag, args });
      };
    const functions: MapViewFunctions = {
      setCameraPosition: record('setCameraPosition'),
      selectMarker: record('selectMarker'),
    };
    return { calls, functions };
  };
  /** What both platforms send once the native map is on screen. */
  const appear = (fabric: FakeFabric) =>
    fabric.emit(view(fabric), 'topCameraMove', { zoom: 12, coordinates: {} });

  it("moves the camera through the view's own function, with the view's tag", async () => {
    const { calls, functions } = recorder();
    const { fabric, fixture } = render('android', functions);
    const tag = view(fabric).reactTag;
    appear(fabric);

    const moved = await fixture
      .map()
      .setCameraPosition({ coordinates: { latitude: 51.5, longitude: -0.1 }, zoom: 15 });
    const selected = await fixture.map().selectMarker('paddington', { zoom: 16 });

    assert.equal(moved, true);
    assert.equal(selected, true);
    assert.deepEqual(calls, [
      {
        name: 'setCameraPosition',
        tag,
        args: [{ coordinates: { latitude: 51.5, longitude: -0.1 }, zoom: 15 }],
      },
      { name: 'selectMarker', tag, args: ['paddington', { zoom: 16 }] },
    ]);
  });

  it('holds a camera move until the native map exists, then sends it', async () => {
    // The view is committed, and has a tag, before native has mounted it. expo-maps finds its view
    // by that tag, so a call in between has no view to run on.
    const { calls, functions } = recorder();
    const { fabric, fixture } = render('ios', functions);
    const map = fixture.map();
    assert.notEqual(view(fabric).reactTag, undefined, 'committed, so it has a tag');
    assert.equal(map.ready(), false);

    const first = map.setCameraPosition({ zoom: 13 });
    const second = map.selectMarker('paddington');
    await Promise.resolve();
    assert.equal(calls.length, 0, 'nothing reaches native before the map is there');

    appear(fabric);
    assert.equal(map.ready(), true);
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.deepEqual(
      calls.map((call) => [call.name, call.args]),
      [
        ['setCameraPosition', [{ zoom: 13 }]],
        ['selectMarker', ['paddington', undefined]],
      ],
      'in the order they were asked',
    );

    // Once it is there, later calls go straight through.
    await map.setCameraPosition({ zoom: 14 });
    assert.equal(calls.length, 3);
  });

  it('answers false for a held call when the map goes before it appears', async () => {
    const { calls, functions } = recorder();
    const { root, fixture } = render('ios', functions);
    const moved = fixture.map().setCameraPosition({ zoom: 13 });

    root.dispose();

    assert.equal(await moved, false);
    assert.deepEqual(calls, []);
  });

  it('answers false without the module, rather than claiming a camera it never moved', async () => {
    const { fixture } = render('ios', null);
    assert.equal(await fixture.map().setCameraPosition({ zoom: 3 }), false);
    assert.equal(await fixture.map().selectMarker('paddington'), false);
  });
});
