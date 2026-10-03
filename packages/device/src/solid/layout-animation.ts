import { reactNative } from '../react-native.ts';
import { createRequests } from './requests.ts';
import { createServiceToken, useService } from './service-scope.ts';

export type LayoutEasing =
  'spring' | 'linear' | 'easeInEaseOut' | 'easeIn' | 'easeOut' | 'keyboard';

export interface LayoutChange {
  readonly duration?: number;
  readonly easing?: LayoutEasing;
  readonly appear?: 'opacity' | 'scaleXY' | 'none';
  readonly leave?: 'opacity' | 'scaleXY' | 'none';
}

export interface NativeLayoutAnimation {
  configureNext(config: object, onDone?: () => void, onFail?: () => void): void;
}

export interface LayoutAnimation {
  animate(change: () => void, options?: LayoutChange): Promise<void>;
}

const SOURCE = createServiceToken<NativeLayoutAnimation | null>(
  'native.layoutAnimationSource',
  () => reactNative()?.LayoutAnimation ?? null,
);
export const LayoutAnimation = Object.freeze({
  ...createServiceToken<LayoutAnimation>('native.layoutAnimation', () => {
    const native = useService(SOURCE);
    const requests = createRequests();
    return {
      animate: (change, options = {}) =>
        requests.run<void>(undefined, (resolve, reject, active) => {
          if (!native) {
            change();
            return resolve();
          }
          let changed = false;
          let outcome: { error?: unknown } | undefined;
          const complete = (result: { error?: unknown }) => {
            outcome ??= result;
            if (changed) {
              if ('error' in outcome) reject(outcome.error);
              else resolve();
            }
          };
          try {
            native.configureNext(
              config(options),
              () => complete({}),
              () => complete({ error: new Error('Native layout animation failed.') }),
            );
          } catch (error) {
            complete({ error });
          }
          if (!active()) return;
          change();
          changed = true;
          // Configuration errors reject the wait, but must not discard the application change.
          if (outcome) return complete(outcome);
          if (!active()) return;
          // Disabled/native implementations need not call back. Always bound the wait.
          const timer = setTimeout(() => resolve(), (options.duration ?? 300) + 50);
          return () => clearTimeout(timer);
        }),
    };
  }),
  SOURCE,
});

function config(options: LayoutChange): object {
  const easing = options.easing ?? 'easeInEaseOut';
  const appear = options.appear ?? 'opacity';
  const leave = options.leave ?? 'opacity';
  return {
    duration: options.duration ?? 300,
    update: { type: easing, ...(easing === 'spring' ? { springDamping: 0.7 } : {}) },
    ...(appear === 'none' ? {} : { create: { type: easing, property: appear } }),
    ...(leave === 'none' ? {} : { delete: { type: easing, property: leave } }),
  };
}
