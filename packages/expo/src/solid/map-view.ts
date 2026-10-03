import { createComputed, createSignal, onCleanup, type Accessor } from 'solid-js';
import { useHostEngine } from '@solidnative/platform/solid';
import type { NativeSyntheticEvent } from '@solidnative/fabric';
import { createNativeRef, type NativeRef, type ViewProps } from '@solidnative/components/solid';
import { createServiceToken, useService } from '@solidnative/device/solid';
import { expoModule } from '../native.ts';
import { nativeView, viewProps } from './view.ts';
import { ownedRequests } from './owned.ts';
import { viewFunctions, viewTarget } from './g11-features-view.ts';
export { registerExpoMap } from '../register-expo-map.ts';

export interface MapCoordinates {
  readonly latitude?: number;
  readonly longitude?: number;
}
export interface MapCameraPosition {
  readonly coordinates?: MapCoordinates;
  readonly zoom?: number;
}
export interface MapMarker {
  readonly id?: string;
  readonly coordinates?: MapCoordinates;
  readonly title?: string;
  readonly systemImage?: string;
  readonly monogram?: string;
  readonly tintColor?: string;
  readonly snippet?: string;
  readonly draggable?: boolean;
  readonly showCallout?: boolean;
  readonly anchor?: { readonly x: number; readonly y: number };
  readonly zIndex?: number;
}
export interface MapProperties {
  readonly isMyLocationEnabled?: boolean;
  readonly isTrafficEnabled?: boolean;
  readonly mapType?: 'STANDARD' | 'HYBRID' | 'IMAGERY' | 'NORMAL' | 'SATELLITE' | 'TERRAIN';
  readonly pointsOfInterest?: {
    readonly including?: readonly MapPointOfInterestCategory[];
    readonly excluding?: readonly MapPointOfInterestCategory[];
  };
  readonly elevation?: 'AUTOMATIC' | 'FLAT' | 'REALISTIC';
  readonly emphasis?: 'AUTOMATIC' | 'MUTED';
  readonly selectionEnabled?: boolean;
  readonly polylineTapThreshold?: number;
  readonly isBuildingEnabled?: boolean;
  readonly isIndoorEnabled?: boolean;
  readonly maxZoomPreference?: number;
  readonly minZoomPreference?: number;
  readonly mapStyleOptions?: { readonly json: string };
}
export interface MapUiSettings {
  readonly compassEnabled?: boolean;
  readonly myLocationButtonEnabled?: boolean;
  readonly scaleBarEnabled?: boolean;
  readonly togglePitchEnabled?: boolean;
  readonly indoorLevelPickerEnabled?: boolean;
  readonly mapToolbarEnabled?: boolean;
  readonly rotationGesturesEnabled?: boolean;
  readonly scrollGesturesEnabled?: boolean;
  readonly scrollGesturesEnabledDuringRotateOrZoom?: boolean;
  readonly tiltGesturesEnabled?: boolean;
  readonly zoomControlsEnabled?: boolean;
  readonly zoomGesturesEnabled?: boolean;
}
export type MapColorScheme = 'LIGHT' | 'DARK' | 'AUTOMATIC' | 'FOLLOW_SYSTEM';
export type MapColor = string;
export interface CameraMoveEvent {
  readonly coordinates: MapCoordinates;
  readonly zoom: number;
  readonly tilt: number;
  readonly bearing: number;
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}
export type MapPointOfInterestCategory =
  | 'MUSEUM'
  | 'MUSIC_VENUE'
  | 'THEATER'
  | 'LIBRARY'
  | 'PLANETARIUM'
  | 'SCHOOL'
  | 'UNIVERSITY'
  | 'MOVIE_THEATER'
  | 'NIGHTLIFE'
  | 'FIRE_STATION'
  | 'HOSPITAL'
  | 'PHARMACY'
  | 'POLICE'
  | 'CASTLE'
  | 'FORTRESS'
  | 'LANDMARK'
  | 'NATIONAL_MONUMENT'
  | 'BAKERY'
  | 'BREWERY'
  | 'CAFE'
  | 'DISTILLERY'
  | 'FOOD_MARKET'
  | 'RESTAURANT'
  | 'WINERY'
  | 'ANIMAL_SERVICE'
  | 'ATM'
  | 'AUTOMOTIVE_REPAIR'
  | 'BANK'
  | 'BEAUTY'
  | 'EV_CHARGER'
  | 'FITNESS_CENTER'
  | 'LAUNDRY'
  | 'MAILBOX'
  | 'POST_OFFICE'
  | 'RESTROOM'
  | 'SPA'
  | 'STORE'
  | 'AMUSEMENT_PARK'
  | 'AQUARIUM'
  | 'BEACH'
  | 'CAMPGROUND'
  | 'FAIRGROUND'
  | 'MARINA'
  | 'NATIONAL_PARK'
  | 'PARK'
  | 'RV_PARK'
  | 'ZOO'
  | 'BASEBALL'
  | 'BASKETBALL'
  | 'BOWLING'
  | 'GO_KART'
  | 'GOLF'
  | 'HIKING'
  | 'MINI_GOLF'
  | 'ROCK_CLIMBING'
  | 'SKATE_PARK'
  | 'SKATING'
  | 'SKIING'
  | 'SOCCER'
  | 'STADIUM'
  | 'TENNIS'
  | 'VOLLEYBALL'
  | 'AIRPORT'
  | 'CAR_RENTAL'
  | 'CONVENTION_CENTER'
  | 'GAS_STATION'
  | 'HOTEL'
  | 'PARKING'
  | 'PUBLIC_TRANSPORT'
  | 'FISHING'
  | 'KAYAKING'
  | 'SURFING'
  | 'SWIMMING';
export interface MapPolyline {
  readonly id?: string;
  readonly coordinates: readonly MapCoordinates[];
  readonly color?: MapColor;
  readonly width?: number;
  readonly contourStyle?: 'STRAIGHT' | 'GEODESIC';
  readonly geodesic?: boolean;
}

/** A filled shape with `coordinates` as its corners. */
export interface MapPolygon {
  readonly id?: string;
  readonly coordinates: readonly MapCoordinates[];
  readonly color?: MapColor;
  readonly lineColor?: MapColor;
  readonly lineWidth?: number;
}

/** A filled circle, `radius` metres across from `center`. */
export interface MapCircle {
  readonly id?: string;
  readonly center: MapCoordinates;
  readonly radius: number;
  readonly color?: MapColor;
  readonly lineColor?: MapColor;
  readonly lineWidth?: number;
}

/** Where to move the camera. `duration`, in milliseconds, is Android's; iOS does not animate it. */
export type MapCameraMove = MapCameraPosition & { readonly duration?: number };

export interface MapSelectOptions {
  /** The zoom to animate to. */
  readonly zoom?: number;
  /** Whether to move the camera to the marker at all. Defaults to true. */
  readonly moveCamera?: boolean;
}

export type MapClickEvent = NativeSyntheticEvent<{ readonly coordinates: MapCoordinates }>;
export type MapMarkerClickEvent = NativeSyntheticEvent<MapMarker>;
export type MapCameraMoveEvent = NativeSyntheticEvent<CameraMoveEvent>;
/** A tapped shape, as native holds it: its colours are native's own values, not strings. */
type Tapped<T> = Omit<T, 'color' | 'lineColor'> & {
  readonly color?: unknown;
  readonly lineColor?: unknown;
};
export type MapPolylineClickEvent = NativeSyntheticEvent<Tapped<MapPolyline>>;
export type MapPolygonClickEvent = NativeSyntheticEvent<Tapped<MapPolygon>>;
/** Android sends the circle's `center` and where it was tapped; iOS sends its centre as `coordinates`. */
export type MapCircleClickEvent = NativeSyntheticEvent<
  Omit<Tapped<MapCircle>, 'center'> & {
    readonly center?: MapCoordinates;
    readonly coordinates?: MapCoordinates;
    readonly clickCoordinates?: MapCoordinates;
  }
>;

/** The functions `expo-maps` defines on both views, called with the view's tag as `this`. */
export interface MapViewFunctions {
  setCameraPosition(this: { nativeTag: number }, position?: MapCameraMove): Promise<void>;
  selectMarker(this: { nativeTag: number }, id?: string, options?: MapSelectOptions): Promise<void>;
}

export interface MapViewRef extends NativeRef {
  readonly ready: Accessor<boolean>;
  setCameraPosition(position: MapCameraMove): Promise<boolean>;
  selectMarker(id?: string, options?: MapSelectOptions): Promise<boolean>;
}
export interface MapViewProps extends Omit<ViewProps, 'ref'> {
  ref?: (ref: MapViewRef) => void;
  foreground?: Accessor<boolean>;
  markers?: readonly MapMarker[];
  polylines?: readonly MapPolyline[];
  polygons?: readonly MapPolygon[];
  circles?: readonly MapCircle[];
  cameraPosition?: MapCameraPosition;
  properties?: MapProperties;
  uiSettings?: MapUiSettings;
  colorScheme?: MapColorScheme;
  onMapClick?: (event: MapClickEvent) => void;
  onMarkerClick?: (event: MapMarkerClickEvent) => void;
  onCameraMove?: (event: MapCameraMoveEvent) => void;
  onPolylineClick?: (event: MapPolylineClickEvent) => void;
  onPolygonClick?: (event: MapPolygonClickEvent) => void;
  onCircleClick?: (event: MapCircleClickEvent) => void;
}
const SOURCE = createServiceToken<MapViewFunctions | null>('expo.mapView.source', () =>
  expoModule('expo-maps', () => viewFunctions<MapViewFunctions>('ExpoAppleMaps', 'ExpoGoogleMaps')),
);
export const MapView = Object.assign(
  (props: MapViewProps) => {
    const functions = useService(SOURCE);
    const engine = useHostEngine();
    const requests = ownedRequests();
    const [ready, setReady] = createSignal(false);
    let live = true;
    const waiting = new Set<(ready: boolean) => void>();
    const release = (value: boolean) => {
      const held = [...waiting];
      waiting.clear();
      for (const resolve of held) resolve(value);
    };
    onCleanup(() => {
      live = false;
      release(false);
    });
    let target!: ReturnType<typeof viewTarget>;
    const appear = (event: MapCameraMoveEvent) => {
      if (!live || !target.live()) return;
      setReady(true);
      if (!live || !target.live()) return;
      release(true);
      if (live && target.live()) props.onCameraMove?.(event);
    };
    const node = nativeView(
      'expo-map',
      {
        get children() {
          return props.children;
        },
      },
      () => {
        return {
          ...viewProps(props as ViewProps, [
            'ref',
            'foreground',
            'polylines',
            'polygons',
            'circles',
            'onCameraMove',
          ]),
          polylines: props.polylines?.map((line) => ({ ...line, color: engine.color(line.color) })),
          polygons: props.polygons?.map((shape) => ({
            ...shape,
            color: engine.color(shape.color),
            lineColor: engine.color(shape.lineColor),
          })),
          circles: props.circles?.map((shape) => ({
            ...shape,
            color: engine.color(shape.color),
            lineColor: engine.color(shape.lineColor),
          })),
          onCameraMove: appear,
        };
      },
    );
    target = viewTarget(node, props.foreground);
    // Foreground loss settles held commands without destroying the retained map owner.
    createComputed(() => {
      if (props.foreground && !props.foreground()) release(false);
    });
    const call = (run: (functions: MapViewFunctions, tag: number) => Promise<void>) =>
      requests.run(false, async (active) => {
        const current = target.capture();
        const isCurrent = () => active() && live && current();
        if (!functions || !live || props.foreground?.() === false) return false;
        if (!ready()) {
          const shown = await new Promise<boolean>((resolve) => waiting.add(resolve));
          if (!shown) return false;
        }
        const tag = target.tag();
        if (tag === null || !isCurrent()) return false;
        try {
          await run(functions, tag);
          return isCurrent();
        } catch (error) {
          if (!isCurrent()) return false;
          throw error;
        }
      });
    const ref: MapViewRef = {
      ...createNativeRef(node),
      ready,
      setCameraPosition: (position) =>
        call((functions, nativeTag) => functions.setCameraPosition.call({ nativeTag }, position)),
      selectMarker: (id, options) =>
        call((functions, nativeTag) => functions.selectMarker.call({ nativeTag }, id, options)),
    };
    props.ref?.(ref);
    return node;
  },
  { SOURCE },
);
