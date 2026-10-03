/** @jsxImportSource @solidnative/platform/solid */
import { createMemo } from 'solid-js';
import { ScrollView, Text, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { For, Show } from '@solidnative/platform/solid';
import { NativeHeader, useRoute } from '@solidnative/router/solid';
import { Ledger, TINTS, dayOf, money } from './ledger.solid.ts';

/** One payment in full. `id` is the route param. */
export function PaymentDetail() {
  const ledger = useService(Ledger);
  const route = useRoute();
  const payment = createMemo(() => ledger.find(String(route.inputs['id'])));
  const facts = createMemo(() => {
    const p = payment();
    if (!p) return [];
    return [
      { label: 'Category', value: p.category },
      { label: 'Date', value: dayOf(p.date) },
      { label: 'Card', value: '•••• 4821' },
      ...(p.note ? [{ label: 'Note', value: p.note }] : []),
    ];
  });
  return (
    <>
      <NativeHeader title={payment()?.name ?? 'Payment'} />
      <ScrollView
        class="flex-1 bg-zinc-100 dark:bg-black"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Show
          when={payment()}
          fallback={<Text class="p-5 text-zinc-500">This payment no longer exists.</Text>}
        >
          {(p) => (
            <>
              <View class="items-center gap-2 px-5 pt-8 pb-6">
                <View
                  class="size-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: TINTS[p().category] ?? '#71717a' }}
                >
                  <Text class="text-2xl font-bold text-white">{p().name[0]}</Text>
                </View>
                <Text class="text-lg font-semibold text-zinc-900 dark:text-white">{p().name}</Text>
                <Text
                  class={`text-4xl font-bold ${p().pence > 0 ? 'text-emerald-600' : 'text-zinc-900 dark:text-white'}`}
                >
                  {money(p().pence, { signed: true })}
                </Text>
              </View>
              <View class="mx-4 rounded-xl bg-white dark:bg-zinc-900">
                <For each={facts()}>
                  {(fact, index) => (
                    <View
                      class={`flex-row justify-between px-4 py-3 ${index() === facts().length - 1 ? '' : 'border-b-hairline border-zinc-200 dark:border-zinc-800'}`}
                    >
                      <Text class="text-zinc-500">{fact.label}</Text>
                      <Text class="text-zinc-900 dark:text-white">{fact.value}</Text>
                    </View>
                  )}
                </For>
              </View>
            </>
          )}
        </Show>
      </ScrollView>
    </>
  );
}
