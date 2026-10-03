/** @jsxImportSource @solidnative/platform/solid */
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  View,
} from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { Show } from '@solidnative/platform/solid';
import type { DistanceUnit } from '../tracking/geo.ts';
import { defaultsToSimulated, LocationSourceSetting } from './location-source-setting.solid.ts';
import { Units } from './units.solid.ts';

/** Units, and - in development - which location source a run records from. */
export function Settings() {
  const unit = useService(Units).unit;
  const simulateLocation = useService(LocationSourceSetting).simulate;
  const showDeveloperSection = defaultsToSimulated();

  const unitChoice = (choice: DistanceUnit) => (
    <Pressable
      class={`px-4 py-2 ${unit() === choice ? 'bg-orange-500' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected: unit() === choice }}
      onPress={() => unit.set(choice)}
    >
      <Text
        class={`text-sm font-semibold ${unit() === choice ? 'text-white' : 'text-zinc-900 dark:text-white'}`}
      >
        {choice}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView class="flex-1 bg-zinc-100 dark:bg-black" edges={['top']}>
      <ScrollView class="flex-1">
        <Text class="px-5 pt-4 pb-3 text-3xl font-bold text-zinc-900 dark:text-white">
          Settings
        </Text>

        <Text class="px-5 pt-4 pb-2 text-xs text-zinc-500 uppercase">Units</Text>
        <View class="bg-white dark:bg-zinc-900 ios:mx-4 ios:rounded-xl">
          <View class="flex-row items-center justify-between px-4 py-3">
            <Text class="text-zinc-900 dark:text-white">Distance and pace</Text>
            <View class="flex-row overflow-hidden rounded-full border border-zinc-200 dark:border-zinc-700">
              {unitChoice('km')}
              {unitChoice('mi')}
            </View>
          </View>
        </View>

        <Show when={showDeveloperSection}>
          <Text class="px-5 pt-6 pb-2 text-xs text-zinc-500 uppercase">Developer</Text>
          <View class="bg-white dark:bg-zinc-900 ios:mx-4 ios:rounded-xl">
            <View class="flex-row items-center justify-between px-4 py-3">
              <View class="flex-1 pr-3">
                <Text class="text-zinc-900 dark:text-white">Simulate location</Text>
                <Text class="text-xs text-zinc-500">
                  Replays a recorded route instead of the GPS.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Simulate location"
                value={simulateLocation()}
                onValueChange={(wants) => simulateLocation.set(wants)}
              />
            </View>
          </View>
        </Show>
      </ScrollView>
    </SafeAreaView>
  );
}
