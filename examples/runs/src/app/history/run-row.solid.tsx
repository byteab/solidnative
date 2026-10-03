/** @jsxImportSource @solidnative/platform/solid */
import { Footprints } from 'lucide-static';
import { Icon } from '@solidnative/icons/solid';
import { Text, View } from '@solidnative/components/solid';
import { setNativeStyleHost, withNativeStyles } from '@solidnative/platform/solid';
import type { Run } from '../data/runs.solid.ts';
import {
  convertDistance,
  convertPace,
  formatDistance,
  formatDuration,
  formatPace,
  type DistanceUnit,
} from '../tracking/geo.ts';
import sheet from './run-row.native.css';

/** One past run: its date, distance and pace, in the person's chosen unit. */
export function RunRow(props: { run: Run; unit: DistanceUnit }) {
  const dateLabel = () =>
    new Date(props.run.startedAt).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  const splitsLabel = () => {
    const count = props.run.splits.length;
    return count === 1 ? '1 split' : `${count} splits`;
  };
  const paceLabel = () => {
    const run = props.run;
    const pace = run.distanceMeters > 0 ? run.durationSeconds / (run.distanceMeters / 1_000) : 0;
    return formatPace(convertPace(pace, props.unit));
  };
  return withNativeStyles(sheet, () => (
    <view ref={(node) => setNativeStyleHost(node, sheet)}>
      <View class="row">
        <View class="badge">
          <Icon svg={Footprints} size={20} color="#ff5a36" />
        </View>
        <View class="body">
          <Text class="date">{dateLabel()}</Text>
          <Text class="summary">
            {formatDuration(props.run.durationSeconds)} · {splitsLabel()}
          </Text>
        </View>
        <View class="stats">
          <Text class="distance">
            {formatDistance(convertDistance(props.run.distanceMeters, props.unit))} {props.unit}
          </Text>
          <Text class="pace">
            {paceLabel()} /{props.unit}
          </Text>
        </View>
      </View>
    </view>
  ));
}
