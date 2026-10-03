import { createSignal, onCleanup } from 'solid-js';
import { createServiceToken } from '@solidnative/device/solid';

/** Shared by the retained profile screen and the native tab bar, scoped to this app. */
export const Unread = createServiceToken('CanaryUnread', () => {
  const [count, setCount] = createSignal(2);
  let active = true;
  onCleanup(() => {
    active = false;
  });
  return {
    count,
    add() {
      if (active) setCount((value) => value + 1);
    },
    clear() {
      if (active) setCount(0);
    },
  };
});
