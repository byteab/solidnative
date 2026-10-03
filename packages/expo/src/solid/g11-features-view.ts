import { createComputed } from 'solid-js';
import { Engine, type EngineNode, type HostNode } from '@solidnative/fabric';
import { useHostAdapter } from '@solidnative/platform/solid';
import { optional } from '../native.ts';

/** Native-only commands never reach retained detached nodes or a browser host. */
export function viewTarget(node: HostNode, foreground: () => boolean = () => true) {
  const adapter = useHostAdapter();
  let active = true;
  let epoch = 0;
  createComputed(() => {
    if (!foreground()) epoch++;
  });
  adapter.onCleanup(node, () => {
    active = false;
  });
  const live = () => active && foreground() && adapter.isAttached(node);
  return {
    adapter,
    live,
    capture: () => {
      const acquired = epoch;
      return () => acquired === epoch && live();
    },
    tag: () => {
      if (!live() || !(adapter.engine instanceof Engine)) return null;
      const tag = adapter.engine.tagOf(node as EngineNode);
      return live() ? tag : null;
    },
  };
}
export function viewFunctions<T>(...modules: string[]): T | null {
  const core = optional(
    () =>
      require('expo-modules-core') as {
        requireOptionalNativeModule<T>(name: string): T | null;
      },
  );
  for (const name of modules) {
    const functions = core?.requireOptionalNativeModule<{ ViewPrototypes?: Record<string, T> }>(
      name,
    )?.ViewPrototypes?.[name];
    if (functions) return functions;
  }
  return null;
}
