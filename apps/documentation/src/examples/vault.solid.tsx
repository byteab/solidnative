/*
 * @jsxImportSource @solidnative/platform/solid
 *
 * One of the landing page's three hero apps: a dark banking home screen. Glows are radial
 * gradients, the card a linear one, the icons native SVG - all Tailwind classes, all real views.
 * Photographed on the iOS simulator and the Android emulator; see the landing README.
 */
import { Text, View } from '@solidnative/components/solid';
import { useStatusBar } from '@solidnative/device/solid';
import { Icon } from '@solidnative/icons/solid';
import { For } from '@solidnative/platform/solid';
import { lucideSvg, type IconName } from '../icon.data.ts';

const TABS: readonly IconName[] = ['house', 'credit-card', 'chart-pie', 'user'];
const ACTIONS: readonly { label: string; icon: IconName }[] = [
  { label: 'Send', icon: 'arrow-up-right' },
  { label: 'Request', icon: 'arrow-down-left' },
  { label: 'Top up', icon: 'plus' },
  { label: 'More', icon: 'layout-grid' },
];
const WEEK = [
  { name: 'M', spent: 34, today: false },
  { name: 'T', spent: 52, today: false },
  { name: 'W', spent: 28, today: false },
  { name: 'T', spent: 60, today: false },
  { name: 'F', spent: 42, today: false },
  { name: 'S', spent: 64, today: true },
  { name: 'S', spent: 20, today: false },
];

export default function Vault() {
  useStatusBar(() => ({ style: 'light' }));
  return (
    <View class="flex-1 bg-[#09090f] px-5 pt-16">
      <View class="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_15%_0%,rgba(139,92,246,0.55),transparent_60%)]" />
      <View class="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_95%_20%,rgba(244,63,94,0.35),transparent_55%)]" />

      <View class="flex-row items-center justify-between">
        <View class="flex-row items-center gap-3">
          <View class="size-11 items-center justify-center rounded-full bg-linear-to-br from-violet-400 to-rose-400">
            <Text class="font-bold text-white">AL</Text>
          </View>
          <View>
            <Text class="text-xs text-white/50">Welcome back</Text>
            <Text class="text-base font-semibold text-white">Ada Lovelace</Text>
          </View>
        </View>
        <View class="size-11 items-center justify-center rounded-full border border-white/10 bg-white/10">
          <Icon svg={lucideSvg('bell')} size={20} color="#ffffff" />
        </View>
      </View>

      <Text class="mt-7 text-sm text-white/50">Total balance</Text>
      <View class="mt-1 flex-row items-end">
        <Text class="text-[46px] font-bold tracking-tight text-white">£48,210</Text>
        <Text class="mb-2 text-2xl font-semibold text-white/40">.36</Text>
      </View>
      <View class="mt-2 flex-row items-center gap-2">
        <View class="rounded-full bg-emerald-400/15 px-2.5 py-1">
          <Text class="text-xs font-semibold text-emerald-300">▲ 2.4%</Text>
        </View>
        <Text class="text-xs text-white/40">vs last month</Text>
      </View>

      <View class="mt-6">
        <View class="absolute inset-x-5 -top-3 h-48 rounded-[28px] bg-white/10" />
        <View class="h-48 justify-between overflow-hidden rounded-[28px] bg-linear-to-br from-violet-500 via-fuchsia-500 to-orange-400 p-5">
          <View class="absolute -right-10 -bottom-16 size-56 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.35),transparent_65%)]" />
          <View class="flex-row items-center justify-between">
            <Text class="text-lg font-bold tracking-wide text-white">vault</Text>
            <Icon svg={lucideSvg('nfc')} size={22} color="#ffffff" />
          </View>
          <View class="h-8 w-11 rounded-md bg-amber-200/80" />
          <View class="flex-row items-end justify-between">
            <View>
              <Text class="text-xs text-white/70">Ada Lovelace</Text>
              <Text class="mt-1 text-base font-semibold tracking-[3px] text-white">•••• 4821</Text>
            </View>
            <Text class="text-xl font-extrabold text-white italic">VISA</Text>
          </View>
        </View>
      </View>

      <View class="mt-6 flex-row justify-between px-1">
        <For each={ACTIONS}>
          {(action) => (
            <View class="items-center gap-2">
              <View class="size-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.07]">
                <Icon svg={lucideSvg(action.icon)} size={22} color="#ffffff" />
              </View>
              <Text class="text-xs font-medium text-white/60">{action.label}</Text>
            </View>
          )}
        </For>
      </View>

      <View class="mt-5 rounded-[28px] border border-white/10 bg-white/[0.05] px-5 pt-4 pb-3">
        <View class="flex-row items-center justify-between">
          <Text class="text-base font-semibold text-white">Spending</Text>
          <Text class="text-xs text-white/40">This week</Text>
        </View>
        <View class="mt-3 h-[72px] flex-row items-end justify-between">
          <For each={WEEK}>
            {(day) => (
              <View class="items-center gap-2">
                <View
                  class={`w-7 rounded-lg ${day.today ? 'bg-linear-to-t from-fuchsia-500 to-orange-300' : 'bg-white/15'}`}
                  style={{ height: day.spent }}
                />
                <Text class={`text-[11px] ${day.today ? 'text-white' : 'text-white/40'}`}>
                  {day.name}
                </Text>
              </View>
            )}
          </For>
        </View>
      </View>

      <View class="absolute inset-x-12 bottom-7 h-16 flex-row items-center justify-around rounded-full border border-white/10 bg-[#1b1a24]/95">
        <For each={TABS}>
          {(tab, index) => (
            <View
              class={`size-11 items-center justify-center rounded-full ${index() === 0 ? 'bg-white' : ''}`}
            >
              <Icon
                svg={lucideSvg(tab)}
                size={20}
                color={index() === 0 ? '#09090f' : '#ffffff80'}
              />
            </View>
          )}
        </For>
      </View>
    </View>
  );
}

/** A whole screen. */
export const height = 874;
