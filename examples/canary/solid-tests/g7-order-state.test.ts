import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRenderEffect, createRoot, createSignal } from 'solid-js';
import { OrdersBackend, type Order } from '../src/app/orders/orders-api.solid.ts';
import { createOrderState } from '../src/app/orders/order-state.solid.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const order = (id: string, version = 1): Order => ({
  id,
  item: 'Flat white',
  status: 'placed',
  version,
});

test('actual order state ignores old keys and aborts reads on route disposal', async () => {
  const backend = new OrdersBackend();
  const requests: {
    id: string;
    signal?: AbortSignal;
    answer: ReturnType<typeof deferred<Order>>;
  }[] = [];
  backend.order = (id, signal) => {
    const answer = deferred<Order>();
    requests.push({ id, signal, answer });
    return answer.promise;
  };
  let dispose!: () => void;
  const state = createRoot((cleanup) => {
    dispose = cleanup;
    return createOrderState(
      backend,
      () => 'o1',
      () => false,
      100,
    );
  });
  state.next();
  assert.equal(requests[0]!.signal?.aborted, true);
  requests[1]!.answer.resolve(order('o2'));
  await tick();
  requests[0]!.answer.resolve(order('o1'));
  await tick();
  assert.equal(state.value()?.id, 'o2');
  void state.reload();
  dispose();
  assert.equal(requests[2]!.signal?.aborted, true);
  requests[2]!.answer.resolve(order('o2', 8));
  await tick();
  assert.equal(state.value()?.version, 1);
});

test('cancelling an order is locked and invalidates an older in-flight poll', async () => {
  const backend = new OrdersBackend();
  const reads: ReturnType<typeof deferred<Order>>[] = [];
  backend.order = () => {
    const read = deferred<Order>();
    reads.push(read);
    return read.promise;
  };
  const cancellation = deferred<Order>();
  let calls = 0;
  backend.cancel = () => {
    calls++;
    return cancellation.promise;
  };
  let dispose!: () => void;
  const state = createRoot((cleanup) => {
    dispose = cleanup;
    return createOrderState(
      backend,
      () => 'o1',
      () => false,
      100,
    );
  });
  reads[0]!.resolve(order('o1'));
  await tick();
  void state.reload();
  const pending = state.cancel(state.value()!);
  await state.cancel(state.value()!);
  assert.equal(calls, 1);
  cancellation.resolve({ ...order('o1', 2), status: 'cancelled' });
  await pending;
  reads[1]!.resolve(order('o1'));
  await tick();
  assert.equal(state.value()?.status, 'cancelled');
  assert.equal(state.cancelling(), false);
  dispose();
});

test('polling follows both visibility inputs and permanently stops at disposal', async () => {
  const backend = new OrdersBackend();
  backend.latency = 0;
  let dispose!: () => void;
  const [front, setFront] = createSignal(true);
  const [active, setActive] = createSignal(true);
  createRoot((cleanup) => {
    dispose = cleanup;
    return createOrderState(
      backend,
      () => 'o1',
      () => front() && active(),
      5,
    );
  });
  await new Promise((resolve) => setTimeout(resolve, 22));
  assert.ok(backend.requests > 1);
  setFront(false);
  const count = backend.requests;
  await new Promise((resolve) => setTimeout(resolve, 16));
  assert.equal(backend.requests, count);
  setActive(false);
  setFront(true);
  await new Promise((resolve) => setTimeout(resolve, 16));
  assert.equal(backend.requests, count);
  setActive(true);
  await new Promise((resolve) => setTimeout(resolve, 16));
  assert.ok(backend.requests > count);
  dispose();
  const final = backend.requests;
  await new Promise((resolve) => setTimeout(resolve, 16));
  assert.equal(backend.requests, final);
});

test('failed order reads are retryable and already aborted requests do not mutate server state', async () => {
  const backend = new OrdersBackend();
  backend.latency = 0;
  backend.failing = true;
  let dispose!: () => void;
  const state = createRoot((cleanup) => {
    dispose = cleanup;
    return createOrderState(
      backend,
      () => 'o1',
      () => false,
      100,
    );
  });
  await tick();
  assert.ok(state.error());
  assert.equal(state.value(), undefined);
  backend.failing = false;
  await state.reload();
  assert.equal(state.value()?.id, 'o1');
  const controller = new AbortController();
  controller.abort(new Error('left'));
  await assert.rejects(backend.order('o1', controller.signal), /left/);
  dispose();
});

test('a reentrant reload during abort retains ownership of the newest live request', (t) => {
  const backend = new OrdersBackend();
  const signals: AbortSignal[] = [];
  let state!: ReturnType<typeof createOrderState>;
  backend.order = (_id, signal) => {
    signals.push(signal!);
    if (signals.length === 1)
      signal!.addEventListener('abort', () => {
        void state.reload();
      });
    return new Promise<Order>(() => {});
  };
  let dispose!: () => void;
  state = createRoot((stop) => {
    dispose = stop;
    return createOrderState(
      backend,
      () => 'o1',
      () => false,
      100,
    );
  });
  t.after(dispose);
  void state.reload();
  assert.equal(signals.length, 2, 'the newer reload starts one source request');
  dispose();
  assert.equal(
    signals[1]!.aborted,
    true,
    'dispose must abort the request retained by the newer reload',
  );
});

test('disposing during cancelling publication prevents the server mutation', async () => {
  const backend = new OrdersBackend();
  let calls = 0;
  backend.order = async (id) => ({ id, version: 1, item: 'Coffee', status: 'placed' });
  backend.cancel = async (id) => {
    calls++;
    return { id, version: 2, item: 'Coffee', status: 'cancelled' };
  };
  let dispose!: () => void;
  const state = createRoot((stop) => {
    dispose = stop;
    return createOrderState(
      backend,
      () => 'o1',
      () => false,
      100,
    );
  });
  let stopObserver!: () => void;
  createRoot((stop) => {
    stopObserver = stop;
    createRenderEffect(() => {
      if (state.cancelling()) dispose();
    });
  });
  await state.cancel({ id: 'o1', version: 1, item: 'Coffee', status: 'placed' });
  assert.equal(calls, 0);
  stopObserver();
  dispose();
});
