/** @jsxImportSource @solid-native/platform/solid */
import { createMemo } from 'solid-js';
import { Share } from 'lucide-static';
import { Icon } from '@solid-native/icons/solid';
import { FileSystem } from '@solid-native/expo/solid/file-system';
import { ColorScheme, Sharing, useService } from '@solid-native/device/solid';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader, NativeHeaderItem, useRoute } from '@solid-native/router/solid';
import { MapView, type MapMarker, type MapPolyline } from '@solid-native/expo/solid/map-view';
import { Runs, type Run } from '../data/runs.solid.ts';
import { Units } from '../settings/units.solid.ts';
import {
  convertDistance,
  convertPace,
  formatDistance,
  formatDuration,
  formatPace,
} from '../tracking/geo.ts';
import { gpxFileName, toGpx } from '../export/gpx.solid.ts';
import sheet from './run-detail.native.css';

const ROUTE_COLOUR = '#ff5a36';
type Split = Run['splits'][number];

/** One finished run: its route on a map, splits per kilometre (or mile), and a GPX export. */
export function RunDetail() {
  const runsService = useService(Runs);
  const units = useService(Units);
  const files = useService(FileSystem);
  const sharing = useService(Sharing);
  const colorScheme = useService(ColorScheme);
  const route = useRoute();

  const run = createMemo(() => runsService.find(String(route.inputs['id'] ?? '')));
  const unit = units.unit;
  // The header itself follows the scheme automatically (NativeHeader's own defaults); this
  // button is ordinary content inside it, so its icon has to follow the scheme too.
  const onSurfaceColor = () => (colorScheme.current() === 'dark' ? '#fafafa' : '#18181b');

  const dateLabel = () => {
    const current = run();
    return current
      ? new Date(current.startedAt).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
        })
      : null;
  };
  const distanceLabel = () => {
    const current = run();
    return current ? formatDistance(convertDistance(current.distanceMeters, unit())) : '';
  };
  const durationLabel = () => {
    const current = run();
    return current ? formatDuration(current.durationSeconds) : '';
  };
  const paceLabel = () => {
    const current = run();
    if (!current) return '';
    const pace =
      current.distanceMeters > 0 ? current.durationSeconds / (current.distanceMeters / 1_000) : 0;
    return formatPace(convertPace(pace, unit()));
  };

  const polylines = createMemo<readonly MapPolyline[]>(() => {
    const points = run()?.route ?? [];
    return points.length < 2 ? [] : [{ coordinates: points, color: ROUTE_COLOUR, width: 5 }];
  });
  const markers = createMemo<readonly MapMarker[]>(() => {
    const points = run()?.route ?? [];
    if (points.length === 0) return [];
    return [
      { id: 'start', coordinates: points[0]!, title: 'Start', tintColor: '#22c55e' },
      { id: 'finish', coordinates: points.at(-1)!, title: 'Finish', tintColor: ROUTE_COLOUR },
    ];
  });
  const cameraPosition = createMemo(() => {
    const points = run()?.route ?? [];
    return {
      coordinates: points[Math.floor(points.length / 2)] ?? { latitude: 0, longitude: 0 },
      zoom: 14,
    };
  });

  const slowestSplitPace = createMemo(() =>
    Math.max(1, ...(run()?.splits.map((split) => split.paceSecondsPerUnit) ?? [])),
  );
  const splitPaceLabel = (split: Split) =>
    formatPace(convertPace(split.paceSecondsPerUnit, unit()));
  /** A faster split (lower pace) draws a shorter bar than a slower one, relative to the slowest. */
  const splitBarWidth = (split: Split) => {
    const slowest = slowestSplitPace();
    return slowest > 0 ? Math.max(8, (split.paceSecondsPerUnit / slowest) * 100) : 8;
  };

  const exportGpx = async (current: Run) => {
    const file = files.cache(gpxFileName(current));
    files.write(file, toGpx(current));
    await sharing.share({ url: file.uri, title: gpxFileName(current) });
  };

  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title={dateLabel() ?? 'Run'} backTitle="History">
        <Show when={run()}>
          {(current) => (
            <NativeHeaderItem type="right">
              <Pressable
                class="export"
                accessibilityRole="button"
                accessibilityLabel="Export as GPX"
                onPress={() => void exportGpx(current())}
              >
                <Icon svg={Share} size={19} color={onSurfaceColor()} />
              </Pressable>
            </NativeHeaderItem>
          )}
        </Show>
      </NativeHeader>

      <Show
        when={run()}
        fallback={
          <View class="screen missing">
            <Text>This run no longer exists.</Text>
          </View>
        }
      >
        {(current) => (
          <ScrollView class="screen" contentInsetAdjustmentBehavior="automatic">
            <MapView
              class="map"
              markers={markers()}
              polylines={polylines()}
              cameraPosition={cameraPosition()}
            />

            <View class="summary">
              <View class="stat">
                <Text class="stat-value">{distanceLabel()}</Text>
                <Text class="stat-label">{unit()}</Text>
              </View>
              <View class="stat">
                <Text class="stat-value">{durationLabel()}</Text>
                <Text class="stat-label">Time</Text>
              </View>
              <View class="stat">
                <Text class="stat-value">{paceLabel()}</Text>
                <Text class="stat-label">Pace /{unit()}</Text>
              </View>
            </View>

            <Show when={current().splits.length > 0}>
              <Text class="section-title">Splits</Text>
              <View class="splits">
                <For each={current().splits}>
                  {(split) => (
                    <View class="split">
                      <Text class="split-index">{split.index}</Text>
                      <View class="split-bar-track">
                        <View
                          class="split-bar-fill"
                          style={{ width: `${splitBarWidth(split)}%` }}
                        />
                      </View>
                      <Text class="split-pace">{splitPaceLabel(split)}</Text>
                    </View>
                  )}
                </For>
              </View>
            </Show>
          </ScrollView>
        )}
      </Show>
    </view>
  ));
}
