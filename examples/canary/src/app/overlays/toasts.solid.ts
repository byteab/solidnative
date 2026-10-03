import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { Accessibility, createServiceToken, useService } from '@solidnative/device/solid';

export interface Toasts {
  readonly message: Accessor<string | null>;
  readonly loading: Accessor<boolean>;
  show(message: string, ms?: number): void;
  dismiss(): void;
  while<T>(work: Promise<T>): Promise<T>;
}

/** One app-owned toast and loading cover, including work started by covered screens. */
export function createToasts(announce: (message: string) => void): Toasts {
  const [message, setMessage] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  let revision = 0;
  let pending = 0;
  const cancelTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  onCleanup(() => {
    active = false;
    revision++;
    cancelTimer();
  });
  return {
    message,
    loading,
    show(text, ms = 2500) {
      if (!active) return;
      const request = ++revision;
      cancelTimer();
      setMessage(text);
      if (!active || request !== revision) return;
      timer = setTimeout(() => {
        if (!active || request !== revision) return;
        timer = undefined;
        setMessage(null);
      }, ms);
      announce(text);
    },
    dismiss() {
      if (!active) return;
      revision++;
      cancelTimer();
      setMessage(null);
    },
    async while<T>(work: Promise<T>): Promise<T> {
      if (!active) return work;
      pending++;
      setLoading(true);
      try {
        return await work;
      } finally {
        pending--;
        if (active) setLoading(pending > 0);
      }
    },
  };
}

export const Toasts = createServiceToken<Toasts>('canary.toasts', () => {
  const accessibility = useService(Accessibility);
  return createToasts((message) => accessibility.announce(message));
});
