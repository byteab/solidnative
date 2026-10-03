/** @jsxImportSource @solid-native/platform/solid */
import { Show } from '@solid-native/platform/solid';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from '@solid-native/components/solid';
import { AppState, SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { NativeHeader, useNavigation, useRoute } from '@solid-native/router/solid';
import { OrdersApi, ORDER_POLL_MS } from './orders-api.solid.ts';
import { createOrderState } from './order-state.solid.ts';

export function OrderPage() {
  const route = useRoute();
  const navigation = useNavigation();
  const inFront = useService(SCREEN_IN_FRONT);
  const app = useService(AppState);
  const order = createOrderState(
    useService(OrdersApi),
    () => String(route.inputs['id']),
    () => inFront() && app.active(),
    useService(ORDER_POLL_MS),
  );
  return (
    <>
      <NativeHeader title={`Order ${order.shown()}`} />
      <ScrollView class="screen" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Show
          when={order.value()}
          fallback={
            <Show
              when={order.error()}
              fallback={
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <ActivityIndicator />
                </View>
              }
            >
              <Text class="body danger">The order could not be loaded.</Text>
              <Pressable
                class="button"
                accessibilityRole="button"
                onPress={() => {
                  void order.reload();
                }}
              >
                <Text class="button-label">Try again</Text>
              </Pressable>
            </Show>
          }
        >
          {(current) => (
            <>
              <Text class="heading">{current().item}</Text>
              <Text class="body" accessibilityRole="summary">
                Status: {current().status}
              </Text>
              <Text class="hint">
                Order {current().id}, version {current().version}
              </Text>
              <Show when={current().status !== 'cancelled' && current().status !== 'delivered'}>
                <Pressable
                  class="button"
                  accessibilityRole="button"
                  disabled={order.cancelling()}
                  accessibilityState={{ disabled: order.cancelling(), busy: order.cancelling() }}
                  onPress={() => {
                    void order.cancel(current());
                  }}
                >
                  <Text class="button-label">
                    {order.cancelling() ? 'Cancelling' : 'Cancel order'}
                  </Text>
                </Pressable>
              </Show>
            </>
          )}
        </Show>
        <Pressable class="card" accessibilityRole="button" onPress={order.next}>
          <Text class="button-label">Next order</Text>
        </Pressable>
        <Pressable
          class="card"
          accessibilityRole="button"
          onPress={() => {
            void navigation.push('/orders');
          }}
        >
          <Text class="button-label">All orders</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
