/** @jsxImportSource @solid-native/platform/solid */
import { For } from '@solid-native/platform/solid';
import { Pressable, ScrollView, Text } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { NativeHeader, useNavigation } from '@solid-native/router/solid';
import { OrdersApi } from './orders-api.solid.ts';

export function OrdersPage() {
  const navigation = useNavigation();
  const ids = useService(OrdersApi).ids();
  return (
    <>
      <NativeHeader title="Orders" />
      <ScrollView class="screen" contentContainerStyle={{ padding: 16, gap: 8 }}>
        <For each={ids}>
          {(id) => (
            <Pressable
              class="card"
              accessibilityRole="button"
              onPress={() => {
                void navigation.push(`/orders/${id}`);
              }}
            >
              <Text class="body">Order {id}</Text>
            </Pressable>
          )}
        </For>
      </ScrollView>
    </>
  );
}
