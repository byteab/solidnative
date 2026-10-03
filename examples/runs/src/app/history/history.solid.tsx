/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader, NativeStackOutlet, useNavigation } from '@solidnative/router/solid';
import { Runs } from '../data/runs.solid.ts';
import { Units } from '../settings/units.solid.ts';
import { RunRow } from './run-row.solid.tsx';
import sheet from './history.native.css';

/** The History tab is a stack of its own, for the native header its large title needs. */
export function HistoryStack() {
  return <NativeStackOutlet />;
}

/** Every finished run, newest first. Tapping one opens its detail screen. */
export function History() {
  const runs = useService(Runs).runs;
  const unit = useService(Units).unit;
  const navigation = useNavigation();
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title="History" largeTitle />
      <ScrollView class="screen" contentInsetAdjustmentBehavior="automatic">
        <Show
          when={runs().length > 0}
          fallback={
            <View class="empty">
              <Text class="empty-title">No runs yet</Text>
              <Text class="empty-body">Finish a run and it will show up here.</Text>
            </View>
          }
        >
          <View class="content">
            <For each={runs()}>
              {(run) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void navigation.push(`/runs/${run.id}`)}
                >
                  <RunRow run={run} unit={unit()} />
                </Pressable>
              )}
            </For>
          </View>
        </Show>
      </ScrollView>
    </view>
  ));
}
