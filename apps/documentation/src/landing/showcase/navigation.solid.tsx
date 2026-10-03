/** @jsxImportSource @solidnative/platform/solid */
/*
 * The navigation showcase: @solidnative/router/solid, a native stack, and a native header with a
 * large title. Each trip is a postcard drawn with gradients; pressing one pushes its itinerary with
 * the platform's own transition and back button. Photographed on the iOS simulator for the landing
 * page; it is not mounted on the page, because the router is native-only - see
 * `packages/web/limits`.
 */
import { createMemo } from 'solid-js';
import { Pressable, SafeAreaProvider, ScrollView, Text, View } from '@solidnative/components/solid';
import { For, Show } from '@solidnative/platform/solid';
import {
  NativeHeader,
  NativeStackOutlet,
  createNativeNavigation,
  useNavigation,
  useRoute,
  type NativeRoute,
} from '@solidnative/router/solid';

const TRIPS = [
  {
    id: 'lisbon',
    city: 'Lisbon',
    country: 'Portugal',
    dates: '4 - 9 Oct',
    weather: '24°',
    card: 'from-orange-400 via-rose-500 to-fuchsia-700',
    plan: ['Tram 28 at dawn', 'Pastéis in Belém', 'Sunset at Miradouro'],
    flight: 'TP 1363 · 07:40',
    stay: 'Memmo Alfama · 5 nights',
  },
  {
    id: 'kyoto',
    city: 'Kyoto',
    country: 'Japan',
    dates: '12 - 26 Nov',
    weather: '16°',
    card: 'from-red-500 via-orange-500 to-amber-300',
    plan: ['Fushimi Inari, before six', 'Maples in Tofuku-ji', 'Kaiseki in Gion'],
    flight: 'JL 44 · 11:25',
    stay: 'Hoshinoya · 14 nights',
  },
  {
    id: 'oslo',
    city: 'Oslo',
    country: 'Norway',
    dates: '3 - 7 Jan',
    weather: '-4°',
    card: 'from-indigo-600 via-sky-500 to-cyan-300',
    plan: ['The opera house roof', 'Sauna on the fjord', 'Northern lights, maybe'],
    flight: 'SK 806 · 09:10',
    stay: 'The Thief · 4 nights',
  },
  {
    id: 'reykjavik',
    city: 'Reykjavík',
    country: 'Iceland',
    dates: '18 - 22 Feb',
    weather: '1°',
    card: 'from-emerald-400 via-teal-600 to-indigo-800',
    plan: ['The Blue Lagoon', 'Golden Circle by car', 'Aurora from Grótta'],
    flight: 'FI 451 · 13:05',
    stay: 'Reykjavík Edition · 4 nights',
  },
];

function Trips() {
  const navigation = useNavigation();
  return (
    <>
      <NativeHeader title="Trips" largeTitle />
      <ScrollView
        class="flex-1 bg-zinc-100 dark:bg-black"
        contentContainerStyle={{ gap: 16, padding: 16 }}
      >
        <For each={TRIPS}>
          {(trip) => (
            <Pressable
              accessibilityRole="link"
              class={`h-44 justify-between overflow-hidden rounded-[28px] bg-linear-to-br p-5 ${trip.card}`}
              onPress={() => void navigation.push(`/trip/${trip.id}`)}
            >
              <View class="flex-row justify-between">
                <Text class="text-sm font-semibold tracking-[2px] text-white/80 uppercase">
                  {trip.country}
                </Text>
                <View class="rounded-full bg-white/25 px-3 py-1">
                  <Text class="text-xs font-bold text-white">{trip.weather}</Text>
                </View>
              </View>
              <View>
                <Text class="text-4xl font-extrabold tracking-tight text-white">{trip.city}</Text>
                <Text class="mt-1 font-medium text-white/85">{trip.dates}</Text>
              </View>
            </Pressable>
          )}
        </For>
      </ScrollView>
    </>
  );
}

/** One trip. `id` is the route param. */
function Trip() {
  const route = useRoute();
  const trip = createMemo(() => TRIPS.find((trip) => trip.id === route.inputs['id'])!);
  const bookings = createMemo(() => [
    { label: 'FLIGHT', value: trip().flight },
    { label: 'STAY', value: trip().stay },
  ]);
  return (
    <>
      <NativeHeader title={trip().city} />
      <View class="flex-1 bg-zinc-100 p-4 dark:bg-black">
        <View class={`h-40 justify-end rounded-[28px] bg-linear-to-br p-5 ${trip().card}`}>
          <Text class="text-3xl font-extrabold text-white">{trip().country}</Text>
          <Text class="mt-1 text-sm font-semibold text-white/85">
            {trip().dates} · {trip().weather}
          </Text>
        </View>
        <Text class="mt-6 px-1 text-xs font-semibold tracking-[2px] text-zinc-500">ITINERARY</Text>
        <View class="mt-3 rounded-[24px] bg-white p-5 dark:bg-zinc-900">
          <For each={trip().plan}>
            {(stop, index) => (
              <View class="flex-row gap-4">
                <View class="items-center">
                  <View
                    class={`size-3 rounded-full ${index() === 0 ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                  />
                  <Show when={index() < trip().plan.length - 1}>
                    <View class="w-0.5 flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  </Show>
                </View>
                <View class="-mt-1 pb-5">
                  <Text class="text-xs text-zinc-500">Day {index() + 1}</Text>
                  <Text class="text-base font-semibold text-zinc-950 dark:text-white">{stop}</Text>
                </View>
              </View>
            )}
          </For>
        </View>
        <View class="mt-3 flex-row gap-3">
          <For each={bookings()}>
            {(booking) => (
              <View class="flex-1 rounded-[24px] bg-white p-4 dark:bg-zinc-900">
                <Text class="text-xs font-semibold tracking-[1.5px] text-rose-500">
                  {booking.label}
                </Text>
                <Text class="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                  {booking.value}
                </Text>
              </View>
            )}
          </For>
        </View>
      </View>
    </>
  );
}

// excerpt: tsx
export const routes: readonly NativeRoute[] = [
  { path: '', component: Trips },
  { path: 'trip/:id', component: Trip },
];

/** The app: a native stack, with the platform's header and back gesture. */
export function App() {
  const navigation = createNativeNavigation(routes);
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <NativeStackOutlet navigation={navigation} />
    </SafeAreaProvider>
  );
}
// excerpt end
