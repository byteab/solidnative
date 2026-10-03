/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Pressable, Text, View, VirtualList } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { Show } from '@solid-native/platform/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  NativeSearchBar,
  NativeStackOutlet,
  useNavigation,
} from '@solid-native/router/solid';
import { Ledger } from '../payments/ledger.solid.ts';
import { PaymentRow } from '../payments/payment-row.solid.tsx';

const ROW_HEIGHT = 68;

/** The activity tab is a stack of its own: the native header its large title and search bar need. */
export function ActivityStack() {
  return <NativeStackOutlet />;
}

/**
 * Every payment, searchable from the navigation bar. The list is virtual: a few hundred rows,
 * and only the ones on screen exist.
 */
export function Activity() {
  const ledger = useService(Ledger);
  const navigation = useNavigation();
  const [query, setQuery] = createSignal('');
  const shown = createMemo(() => {
    const search = query().trim().toLowerCase();
    const payments = ledger.payments();
    if (!search) return payments;
    return payments.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(search));
  });
  return (
    <>
      <NativeHeader title="Activity" largeTitle>
        <NativeHeaderItem type="searchBar">
          <NativeSearchBar
            testID="search"
            placeholder="Search payments"
            query={query()}
            onQueryChange={setQuery}
          />
        </NativeHeaderItem>
      </NativeHeader>
      <VirtualList
        testID="payments"
        class="flex-1 bg-white dark:bg-black"
        contentInsetAdjustmentBehavior="automatic"
        items={shown()}
        itemHeight={ROW_HEIGHT}
        keyExtractor={(payment) => payment.id}
        renderItem={(payment) => (
          <Pressable
            class="justify-center px-5 active:bg-zinc-100 dark:active:bg-zinc-900"
            accessibilityRole="button"
            style={{ height: ROW_HEIGHT }}
            onPress={() => void navigation.push(`/payment/${payment().id}`)}
          >
            <PaymentRow payment={payment()} />
          </Pressable>
        )}
      />
      <Show when={!shown().length}>
        <View class="absolute inset-x-0 top-1/3 items-center">
          <Text class="text-zinc-500">{`No payments match "${query()}"`}</Text>
        </View>
      </Show>
    </>
  );
}
