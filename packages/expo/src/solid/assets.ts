import {
  createComputed,
  createSignal,
  getOwner,
  onCleanup,
  untrack,
  type Accessor,
} from 'solid-js';
import { useService } from '@solidnative/device/solid';
import { expoModule } from '../native.ts';
import { sourcedService } from './owned.ts';

export interface AssetLike {
  readonly uri: string;
  readonly width: number | null;
  readonly height: number | null;
}
export interface NativeAssets {
  load(modules: readonly (number | string)[]): Promise<readonly AssetLike[]>;
}
export type AssetResourceStatus = 'idle' | 'loading' | 'reloading' | 'resolved' | 'error' | 'local';
export interface AssetResource {
  readonly value: Accessor<readonly AssetLike[] | undefined>;
  readonly error: Accessor<unknown>;
  readonly status: Accessor<AssetResourceStatus>;
  readonly isLoading: Accessor<boolean>;
  hasValue(): boolean;
  reload(): boolean;
  set(value: readonly AssetLike[] | undefined): void;
  update(
    change: (value: readonly AssetLike[] | undefined) => readonly AssetLike[] | undefined,
  ): void;
  destroy(): void;
}
export interface Assets {
  resource(modules: Accessor<readonly (number | string)[]>): AssetResource;
}

/** Each resource belongs to its caller. Native downloads continue, but stale answers are ignored. */
export function assetResource(
  native: NativeAssets | null,
  modules: Accessor<readonly (number | string)[]>,
): AssetResource {
  if (!getOwner()) throw new Error('Asset resources require an active Solid owner.');
  const [snapshot, publish] = createSignal<{
    value: readonly AssetLike[] | undefined;
    error: unknown;
    status: AssetResourceStatus;
  }>({ value: undefined, error: undefined, status: 'idle' });
  let active = true;
  let revision = 0;
  let requested: readonly (number | string)[] = [];
  const destroy = () => {
    if (!active) return;
    active = false;
    revision++;
    publish({ value: undefined, error: undefined, status: 'idle' });
  };
  onCleanup(destroy);
  const load = (reload: boolean) => {
    if (!active) return false;
    const request = ++revision;
    const params = requested;
    const current = () => active && revision === request;
    publish({
      value: reload ? untrack(snapshot).value : undefined,
      error: undefined,
      status: reload ? 'reloading' : 'loading',
    });
    if (!current()) return false;
    const settle = (
      value: readonly AssetLike[] | undefined,
      error: unknown,
      status: AssetResourceStatus,
    ) => {
      if (current()) publish({ value, error, status });
    };
    try {
      void Promise.resolve(native?.load(params) ?? []).then(
        (value) => settle(value, undefined, 'resolved'),
        (error: unknown) => settle(undefined, error, 'error'),
      );
    } catch (error) {
      settle(undefined, error, 'error');
    }
    return true;
  };
  const set = (value: readonly AssetLike[] | undefined) => {
    if (!active) return;
    revision++;
    publish({ value, error: undefined, status: 'local' });
  };
  createComputed(() => {
    const params = modules();
    untrack(() => {
      requested = [...params];
      load(false);
    });
  });
  return {
    value: () => snapshot().value,
    error: () => snapshot().error,
    status: () => snapshot().status,
    isLoading: () => ['loading', 'reloading'].includes(snapshot().status),
    hasValue: () => snapshot().value !== undefined,
    reload: () =>
      untrack(() => {
        if (['idle', 'loading', 'reloading'].includes(snapshot().status)) return false;
        return load(true);
      }),
    set,
    update: (change) => {
      const request = revision;
      if (!active) return;
      const next = change(untrack(snapshot).value);
      if (active && revision === request) set(next);
    },
    destroy,
  };
}

export const Assets = sourcedService<Assets, NativeAssets | null>(
  'expo.assets',
  () => {
    const expo = expoModule(
      'expo-asset',
      () => require('expo-asset') as typeof import('expo-asset'),
    );
    return expo
      ? { load: (modules) => expo.Asset.loadAsync([...modules] as number[] | string[]) }
      : null;
  },
  (native) => {
    let active = true;
    const resources = new Set<AssetResource>();
    onCleanup(() => {
      active = false;
      for (const resource of resources) resource.destroy();
      resources.clear();
    });
    return {
      resource: (modules) => {
        if (!active) throw new Error('Assets service has been disposed.');
        const resource = assetResource(native, modules);
        if (!active) resource.destroy();
        else resources.add(resource);
        onCleanup(() => resources.delete(resource));
        return resource;
      },
    };
  },
);

export function assets(modules: Accessor<readonly (number | string)[]>): AssetResource {
  return useService(Assets).resource(modules);
}
