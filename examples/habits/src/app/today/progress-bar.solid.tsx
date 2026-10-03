/** @jsxImportSource @solidnative/platform/solid */
import { Text, View } from '@solidnative/components/solid';
import { withNativeStyles } from '@solidnative/platform/solid';
import sheet from './progress-bar.native.css';

/** The day's progress: a rounded track with an animated fill, and how many of how many. */
export function ProgressBar(props: { done: number; total: number }) {
  const percent = () => (props.total === 0 ? 0 : Math.round((props.done / props.total) * 100));
  return withNativeStyles(sheet, () => (
    <>
      <View class="header">
        <Text class="label">Today</Text>
        <Text class="count">
          {props.done} of {props.total}
        </Text>
      </View>
      <View class="track">
        <View class="fill" style={{ width: `${percent()}%` }} />
      </View>
    </>
  ));
}
