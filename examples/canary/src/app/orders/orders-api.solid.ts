import { createServiceToken } from '@solid-native/device/solid';

export type OrderStatus = 'placed' | 'preparing' | 'on its way' | 'delivered' | 'cancelled';

export interface Order {
  readonly id: string;
  readonly item: string;
  readonly status: OrderStatus;
  /** Bumped by every change on the server, so an older answer can be told from a newer one. */
  readonly version: number;
}

const STEPS: readonly OrderStatus[] = ['placed', 'preparing', 'on its way', 'delivered'];
const ITEMS = ['Flat white', 'Croissant', 'Banana bread', 'Oat latte', 'Pain au chocolat'];

/** How often an order on screen asks the server again, in milliseconds. */
export const ORDER_POLL_MS = createServiceToken<number>('canary.orderPollMs', () => 2000);

/**
 * The server, simulated: every answer takes a while, some take much longer than others, and an
 * order moves on a step every few requests, so a poll sees it change.
 */
export class OrdersBackend {
  latency = 400;
  /** Extra time for particular orders, to make an answer arrive after a later one. */
  readonly slow = new Map<string, number>();
  failing = false;
  requests = 0;
  aborted = 0;
  cancels = 0;
  private readonly orders = new Map<string, Order>(
    Array.from({ length: 20 }, (_, i) => [
      `o${i + 1}`,
      { id: `o${i + 1}`, item: ITEMS[i % ITEMS.length]!, status: 'placed', version: 1 },
    ]),
  );
  private asked = new Map<string, number>();

  ids(): string[] {
    return [...this.orders.keys()];
  }

  order(id: string, signal?: AbortSignal): Promise<Order> {
    this.requests++;
    return this.respond(signal, (this.slow.get(id) ?? 0) + this.latency, () => {
      const asked = (this.asked.get(id) ?? 0) + 1;
      this.asked.set(id, asked);
      const order = this.orders.get(id)!;
      // Every third request moves the order on a step, until it arrives or is cancelled.
      if (asked % 3 === 0 && order.status !== 'cancelled' && order.status !== 'delivered') {
        this.put({ ...order, status: STEPS[STEPS.indexOf(order.status) + 1]! });
      }
      return this.orders.get(id)!;
    });
  }

  cancel(id: string): Promise<Order> {
    this.cancels++;
    return this.respond(undefined, this.latency, () => {
      this.put({ ...this.orders.get(id)!, status: 'cancelled' });
      return this.orders.get(id)!;
    });
  }

  private put(order: Order): void {
    this.orders.set(order.id, { ...order, version: order.version + 1 });
  }

  /**
   * The server answers when the request reaches it, and the answer takes `ms` to come back, so a
   * slow answer says what was true when it was asked, not when it arrives.
   */
  private respond<T>(signal: AbortSignal | undefined, ms: number, answer: () => T): Promise<T> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    const fail = this.failing;
    const value = fail ? undefined : answer();
    return new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        this.aborted++;
        reject(signal?.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        if (fail) reject(new Error('offline'));
        else resolve(value!);
      }, ms);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
}

export type OrdersApi = OrdersBackend;
export const OrdersApi = createServiceToken<OrdersApi>('canary.orders', () => new OrdersBackend());
