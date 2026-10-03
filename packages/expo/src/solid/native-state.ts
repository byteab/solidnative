import { getOwner, onCleanup } from 'solid-js';
import { createServiceToken, useService } from '@solidnative/device/solid';
import { optional } from '../native.ts';
export interface RawState {
  readonly __expo_shared_object_id__?: number;
  getValue(): unknown;
  setValue(value: { value: unknown }): void;
  release(): void;
}
export interface NativeStateSource {
  create(initial: unknown): RawState | null;
}
export interface NativeState<T> {
  readonly id: number | undefined;
  get(): T;
  set(value: T): void;
  release(): void;
}
export const NATIVE_STATE_SOURCE = createServiceToken<NativeStateSource>(
  'expo.nativeStateSource',
  () => ({
    create: (initial) =>
      optional(() => {
        const { requireNativeModule } = require('expo') as typeof import('expo');
        const module = requireNativeModule('ExpoUI') as {
          ObservableState: new (init: { value: unknown }) => RawState;
        };
        return new module.ObservableState({ value: initial });
      }),
  }),
);
export function nativeState<T>(
  initial: T,
  source: NativeStateSource = useService(NATIVE_STATE_SOURCE),
): NativeState<T> | null {
  if (!getOwner()) throw new Error('nativeState requires an active Solid owner.');
  let active = true;
  let raw: RawState | null = null;
  const release = () => {
    active = false;
    const held = raw;
    raw = null;
    held?.release();
  };
  onCleanup(release);
  raw = source.create(initial);
  if (!active) {
    release();
    return null;
  }
  if (!raw) return null;
  const live = () => {
    if (!raw) throw new Error('Native state has been released.');
    return raw;
  };
  return {
    get id() {
      return raw?.__expo_shared_object_id__;
    },
    get: () => live().getValue() as T,
    set: (value) => live().setValue({ value }),
    release,
  };
}
