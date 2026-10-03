import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { callerCleanup, mutationQueue, silence, sourcedService } from './owned.ts';
export interface NativeBrightness {
  get(): Promise<number>;
  set(level: number): Promise<void>;
  restore(): Promise<void>;
}
export interface Brightness {
  readonly level: Accessor<number>;
  readonly error: Accessor<Error | null>;
  set(level: number): () => void;
  restore(): void;
}
export const Brightness = sourcedService<Brightness, NativeBrightness | null>(
  'expo.brightness',
  () => {
    const expo = expoModule(
      'expo-brightness',
      () => require('expo-brightness') as typeof import('expo-brightness'),
    );
    return expo
      ? {
          get: () => expo.getBrightnessAsync(),
          set: (level) => expo.setBrightnessAsync(level),
          restore: () => expo.restoreSystemBrightnessAsync(),
        }
      : null;
  },
  (native) => {
    let active = true;
    let revision = 0;
    const [level, setLevel] = createSignal(1);
    const queue = mutationQueue(() => active);
    const claims: { level: number }[] = [];
    const read = (request: number) =>
      silence(async () => {
        if (!active || request !== revision) return;
        const value = await native?.get();
        if (active && request === revision && value !== undefined) setLevel(value);
      });
    const restore = () => {
      const request = ++revision;
      claims.length = 0;
      void queue.run(async () => {
        await native?.restore();
        read(request);
      });
    };
    onCleanup(() => {
      active = false;
      if (claims.length) restore();
    });
    read(revision);
    const apply = (value: number) => {
      const request = ++revision;
      // Enqueue before signal publication so a reentrant newer claim is ordered after this one.
      void queue.run(() => {
        if (active && request === revision) return native?.set(value);
        return undefined;
      });
      setLevel(value);
    };
    return {
      level,
      error: queue.error,
      set(value) {
        if (!active) return () => {};
        const claim = { level: Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1 };
        const release = () => {
          const index = claims.indexOf(claim);
          if (index < 0) return;
          claims.splice(index, 1);
          if (index < claims.length) return;
          const below = claims.at(-1);
          if (below && active) apply(below.level);
          else restore();
        };
        claims.push(claim);
        callerCleanup(release);
        apply(claim.level);
        return release;
      },
      restore: () => {
        if (active) restore();
      },
    };
  },
);
