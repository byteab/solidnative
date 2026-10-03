/** @jsxImportSource @solidnative/platform/solid */
import { View, Text, ScrollView } from '@solidnative/components/solid';
import { NativeHeader } from '@solidnative/router/solid';
import { page } from '../screen-styles.ts';

export function TailwindPage() {
  return (
    <>
      <NativeHeader title="Tailwind" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <View class="flex-row flex-wrap items-center gap-5 p-2">
          <View class="size-10 rounded-md bg-white ring-2 ring-blue-500"></View>
          <View class="size-10 rounded-md bg-white text-green-600 ring-4"></View>
          <View class="bg-zinc-800 p-2">
            <View class="size-8 rounded-md bg-zinc-800 ring-2 ring-blue-500 ring-offset-4 ring-offset-white"></View>
          </View>
          <View class="size-10 rounded-md bg-white ring-4 ring-rose-500 ring-inset"></View>
          <View class="size-10 rounded-md bg-white shadow-lg ring-2 ring-blue-500"></View>
          <View class="size-10 rounded-md bg-white shadow-lg shadow-red-500"></View>
        </View>
        <Text class="hint">
          Rings: a colour, the text colour, an offset, inset, beside a shadow.
        </Text>

        <View class="flex-row items-center gap-4">
          <View class="h-12 w-20 border border-zinc-400">
            <View class="size-6 translate-x-6 translate-y-3 bg-blue-500"></View>
          </View>
          <View class="h-8 w-24 border border-zinc-400">
            <View class="h-8 w-12 translate-x-1/2 bg-green-500"></View>
          </View>
          <View class="size-10 rotate-x-45 ios:skew-x-12 bg-purple-500"></View>
          <View class="size-10 scale-x-50 scale-y-75 bg-amber-500"></View>
        </View>
        <Text class="hint">
          Translate on two axes, by half its width, 3D rotation and iOS skew, scale.
        </Text>

        <View class="flex-row flex-wrap items-start gap-4">
          <View class="flex-row space-x-3 border border-zinc-400">
            <View class="size-6 bg-sky-500"></View>
            <View class="size-6 bg-sky-500"></View>
            <View class="size-6 bg-sky-500"></View>
          </View>
          <View class="flex-row-reverse space-x-3 space-x-reverse border border-zinc-400">
            <View class="size-6 bg-teal-400"></View>
            <View class="size-6 bg-teal-600"></View>
            <View class="size-6 bg-teal-800"></View>
          </View>
          <View class="w-20 divide-y-2 divide-dashed divide-red-500 border border-zinc-400">
            <View class="h-5"></View>
            <View class="h-5"></View>
            <View class="h-5"></View>
          </View>
          <View class="flex-row divide-x-4 divide-blue-500 border border-zinc-400">
            <View class="size-6 bg-amber-200"></View>
            <View class="size-6 bg-amber-200"></View>
          </View>
        </View>
        <Text class="hint">Space and dividers between children, none after the last.</Text>

        <View class="flex-row items-center gap-5">
          <View class="size-10 border-x-4 border-l-2 border-red-500 border-l-blue-500 bg-white"></View>
          <View class="size-10 border-4 border-hidden border-x bg-amber-200"></View>
          <View class="text-shadow-xs text-shadow-red-500">
            <Text class="text-2xl font-bold">Shadow</Text>
          </View>
          <Text class="text-lg tabular-nums oldstyle-nums">1234567890</Text>
        </View>
        <Text class="hint">A side over a pair, no border, an inherited text shadow, figures.</Text>

        <View class="flex-row flex-wrap items-center gap-5 p-2">
          <View class="size-10 bg-blue-500 brightness-50"></View>
          <View class="size-10 bg-blue-500 android:grayscale"></View>
          <View class="size-10 bg-blue-500 android:blur-sm"></View>
          <View class="size-10 bg-white android:drop-shadow-lg android:drop-shadow-red-500"></View>
          <View class="h-10 w-24 bg-linear-to-r from-red-500 via-blue-500 to-green-500"></View>
        </View>
        <Text class="hint">Filters, three of them on Android only, and a gradient.</Text>
      </ScrollView>
    </>
  );
}
