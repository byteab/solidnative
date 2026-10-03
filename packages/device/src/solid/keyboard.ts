import { createMemo, onCleanup, type Accessor } from 'solid-js';
import { reactNative, type NativeKeyboardEvent, type ReactNative } from '../react-native.ts';
import { createObserved } from './observed.ts';
import { nativeSubscriptions } from './native-subscriptions.ts';
import { createServiceToken, useService } from './service-scope.ts';

export interface KeyboardMetrics {
  readonly height: number;
  readonly screenY?: number;
  readonly duration?: number;
  readonly easing?: string;
}

export interface KeyboardSource {
  subscribe(listener: (metrics: KeyboardMetrics) => void): () => void;
  dismiss(): void;
}

function timingOf(event: NativeKeyboardEvent): Pick<KeyboardMetrics, 'duration' | 'easing'> {
  return event.duration === undefined ? {} : { duration: event.duration, easing: event.easing };
}

const metricsOf = (event: NativeKeyboardEvent): KeyboardMetrics => ({
  height: event.endCoordinates.height,
  screenY: event.endCoordinates.screenY,
  ...timingOf(event),
});

/** Direct RN event methods; importing this file does not load React Native. */
export function keyboardSource(
  native: Pick<ReactNative, 'Keyboard' | 'Platform'> | null = reactNative(),
): KeyboardSource {
  if (!native) return { subscribe: () => () => {}, dismiss: () => {} };
  const keyboard = native.Keyboard;
  return {
    subscribe(listener) {
      if (native.Platform.OS !== 'ios') {
        return nativeSubscriptions([
          () => keyboard.addListener('keyboardDidShow', (event) => listener(metricsOf(event))),
          () => keyboard.addListener('keyboardDidHide', () => listener({ height: 0 })),
        ]);
      }
      let up = false;
      return nativeSubscriptions([
        () =>
          keyboard.addListener('keyboardWillShow', (event) => {
            up = true;
            listener(metricsOf(event));
          }),
        () =>
          keyboard.addListener('keyboardWillChangeFrame', (event) => {
            if (up) listener(metricsOf(event));
          }),
        () =>
          keyboard.addListener('keyboardWillHide', (event) => {
            up = false;
            listener({ height: 0, ...timingOf(event) });
          }),
      ]);
    },
    dismiss: () => keyboard.dismiss(),
  };
}

export interface Keyboard {
  readonly metrics: Accessor<KeyboardMetrics>;
  readonly height: Accessor<number>;
  readonly visible: Accessor<boolean>;
  dismiss(): void;
}

const SOURCE = createServiceToken('native.keyboardSource', keyboardSource);
export const Keyboard = Object.freeze({
  ...createServiceToken<Keyboard>('native.keyboard', () => {
    const source = useService(SOURCE);
    const metrics = createObserved<KeyboardMetrics>(
      { current: () => ({ height: 0 }), subscribe: (listener) => source.subscribe(listener) },
      { height: 0 },
    );
    let active = true;
    onCleanup(() => {
      active = false;
    });
    return {
      metrics,
      height: createMemo(() => metrics().height),
      visible: createMemo(() => metrics().height > 0),
      dismiss: () => {
        if (active) source.dismiss();
      },
    };
  }),
  SOURCE,
});
