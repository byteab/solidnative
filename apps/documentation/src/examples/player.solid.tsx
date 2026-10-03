/*
 * @jsxImportSource @solidnative/platform/solid
 *
 * One of the landing page's three hero apps: a music player. The album art is drawn, not loaded -
 * a sunset of gradients cut by bars - and the scrubber and controls are plain views and native
 * SVG icons. Photographed on the iOS simulator and the Android emulator; see the landing README.
 */
import { Text, View } from '@solidnative/components/solid';
import { useStatusBar } from '@solidnative/device/solid';
import { Icon } from '@solidnative/icons/solid';
import { For } from '@solidnative/platform/solid';
import { lucideSvg } from '../icon.data.ts';

/** The bars that cut the sun, thickening towards the horizon. */
const BANDS = [
  { top: 45, height: 3 },
  { top: 50, height: 5 },
  { top: 55, height: 7 },
];
/** The floor's horizontal lines, closer together towards the horizon. */
const GRID = [4, 12, 21, 29, 35];

export default function Player() {
  useStatusBar(() => ({ style: 'light' }));
  return (
    <View class="flex-1 bg-linear-to-b from-[#4a0d33] via-[#1d0b33] to-[#08070d] px-6 pt-16">
      <View class="absolute inset-x-0 top-24 h-[480px] bg-[radial-gradient(circle_at_50%_45%,rgba(255,102,64,0.45),transparent_62%)]" />

      <View class="flex-row items-center justify-between">
        <Icon svg={lucideSvg('chevron-down')} size={26} color="#ffffff" />
        <View class="items-center">
          <Text class="text-[10px] font-semibold tracking-[2px] text-white/50">PLAYING FROM</Text>
          <Text class="text-sm font-semibold text-white">Late Night Drive</Text>
        </View>
        <Icon svg={lucideSvg('ellipsis')} size={24} color="#ffffff" />
      </View>

      <View class="mt-6 aspect-square w-full overflow-hidden rounded-[32px] bg-linear-to-b from-[#ff7a45] via-[#e6397a] to-[#3a1c71] shadow-2xl shadow-rose-500/50">
        <View class="absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(circle_at_50%_100%,rgba(255,214,120,0.55),transparent_70%)]" />
        <View class="absolute top-[22%] left-1/2 -ml-[92px] size-[184px] rounded-full bg-linear-to-b from-[#ffe08a] via-[#ff9a5a] to-[#ff4f8b]" />
        <For each={BANDS}>
          {(band) => (
            <View
              class="absolute inset-x-0 bg-[#c2336f]"
              style={{ top: `${band.top}%`, height: band.height }}
            />
          )}
        </For>
        <View class="absolute inset-x-0 bottom-0 h-[38%] bg-linear-to-b from-[#3a1c71] to-[#170a33]" />
        <For each={GRID}>
          {(line) => (
            <View class="absolute inset-x-0 h-px bg-[#ff5fa2]/50" style={{ bottom: `${line}%` }} />
          )}
        </For>
      </View>

      <View class="mt-6 flex-row items-center justify-between">
        <View>
          <Text class="text-2xl font-bold text-white">Midnight Signals</Text>
          <Text class="mt-1 text-base text-white/60">Lumen Park</Text>
        </View>
        <Icon svg={lucideSvg('heart')} size={26} color="#fb7185" />
      </View>

      <View class="mt-6">
        <View class="h-1 rounded-full bg-white/15">
          <View class="h-1 w-[42%] rounded-full bg-white" />
        </View>
        <View class="absolute top-[-4px] left-[42%] -ml-1.5 size-3 rounded-full bg-white" />
        <View class="mt-2 flex-row justify-between">
          <Text class="text-xs text-white/50">1:42</Text>
          <Text class="text-xs text-white/50">-2:16</Text>
        </View>
      </View>

      <View class="mt-5 flex-row items-center justify-between">
        <Icon svg={lucideSvg('shuffle')} size={22} color="#ffffff99" />
        <Icon svg={lucideSvg('skip-back')} size={30} color="#ffffff" />
        <View class="size-20 items-center justify-center rounded-full bg-white">
          <Icon svg={lucideSvg('pause')} size={32} color="#14081f" />
        </View>
        <Icon svg={lucideSvg('skip-forward')} size={30} color="#ffffff" />
        <Icon svg={lucideSvg('repeat')} size={22} color="#ffffff99" />
      </View>

      <View class="mt-5 flex-row items-center justify-between">
        <View class="flex-row items-center gap-2">
          <Icon svg={lucideSvg('headphones')} size={16} color="#fda4af" />
          <Text class="text-xs font-semibold text-rose-300">AirPods Pro</Text>
        </View>
        <Icon svg={lucideSvg('list-music')} size={18} color="#ffffff99" />
      </View>

      <View class="mt-4 rounded-3xl bg-white/[0.07] px-5 py-4">
        <Text class="text-[10px] font-semibold tracking-[2px] text-white/50">LYRICS</Text>
        <Text class="mt-1.5 text-lg leading-6 font-bold text-white">
          And the city hums in neon,
        </Text>
        <Text class="text-lg leading-6 font-bold text-white/35">every light a call sign</Text>
      </View>
    </View>
  );
}

/** A whole screen. */
export const height = 874;
