/** @jsxImportSource @solidnative/platform/solid */
import { Text, View } from '@solidnative/components/solid';
import { TINTS, dayOf, money, type Payment } from './ledger.solid.ts';

/** One payment: who, what kind and when, and how much. */
export function PaymentRow(props: { payment: Payment }) {
  return (
    <View class="flex-row items-center gap-3">
      <View
        class="size-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: TINTS[props.payment.category] ?? '#71717a' }}
      >
        <Text class="font-bold text-white">{props.payment.name[0]}</Text>
      </View>
      <View class="flex-1">
        <Text class="font-semibold text-zinc-900 dark:text-white">{props.payment.name}</Text>
        <Text class="text-xs text-zinc-500 dark:text-zinc-400">
          {`${props.payment.category} · ${dayOf(props.payment.date)}`}
        </Text>
      </View>
      <Text
        class={`font-semibold ${props.payment.pence > 0 ? 'text-emerald-600' : 'text-zinc-900 dark:text-white'}`}
      >
        {money(props.payment.pence, { signed: true })}
      </Text>
    </View>
  );
}
