import { onCleanup } from 'solid-js';
import { expoModule, optional } from '../native.ts';
import { silence, sourcedService } from './owned.ts';
export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

/** What happened, rather than how it felt. iOS plays a distinct pattern for each. */
export type NotificationType = 'success' | 'warning' | 'error';

/** The slice of `expo-haptics` this needs. */
export interface NativeHaptics {
  impactAsync(style: ImpactStyle): Promise<void>;
  notificationAsync(type: NotificationType): Promise<void>;
  selectionAsync(): Promise<void>;
}

export interface Haptics {
  readonly available: boolean;
  impact(style?: ImpactStyle): void;
  notify(type: NotificationType): void;
  select(): void;
}
export const Haptics = sourcedService<Haptics, NativeHaptics | null>(
  'expo.haptics',
  () => {
    const core = optional(() => require('expo-modules-core') as typeof import('expo-modules-core'));
    return expoModule('expo-haptics', () =>
      core?.requireOptionalNativeModule<NativeHaptics>('ExpoHaptics'),
    );
  },
  (native) => {
    let active = true;
    onCleanup(() => {
      active = false;
    });
    const play = (action: () => unknown) => {
      if (active) silence(action);
    };
    return {
      available: native !== null,
      impact: (style = 'medium') => play(() => native?.impactAsync(style)),
      notify: (type) => play(() => native?.notificationAsync(type)),
      select: () => play(() => native?.selectionAsync()),
    };
  },
);
