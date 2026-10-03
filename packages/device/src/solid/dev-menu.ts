import { getOwner, onCleanup } from 'solid-js';
import { reactNative } from '../react-native.ts';
import { createServiceToken, useService } from './service-scope.ts';

export interface NativeDevMenu {
  addMenuItem(title: string, handler: () => unknown): void;
  reload(reason?: string): void;
}

export interface DevMenuSource {
  readonly menu: NativeDevMenu | null;
  readonly development: boolean;
}

export interface DevMenu {
  readonly available: boolean;
  add(title: string, handler: () => unknown): void;
  reload(reason?: string): void;
}

const SOURCE = createServiceToken<DevMenuSource>('native.devMenuSource', () => ({
  menu: reactNative()?.DevSettings ?? null,
  development: (globalThis as { __DEV__?: boolean }).__DEV__ === true,
}));
export const DevMenu = Object.freeze({
  ...createServiceToken<DevMenu>('native.devMenu', () => {
    const source = useService(SOURCE);
    let active = true;
    const registrations = new Map<string, () => void>();
    onCleanup(() => {
      active = false;
      for (const release of registrations.values()) release();
      registrations.clear();
    });
    const available = () => active && source.development && source.menu !== null;
    return {
      get available() {
        return available();
      },
      add(title, handler) {
        if (!available()) return;
        registrations.get(title)?.();
        let callback: (() => unknown) | undefined = handler;
        const release = () => {
          callback = undefined;
          if (registrations.get(title) === release) registrations.delete(title);
        };
        registrations.set(title, release);
        if (getOwner()) onCleanup(release);
        try {
          // RN replaces by title and has no remove API. Disposed handlers become inert.
          source.menu!.addMenuItem(title, () => {
            if (active) return callback?.();
            return undefined;
          });
        } catch (error) {
          release();
          throw error;
        }
      },
      reload: (reason = 'requested by the app') => {
        if (active) source.menu?.reload(reason);
      },
    };
  }),
  SOURCE,
});
