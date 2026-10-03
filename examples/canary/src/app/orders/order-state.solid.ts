import { batch, createEffect, createSignal, onCleanup, untrack, type Accessor } from 'solid-js';
import type { Order, OrdersApi } from './orders-api.solid.ts';

/** Polls only while visible; a new key, authoritative write or disposal invalidates old reads. */
export function createOrderState(
  api: OrdersApi,
  id: Accessor<string>,
  live: Accessor<boolean>,
  pollMs: number,
) {
  const [shown, setShown] = createSignal(id());
  const [value, setValue] = createSignal<Order>();
  const [error, setError] = createSignal<unknown>();
  const [cancelling, setCancelling] = createSignal(false);
  let request: AbortController | undefined;
  let epoch = 0;
  let active = true;
  const current = (turn: number, key: string) => active && epoch === turn && shown() === key;
  onCleanup(() => {
    active = false;
    ++epoch;
    request?.abort();
  });

  async function reload() {
    if (!active) return;
    const key = shown();
    const turn = ++epoch;
    const previous = request;
    const controller = new AbortController();
    request = controller;
    previous?.abort();
    if (!current(turn, key)) return;
    setError(undefined);
    if (!current(turn, key)) return;
    try {
      const answer = await api.order(key, controller.signal);
      if (current(turn, key)) setValue(answer);
    } catch (problem) {
      if (current(turn, key) && !controller.signal.aborted) setError(problem);
    }
  }
  createEffect(() => {
    const key = id();
    untrack(() => setShown(key));
  });
  createEffect(() => {
    shown();
    untrack(() => {
      setValue(undefined);
      void reload();
    });
  });
  createEffect(() => {
    if (!live()) return;
    const timer = setInterval(() => {
      void reload();
    }, pollMs);
    onCleanup(() => clearInterval(timer));
  });

  async function cancel(order: Order) {
    if (!active || cancelling()) return;
    setCancelling(true);
    if (!active) return;
    try {
      const answer = await api.cancel(order.id);
      if (!active || shown() !== answer.id) return;
      const turn = ++epoch;
      const previous = request;
      request = undefined;
      previous?.abort();
      if (!current(turn, answer.id)) return;
      batch(() => {
        setValue(answer);
        setError(undefined);
      });
    } catch (problem) {
      if (active && shown() === order.id) setError(problem);
    } finally {
      if (active) setCancelling(false);
    }
  }
  return {
    shown,
    value,
    error,
    cancelling,
    reload,
    cancel,
    next() {
      if (!active) return;
      const ids = api.ids();
      setShown(ids[(ids.indexOf(shown()) + 1) % ids.length]!);
    },
  };
}
