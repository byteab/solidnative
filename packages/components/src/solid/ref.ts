import { onHostCleanup, useHostAdapter, useHostEngine } from '@solid-native/platform/solid';
import type { HostNode } from '@solid-native/fabric';
import type { NativeRef } from './types.ts';

/** Capture host ownership once: native event callbacks do not run under a Solid owner. */
export function commitTask(node: HostNode): (callback: () => void) => void {
  const adapter = useHostAdapter();
  let active = true;
  let cancel: (() => void) | undefined;
  onHostCleanup(node, () => {
    active = false;
    cancel?.();
  });
  return (callback) => {
    cancel?.();
    if (!active) return;
    cancel = adapter.afterCommit(() => {
      cancel = undefined;
      if (active && adapter.isAttached(node)) callback();
    });
  };
}

export function createNativeRef(node: HostNode): NativeRef {
  const engine = useHostEngine();
  const adapter = useHostAdapter();
  const pending = new Set<() => void>();
  let active = true;
  onHostCleanup(node, () => {
    active = false;
    for (const cancel of pending) cancel();
    pending.clear();
  });
  const after = (callback: () => void) => {
    if (!active) return;
    let cancel: () => void;
    cancel = adapter.afterCommit(() => {
      pending.delete(cancel);
      if (active && adapter.isAttached(node)) callback();
    });
    pending.add(cancel);
  };
  return {
    node,
    isAttached: () => active && adapter.isAttached(node),
    dispatchCommand: (name, args) => after(() => engine.dispatchCommand(node, name, args)),
    focus: () => after(() => engine.focus(node)),
    measure: (callback) =>
      after(() =>
        engine.measure(node, (frame) => {
          if (active && adapter.isAttached(node)) callback(frame);
        }),
      ),
  };
}
