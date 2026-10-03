/*
 * @jsxImportSource @solidnative/platform/solid
 *
 * One of the landing page's three hero apps: a fitness summary. The activity rings are bordered
 * circles, each arc three or two of its four sides, turned so the gap sits where a ring ends. The
 * run's map is drawn, not loaded: streets and a park are views, and the route is a line of short
 * rotated views with round joints. Photographed on the iOS simulator and the Android emulator;
 * see the landing README.
 */
import { Text, View } from '@solidnative/components/solid';
import { useStatusBar } from '@solidnative/device/solid';
import { Icon } from '@solidnative/icons/solid';
import { For } from '@solidnative/platform/solid';
import { lucideSvg, type IconName } from '../icon.data.ts';

/** The run, in the map's own coordinates: 362 wide, 300 tall. */
const ROUTE: readonly [number, number][] = [
  [34, 220],
  [70, 200],
  [96, 162],
  [150, 150],
  [178, 116],
  [226, 108],
  [252, 76],
  [306, 82],
  [332, 58],
];
const LINE = 5;
const START = ROUTE[0]!;
const END = ROUTE[ROUTE.length - 1]!;

/** Each leg of the route as a bar, centred on its midpoint and turned to its angle. */
const LEGS = ROUTE.slice(1).map(([x2, y2], index) => {
  const [x1, y1] = ROUTE[index]!;
  const width = Math.hypot(x2 - x1, y2 - y1);
  return {
    left: (x1 + x2) / 2 - width / 2,
    top: (y1 + y2) / 2 - LINE / 2,
    width,
    angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
  };
});
const STREETS = [
  { left: -20, top: 176, width: 420, height: 10, angle: -8 },
  { left: -20, top: 84, width: 420, height: 7, angle: 4 },
  { left: 60, top: 140, width: 300, height: 7, angle: 72 },
  { left: -60, top: 140, width: 300, height: 10, angle: -64 },
  { left: 150, top: 140, width: 300, height: 6, angle: 58 },
];
const RINGS = [
  {
    name: 'MOVE',
    value: '452',
    goal: '600 kcal',
    color: '#fa114f',
    track: '#fa114f33',
    inset: 0,
    full: true,
  },
  {
    name: 'EXERCISE',
    value: '15',
    goal: '30 min',
    color: '#a6ff00',
    track: '#a6ff0033',
    inset: 16,
    full: false,
  },
  {
    name: 'STAND',
    value: '9',
    goal: '12 hr',
    color: '#00f0ff',
    track: '#00f0ff33',
    inset: 32,
    full: true,
  },
];
const STATS: readonly { label: string; value: string; icon: IconName; color: string }[] = [
  { label: 'Steps', value: '8,241', icon: 'footprints', color: '#7c3aed' },
  { label: 'Avg heart', value: '142 bpm', icon: 'heart-pulse', color: '#e11d48' },
  { label: 'Active', value: '1h 12m', icon: 'timer', color: '#0891b2' },
];
const SPLITS = [
  { label: 'Time', value: '28:14' },
  { label: 'Pace', value: '5\'23"' },
];

export default function Fitness() {
  useStatusBar(() => ({ style: 'dark' }));
  return (
    <View class="flex-1 bg-[#f3f3f5] px-5 pt-16">
      <View class="flex-row items-center justify-between">
        <View>
          <Text class="text-sm font-medium text-zinc-500">Good evening, Ada</Text>
          <Text class="text-[34px] font-bold tracking-tight text-zinc-950">Today</Text>
        </View>
        <View class="flex-row items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-sm">
          <Icon svg={lucideSvg('flame')} size={16} color="#f97316" />
          <Text class="text-xs font-bold text-zinc-900">12-day streak</Text>
        </View>
      </View>

      <View class="mt-5 flex-row items-center gap-6 rounded-[30px] bg-[#0e0e12] p-5">
        <View class="size-[136px]">
          <For each={RINGS}>
            {(ring) => (
              <>
                <View
                  class="absolute rounded-full"
                  style={{ inset: ring.inset, borderWidth: 13, borderColor: ring.track }}
                />
                <View
                  class="absolute rounded-full"
                  style={{
                    inset: ring.inset,
                    borderWidth: 13,
                    borderTopColor: ring.color,
                    borderRightColor: ring.color,
                    borderBottomColor: ring.full ? ring.color : 'transparent',
                    borderLeftColor: 'transparent',
                    transform: 'rotate(45deg)',
                  }}
                />
              </>
            )}
          </For>
        </View>
        <View class="flex-1 gap-3.5">
          <For each={RINGS}>
            {(ring) => (
              <View>
                <Text class="text-[11px] font-bold tracking-[1.5px]" style={{ color: ring.color }}>
                  {ring.name}
                </Text>
                <View class="flex-row items-baseline">
                  <Text class="text-xl font-bold text-white">{ring.value}</Text>
                  <Text class="ml-1 text-sm font-medium text-white/40">/ {ring.goal}</Text>
                </View>
              </View>
            )}
          </For>
        </View>
      </View>

      <View class="mt-3 flex-row gap-3">
        <For each={STATS}>
          {(stat) => (
            <View class="flex-1 rounded-3xl bg-white p-4 shadow-sm">
              <Icon svg={lucideSvg(stat.icon)} size={20} color={stat.color} />
              <Text class="mt-3 text-lg font-bold text-zinc-950">{stat.value}</Text>
              <Text class="text-xs font-medium text-zinc-500">{stat.label}</Text>
            </View>
          )}
        </For>
      </View>

      <View class="mt-3 h-[300px] overflow-hidden rounded-[30px] bg-[#e9eef2]">
        <View class="absolute -top-6 -left-8 h-28 w-40 rounded-[48px] bg-[#cfe6c6]" />
        <View class="absolute -right-10 bottom-14 h-24 w-44 rounded-[48px] bg-[#cfe2f3]" />
        <For each={STREETS}>
          {(street) => (
            <View
              class="absolute rounded-full bg-white"
              style={{
                left: street.left,
                top: street.top,
                width: street.width,
                height: street.height,
                transform: `rotate(${street.angle}deg)`,
              }}
            />
          )}
        </For>

        <For each={LEGS}>
          {(leg) => (
            <View
              class="absolute rounded-full bg-[#ff4d1a]"
              style={{
                left: leg.left,
                top: leg.top,
                width: leg.width,
                height: LINE,
                transform: `rotate(${leg.angle}deg)`,
              }}
            />
          )}
        </For>
        <For each={ROUTE}>
          {(point) => (
            <View
              class="absolute rounded-full bg-[#ff4d1a]"
              style={{
                left: point[0] - LINE / 2,
                top: point[1] - LINE / 2,
                width: LINE,
                height: LINE,
              }}
            />
          )}
        </For>
        <View
          class="absolute size-4 rounded-full border-[3px] border-white bg-emerald-500"
          style={{ left: START[0] - 8, top: START[1] - 8 }}
        />
        <View
          class="absolute size-9 rounded-full bg-[#ff4d1a]/25"
          style={{ left: END[0] - 18, top: END[1] - 18 }}
        />
        <View
          class="absolute size-4 rounded-full border-[3px] border-white bg-[#ff4d1a]"
          style={{ left: END[0] - 8, top: END[1] - 8 }}
        />

        <View class="absolute inset-x-3 bottom-3 flex-row items-center justify-between rounded-[22px] bg-white/95 px-4 py-3">
          <View>
            <Text class="text-[11px] font-bold tracking-[1.5px] text-[#ff4d1a]">EVENING RUN</Text>
            <Text class="text-xl font-bold text-zinc-950">5.24 km</Text>
          </View>
          <View class="flex-row gap-4">
            <For each={SPLITS}>
              {(split) => (
                <View class="items-end">
                  <Text class="text-sm font-bold text-zinc-950">{split.value}</Text>
                  <Text class="text-[11px] text-zinc-500">{split.label}</Text>
                </View>
              )}
            </For>
          </View>
        </View>
      </View>
    </View>
  );
}

/** A whole screen. */
export const height = 874;
