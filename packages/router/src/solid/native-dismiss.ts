import { createRenderEffect, onCleanup, type Accessor } from 'solid-js';
import type { HostNode } from '@solidnative/fabric';
import { useHostAdapter } from '@solidnative/platform/solid';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { useRouteScreen } from './route-context.ts';

const guards = new WeakMap<HostNode, () => void>();

/** Bind an editor's dirty state to its actual retained native screen, not a child view. */
export function useNativeDismissGuard(prevent: Accessor<boolean>, onAttempt: () => void): void {
  const screen = useRouteScreen();
  const adapter = useHostAdapter();
  const inFront = useService(SCREEN_IN_FRONT);
  if (guards.has(screen)) throw new Error('A native screen may own only one dismissal guard.');
  guards.set(screen, () => {
    if (inFront() && prevent()) onAttempt();
  });
  createRenderEffect(() => adapter.engine.setProp(screen, 'preventNativeDismiss', prevent()));
  onCleanup(() => {
    guards.delete(screen);
    adapter.engine.setProp(screen, 'preventNativeDismiss', false);
  });
}

export const hasNativeDismissGuard = (screen: HostNode): boolean => guards.has(screen);
export function notifyNativeDismissAttempt(screen: HostNode): void {
  guards.get(screen)?.();
}
