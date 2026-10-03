import { createMemo, createSignal, onCleanup, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { callerCleanup, mutationQueue, sourcedService } from './owned.ts';
export interface NativeKeepAwake {
  activate(tag: string): Promise<void>;
  deactivate(tag: string): Promise<void>;
}
export interface KeepAwake {
  readonly holders: Accessor<ReadonlySet<string>>;
  readonly active: Accessor<boolean>;
  readonly error: Accessor<Error | null>;
  hold(tag?: string): () => void;
}
export const KeepAwake = sourcedService<KeepAwake, NativeKeepAwake | null>(
  'expo.keepAwake',
  () => {
    const expo = expoModule(
      'expo-keep-awake',
      () => require('expo-keep-awake') as typeof import('expo-keep-awake'),
    );
    return expo
      ? {
          activate: (tag) => expo.activateKeepAwakeAsync(tag),
          deactivate: (tag) => expo.deactivateKeepAwake(tag),
        }
      : null;
  },
  (native) => {
    let alive = true;
    const queue = mutationQueue(() => alive);
    const counts = new Map<string, number>();
    const [holders, setHolders] = createSignal<ReadonlySet<string>>(new Set());
    const publish = () => setHolders(new Set(counts.keys()));
    onCleanup(() => {
      alive = false;
      const tags = [...counts.keys()];
      counts.clear();
      for (const tag of tags) void queue.run(() => native?.deactivate(tag));
    });
    return {
      holders,
      active: createMemo(() => holders().size > 0),
      error: queue.error,
      hold(tag = 'solidnative') {
        if (!alive) return () => {};
        let held = true;
        const release = () => {
          if (!held) return;
          held = false;
          if (!alive) return;
          const count = counts.get(tag) ?? 0;
          if (count > 1) counts.set(tag, count - 1);
          else {
            counts.delete(tag);
            void queue.run(() => native?.deactivate(tag));
            publish();
          }
        };
        callerCleanup(release);
        const count = counts.get(tag) ?? 0;
        counts.set(tag, count + 1);
        if (!count) {
          void queue.run(() => {
            if (alive && counts.has(tag)) return native?.activate(tag);
            return undefined;
          });
          publish();
        }
        return release;
      },
    };
  },
);
