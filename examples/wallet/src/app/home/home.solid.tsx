/** @jsxImportSource @solid-native/platform/solid */
import { createMemo } from 'solid-js';
import { Pressable, SafeAreaView, ScrollView, Text, View } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { SecureStorage } from '@solid-native/expo/solid/store';
import { For } from '@solid-native/platform/solid';
import { useNavigation } from '@solid-native/router/solid';
import { Ledger, money, type Payment } from '../payments/ledger.solid.ts';
import { PaymentRow } from '../payments/payment-row.solid.tsx';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function partOfDay(now: Date): string {
  const hour = now.getHours();
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

/** The last seven days of spending, oldest first, as bars up to 80pt tall. */
export function spendingByDay(payments: readonly Pick<Payment, 'pence' | 'date'>[], today: Date) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i);
    const pence = payments
      .filter((p) => p.pence < 0 && p.date.toDateString() === date.toDateString())
      .reduce((sum, p) => sum - p.pence, 0);
    return { name: WEEKDAYS[date.getDay()]!, pence, today: i === 6 };
  });
  const most = Math.max(1, ...days.map((d) => d.pence));
  return days.map((d) => ({ ...d, height: Math.max(6, Math.round((d.pence / most) * 80)) }));
}

/**
 * The home screen: the balance, a week of spending and the latest payments. Tapping the card
 * hides the balance, and the choice is kept in the keychain for next time.
 */
export function Home() {
  const ledger = useService(Ledger);
  const navigation = useNavigation();
  /** The same signal the settings screen binds, so both stay in step. */
  const hidden = useService(SecureStorage).signal('hide-balance', false);
  const greeting = `Good ${partOfDay(new Date())}`;
  const balance = () => (hidden() ? '£ ••••••' : money(ledger.balance()));
  const recent = createMemo(() => ledger.payments().slice(0, 4));
  const week = createMemo(() => spendingByDay(ledger.payments(), new Date()));
  const spent = () => money(week().reduce((sum, day) => sum + day.pence, 0));
  const open = (id: string) => void navigation.push(`/payment/${id}`);
  return (
    <SafeAreaView class="flex-1 bg-zinc-100 dark:bg-black" edges={['top']}>
      <ScrollView class="flex-1">
        <View class="gap-5 px-5 pt-4 pb-8">
          <View class="flex-row items-center justify-between">
            <View>
              <Text class="text-sm text-zinc-500">{greeting}</Text>
              <Text class="text-2xl font-bold text-zinc-900 dark:text-white">Ada Lovelace</Text>
            </View>
            <View class="size-11 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-700">
              <Text class="font-semibold text-white">AL</Text>
            </View>
          </View>

          <Pressable
            class="rounded-3xl bg-linear-to-br from-zinc-900 via-indigo-950 to-rose-900 p-5 active:opacity-90"
            accessibilityRole="button"
            accessibilityLabel={hidden() ? 'Show balance' : 'Hide balance'}
            onPress={() => hidden.set(!hidden())}
          >
            <View class="flex-row justify-between">
              <Text class="text-sm text-white/60">Total balance</Text>
              <Text class="text-sm font-semibold text-white/60">{hidden() ? 'Show' : 'Hide'}</Text>
            </View>
            <Text class="mt-2 text-4xl font-bold text-white">{balance()}</Text>
            <View class="mt-6 flex-row items-center justify-between">
              <Text class="text-sm tracking-widest text-white/60">•••• 4821</Text>
              <Text class="text-base font-bold text-white italic">VISA</Text>
            </View>
          </Pressable>

          <Pressable
            class="items-center rounded-2xl bg-rose-600 p-4 active:bg-rose-700"
            accessibilityRole="button"
            onPress={() => void navigation.present('/send')}
          >
            <Text class="text-base font-semibold text-white">Send money</Text>
          </Pressable>

          <View class="rounded-3xl bg-white p-5 dark:bg-zinc-900">
            <Text class="text-sm text-zinc-500">Spent this week</Text>
            <Text class="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{spent()}</Text>
            <View class="mt-4 h-24 flex-row items-end justify-between">
              <For each={week()}>
                {(day) => (
                  <View class="items-center gap-1.5">
                    <View
                      class={`w-7 rounded-lg ${day.today ? 'bg-rose-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                      style={{ height: day.height }}
                    />
                    <Text class="text-[10px] text-zinc-400">{day.name}</Text>
                  </View>
                )}
              </For>
            </View>
          </View>

          <View class="flex-row items-center justify-between">
            <Text class="text-base font-bold text-zinc-900 dark:text-white">Recent</Text>
            <Pressable accessibilityRole="link" onPress={() => void navigation.push('/activity')}>
              <Text class="text-sm font-semibold text-rose-600">See all</Text>
            </Pressable>
          </View>
          <For each={recent()}>
            {(payment) => (
              <Pressable
                class="active:opacity-60"
                accessibilityRole="button"
                onPress={() => open(payment.id)}
              >
                <PaymentRow payment={payment} />
              </Pressable>
            )}
          </For>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
