/** @jsxImportSource @solid-native/platform/solid */
import { createEffect, createMemo, onCleanup } from 'solid-js';
import { Pause, Play, Square } from 'lucide-static';
import { Icon } from '@solid-native/icons/solid';
import { ColorScheme, useService } from '@solid-native/device/solid';
import { KeepAwake } from '@solid-native/expo/solid/keep-awake';
import { Location } from '@solid-native/expo/solid/location';
import { Pressable, Text, View } from '@solid-native/components/solid';
import { Show, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import { TabSafeAreaView, useNavigation } from '@solid-native/router/solid';
import {
  MapView,
  type MapMarker,
  type MapPolyline,
  type MapViewRef,
} from '@solid-native/expo/solid/map-view';
import { LocationSourceSetting } from '../settings/location-source-setting.solid.ts';
import { Units } from '../settings/units.solid.ts';
import { Tracking } from '../tracking/tracking.solid.ts';
import { SIMULATED_ROUTE } from '../tracking/simulated-route.ts';
import {
  convertDistance,
  convertPace,
  formatDistance,
  formatDuration,
  formatPace,
} from '../tracking/geo.ts';
import sheet from './run.native.css';

const ROUTE_COLOUR = '#ff5a36';
/** Where the map opens before the first fix arrives: the simulated route's own start. */
const START = SIMULATED_ROUTE[0]!;
const mapUiSettings = { myLocationButtonEnabled: false, compassEnabled: false };

/**
 * The live run: a map that follows the route as it is recorded, big numbers for time, distance
 * and pace, and start/pause/finish controls. Keeps the screen awake while recording, and shows a
 * denied state instead of the map when location access has not been granted.
 */
export function Run() {
  const tracking = useService(Tracking);
  const location = useService(Location);
  const locationSetting = useService(LocationSourceSetting);
  const units = useService(Units);
  const keepAwake = useService(KeepAwake);
  const navigation = useNavigation();
  const colorScheme = useService(ColorScheme);
  let map: MapViewRef | undefined;

  const status = tracking.status;
  // The secondary control's background flips light/dark with the theme (`run.native.css`), so its
  // icon has to as well - an icon's colour is drawn straight into the SVG, not something CSS reaches.
  const onSurfaceColor = () => (colorScheme.current() === 'dark' ? '#fafafa' : '#18181b');
  const unit = units.unit;
  const elapsedLabel = () => formatDuration(tracking.elapsedSeconds());
  const distanceLabel = () => formatDistance(convertDistance(tracking.distanceMeters(), unit()));
  const paceLabel = () => formatPace(convertPace(tracking.paceSecondsPerKm(), unit()));
  const needsLocationPermission = () =>
    !locationSetting.simulate() && !location.permission.granted();

  const route = createMemo(() =>
    tracking.route().map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
  );
  const polylines = createMemo<readonly MapPolyline[]>(() => {
    const coordinates = route();
    return coordinates.length < 2 ? [] : [{ coordinates, color: ROUTE_COLOUR, width: 5 }];
  });
  const markers = createMemo<readonly MapMarker[]>(() => {
    const current = route().at(-1);
    return current ? [{ id: 'current', coordinates: current, tintColor: ROUTE_COLOUR }] : [];
  });
  const cameraPosition = createMemo(() => ({ coordinates: route().at(-1) ?? START, zoom: 16 }));

  // Follows the runner as new fixes arrive, while there is a map to move.
  createEffect(() => {
    const position = cameraPosition();
    void map?.setCameraPosition(position);
  });
  // Held only while actually recording: paused or idle, the screen may sleep like any other.
  createEffect(() => {
    if (status() !== 'recording') return;
    onCleanup(keepAwake.hold('run-recording'));
  });
  onCleanup(() => {
    if (status() !== 'idle') tracking.discard();
  });

  const finishRun = () => {
    const run = tracking.finish();
    if (run) void navigation.push(`/runs/${run.id}`);
  };
  const requestLocation = async () => {
    await location.permission.ensure();
  };

  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <View class="screen">
        <MapView
          class="map"
          ref={(ref) => {
            map = ref;
          }}
          markers={markers()}
          polylines={polylines()}
          cameraPosition={cameraPosition()}
          uiSettings={mapUiSettings}
        />

        <Show when={needsLocationPermission()}>
          <View class="permission-overlay">
            <View class="permission-card">
              <Text class="permission-title">Location access needed</Text>
              <Text class="permission-body">
                Runs uses your location to track your route, distance and pace while you run.
              </Text>
              <Pressable
                class="permission-button"
                accessibilityRole="button"
                onPress={() => void requestLocation()}
              >
                <Text class="permission-button-label">Allow location</Text>
              </Pressable>
            </View>
          </View>
        </Show>

        {/*
          The panel paints to the very bottom of the screen, behind the tab bar, and its content
          stops where the bar begins. TabSafeAreaView takes the bar's height from the tab screen
          itself, as a margin, which the panel grows around. A SafeAreaView cannot: its insets come
          from the app's root provider, which sits above the tab bar and knows only the home
          indicator, and its padding leaves the map showing through the inset.
        */}
        <View class="panel absolute bottom-0 inset-x-0">
          <TabSafeAreaView class="panel-content" edges={['bottom']}>
            <View class="stats">
              <View class="stat">
                <Text class="stat-value" testID="elapsed">
                  {elapsedLabel()}
                </Text>
                <Text class="stat-label">Time</Text>
              </View>
              <View class="stat">
                <Text class="stat-value" testID="distance">
                  {distanceLabel()}
                </Text>
                <Text class="stat-label" testID="unit">
                  {unit() === 'km' ? 'km' : 'mi'}
                </Text>
              </View>
              <View class="stat">
                <Text class="stat-value" testID="pace">
                  {paceLabel()}
                </Text>
                <Text class="stat-label">Pace /{unit()}</Text>
              </View>
            </View>

            <View class="controls">
              <Show
                when={status() === 'idle'}
                fallback={
                  <>
                    <Show
                      when={status() === 'recording'}
                      fallback={
                        <Pressable
                          class="control secondary"
                          accessibilityRole="button"
                          accessibilityLabel="Resume run"
                          onPress={() => tracking.resume()}
                        >
                          <Icon svg={Play} size={22} color={onSurfaceColor()} />
                        </Pressable>
                      }
                    >
                      <Pressable
                        class="control secondary"
                        accessibilityRole="button"
                        accessibilityLabel="Pause run"
                        onPress={() => tracking.pause()}
                      >
                        <Icon svg={Pause} size={22} color={onSurfaceColor()} />
                      </Pressable>
                    </Show>
                    <Pressable
                      class="control stop"
                      accessibilityRole="button"
                      accessibilityLabel="Finish run"
                      onPress={finishRun}
                    >
                      <Icon svg={Square} size={20} color="#ffffff" />
                    </Pressable>
                  </>
                }
              >
                <Pressable
                  class="control"
                  accessibilityRole="button"
                  accessibilityLabel="Start run"
                  onPress={() => tracking.start()}
                >
                  <Icon svg={Play} size={28} color="#ffffff" />
                </Pressable>
              </Show>
            </View>
          </TabSafeAreaView>
        </View>
      </View>
    </view>
  ));
}
