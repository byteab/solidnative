import { createMemo, createSignal, onCleanup, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';
export interface NativeStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  getSync?(key: string): string | null;
}
export interface StoredSignal<T> extends Accessor<T> {
  set(value: T): void;
  update(update: (current: T) => T): void;
}
interface Binding {
  value: StoredSignal<unknown>;
  reset(value: unknown): void;
  initial: unknown;
  waiting: ((value: unknown) => unknown)[] | null;
}
const ABSENT = Symbol('absent');
const REMOVE = Symbol('remove');
function decode(raw: string | null): unknown {
  if (raw === null) return ABSENT;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return ABSENT;
  }
}

/** One binding per key, serialized persistence, and service-owned hydration. */
export class Store {
  private readonly native: NativeStore | null;
  private readonly requests = ownedRequests();
  private active = true;
  private readonly bindings = new Map<string, Binding>();
  private readonly revisions = new Map<string, number>();
  private readonly reads = createSignal(0);
  private readonly failure = createSignal<Error | null>(null);
  private readonly writes = new Set<Promise<void>>();
  private tail = Promise.resolve();
  private unreported: { error: unknown } | null = null;
  readonly ready: Accessor<boolean> = createMemo(() => this.reads[0]() === 0);
  readonly error = this.failure[0];
  constructor(native: NativeStore | null) {
    this.native = native;
    onCleanup(() => {
      this.active = false;
    });
  }
  signal<T>(key: string, initial: T): StoredSignal<T> {
    const existing = this.bindings.get(key);
    if (existing) return existing.value as StoredSignal<T>;
    if (!this.active) throw new Error('Store has been disposed.');
    const [read, reset] = createSignal<unknown>(initial);
    const binding: Binding = {
      value: read as StoredSignal<unknown>,
      reset: (value) => reset(() => value),
      initial,
      waiting: this.native && !this.native.getSync && !this.revisions.has(key) ? [] : null,
    };
    this.bindings.set(key, binding);
    binding.value.set = (value) => this.replace(key, binding, value);
    binding.value.update = (update) => {
      if (!this.active) return;
      const revision = this.revisions.get(key) ?? 0;
      const value = update(read());
      if (!this.current(key, revision)) return;
      if (binding.waiting) {
        binding.waiting.push(update);
        binding.reset(value);
      } else this.replace(key, binding, value);
    };
    // Install the binding before calling user/native code, which may synchronously reenter.
    const revision = this.revisions.get(key) ?? 0;
    this.readSync(key, binding, revision);
    if (this.active) this.hydrate(key, binding, revision);
    return binding.value as StoredSignal<T>;
  }
  private current(key: string, revision: number): boolean {
    return this.active && revision === (this.revisions.get(key) ?? 0);
  }
  private readSync(key: string, binding: Binding, revision: number): void {
    if (this.native?.getSync && revision === 0) {
      try {
        const stored = decode(this.native.getSync(key));
        if (this.active && revision === (this.revisions.get(key) ?? 0) && stored !== ABSENT)
          binding.reset(stored);
      } catch (error) {
        this.fail(error);
      }
    }
  }
  private replace(key: string, binding: Binding, value: unknown): void {
    if (!this.active) return;
    binding.waiting = null;
    const revision = this.bump(key);
    this.enqueue(key, revision, value);
    binding.reset(value);
  }
  remove(key: string): Promise<void> {
    if (!this.active) return Promise.resolve();
    const binding = this.bindings.get(key);
    if (binding) binding.waiting = null;
    const write = this.enqueue(key, this.bump(key), REMOVE);
    binding?.reset(binding.initial);
    return this.requests.run(undefined, () => write);
  }
  flush(): Promise<void> {
    const sent = [...this.writes];
    return this.requests.run(undefined, async () => {
      await Promise.allSettled(sent);
      const failed = this.unreported;
      this.unreported = null;
      if (failed) throw failed.error;
    });
  }
  private hydrate(key: string, binding: Binding, revision: number): void {
    this.reads[1]((n) => n + 1);
    if (!this.active) return;
    let answer: Promise<string | null>;
    try {
      answer = this.native?.get(key) ?? Promise.resolve(null);
    } catch (error) {
      answer = Promise.reject(error);
    }
    void answer
      .then(
        (raw) => decode(raw),
        (error) => {
          this.fail(error);
          return ABSENT;
        },
      )
      .then((stored) => {
        if (!this.active) return;
        try {
          if (revision !== 0 || !this.current(key, revision)) return;
          const updates = binding.waiting;
          binding.waiting = null;
          let value = stored === ABSENT ? binding.initial : stored;
          if (updates?.length) {
            for (const update of updates) {
              value = update(value);
              if (!this.current(key, revision)) return;
            }
            this.replace(key, binding, value);
          } else if (stored !== ABSENT) binding.reset(value);
        } catch (error) {
          this.fail(error);
        } finally {
          if (this.active) this.reads[1]((n) => n - 1);
        }
      });
  }
  private bump(key: string): number {
    const revision = (this.revisions.get(key) ?? 0) + 1;
    this.revisions.set(key, revision);
    return revision;
  }
  private enqueue(key: string, revision: number, value: unknown): Promise<void> {
    const current = () => this.active && revision === this.revisions.get(key);
    const write = this.tail
      .then(async () => {
        if (!current()) return;
        const encoded = value === REMOVE || value === undefined ? undefined : JSON.stringify(value);
        if (!current()) return;
        if (encoded === undefined) await this.native?.remove(key);
        else await this.native?.set(key, encoded);
      })
      .catch((error) => {
        if (this.active) {
          this.unreported ??= { error };
          this.fail(error);
        }
        throw error;
      });
    this.tail = write.catch(() => {});
    this.writes.add(write);
    void write.then(
      () => this.writes.delete(write),
      () => this.writes.delete(write),
    );
    return write;
  }
  private fail(error: unknown): void {
    if (this.active) this.failure[1](error instanceof Error ? error : new Error(String(error)));
  }
}
const plain = (): NativeStore | null => {
  const module = expoModule(
    '@react-native-async-storage/async-storage',
    () =>
      require('@react-native-async-storage/async-storage') as {
        default: typeof import('@react-native-async-storage/async-storage').default;
      },
  );
  const store = module?.default;
  return store
    ? {
        get: (key) => store.getItem(key),
        set: (key, value) => store.setItem(key, value),
        remove: (key) => store.removeItem(key),
      }
    : null;
};
const secure = (): NativeStore | null => {
  const expo = expoModule(
    'expo-secure-store',
    () => require('expo-secure-store') as typeof import('expo-secure-store'),
  );
  return expo
    ? {
        get: (key) => expo.getItemAsync(key),
        set: (key, value) => expo.setItemAsync(key, value),
        remove: (key) => expo.deleteItemAsync(key),
        getSync: (key) => expo.getItem(key),
      }
    : null;
};
export const Storage = sourcedService<Store, NativeStore | null>(
  'expo.storage',
  plain,
  (native) => new Store(native),
);
export type Storage = Store;
export const SecureStorage = sourcedService<Store, NativeStore | null>(
  'expo.secureStorage',
  secure,
  (native) => new Store(native),
);
export type SecureStorage = Store;
