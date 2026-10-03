import {
  createRenderEffect,
  createRoot,
  createSignal,
  getOwner,
  mergeProps,
  onCleanup,
  splitProps,
  untrack,
  type Owner,
} from 'solid-js';
import type { HostNode } from '@solidnative/fabric';
import { useHostAdapter, type HostChild } from '@solidnative/platform/solid';
import { View } from './primitive.ts';
import type { ViewProps } from './types.ts';

export interface PresenceProps extends ViewProps {
  when: boolean;
  enterClass?: string;
  leaveClass?: string;
  /** Explicit CSS animation duration in milliseconds; defaults to immediate completion. */
  enterDuration?: number;
  /** Explicit CSS transition/animation duration in milliseconds; defaults to immediate removal. */
  leaveDuration?: number;
  onEntered?: () => void;
  onExited?: () => void;
}
type Phase = 'enter' | 'present' | 'leave';
interface Instance {
  node?: HostNode;
  dispose(): void;
}
const duration = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) ? Math.max(0, value) : 0;

function report(error: unknown) {
  try {
    console.error(error);
  } catch {
    /* A reporter must not interrupt sibling disposal. */
  }
}
/** Same pinned public owner contract as retained route/root disposal. */
function containCleanup(owner: Owner) {
  for (const child of owner.owned ?? []) containCleanup(child);
  if (owner.cleanups)
    owner.cleanups = owner.cleanups.map((cleanup) => () => {
      try {
        cleanup();
      } catch (error) {
        report(error);
      }
    });
}
/** Retain one owned view through its exit. Reentry cancels exit and preserves descendants. */
export function Presence(props: PresenceProps): HostChild {
  const adapter = useHostAdapter(),
    owner = getOwner();
  const [local, view] = splitProps(props, [
    'when',
    'enterClass',
    'leaveClass',
    'enterDuration',
    'leaveDuration',
    'onEntered',
    'onExited',
  ]);
  const [rendered, setRendered] = createSignal<HostNode | null>(null);
  const [phase, setPhase] = createSignal<Phase>('present');
  let active = true,
    current: Instance | undefined,
    revision = 0;
  let cancelCommit: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    revision++;
    cancelCommit?.();
    cancelCommit = undefined;
    clearTimeout(timer);
    timer = undefined;
  };
  const notify = (callback: (() => void) | undefined) => {
    try {
      callback?.();
    } catch (error) {
      report(error);
    }
  };
  const complete = (instance: Instance, token: number, entering: boolean) => {
    if (!active || current !== instance || revision !== token) return;
    if (entering) {
      setPhase('present');
      if (active && current === instance && revision === token) notify(local.onEntered);
    } else {
      current = undefined;
      setRendered(null);
      try {
        instance.dispose();
      } finally {
        if (active && revision === token) notify(local.onExited);
      }
    }
  };
  const animate = (instance: Instance, entering: boolean) => {
    cancel();
    const token = revision;
    setPhase(entering ? 'enter' : 'leave');
    if (!active || current !== instance || revision !== token) return;
    const ms = duration(entering ? local.enterDuration : local.leaveDuration);
    cancelCommit = adapter.afterCommit(() => {
      cancelCommit = undefined;
      if (!active || current !== instance || revision !== token) return;
      if (!ms || !instance.node || !adapter.isAttached(instance.node)) {
        complete(instance, token, entering);
      } else timer = setTimeout(() => complete(instance, token, entering), ms);
    });
  };
  const mount = () => {
    const instance: Instance = { dispose() {} };
    current = instance;
    createRoot((dispose) => {
      const childOwner = getOwner();
      let disposed = false;
      instance.dispose = () => {
        if (disposed) return;
        disposed = true;
        if (childOwner) containCleanup(childOwner);
        dispose();
      };
      instance.node = View(
        mergeProps(view, {
          get class() {
            const extra =
              phase() === 'enter' ? local.enterClass : phase() === 'leave' ? local.leaveClass : '';
            return [view.class, extra].filter(Boolean).join(' ');
          },
        }),
      );
    }, owner);
    if (active && current === instance) setRendered(instance.node!);
    return instance;
  };
  onCleanup(() => {
    active = false;
    cancel();
    const instance = current;
    current = undefined;
    instance?.dispose();
  });
  createRenderEffect(() => {
    const visible = local.when;
    untrack(() => {
      if (!active) return;
      if (visible) animate(current ?? mount(), true);
      else if (current) animate(current, false);
    });
  });
  return rendered;
}
