import {
  createRenderEffect,
  createSignal,
  getOwner,
  onCleanup,
  untrack,
  type Accessor,
} from 'solid-js';
import { useHostAdapter } from '@solidnative/platform/solid';
import type { AnimatedPropsHandle, AnimationBackend } from './animation-types.ts';
import type { GestureBackend, GestureSpec } from './animation-types.ts';
import type { WorkletBackend, WorkletStyleSpec, WorkletScrollSpec } from './animation-types.ts';
import { nativeTag, nativeTarget } from './native-target.ts';
import { flattenStyle } from './image-background.ts';
import type { NativeRef, NativeStyle } from './types.ts';

export type { AnimatedPropsHandle, AnimationBackend } from './animation-types.ts';
export type { GestureBackend, GestureSpec, GestureTarget } from './animation-types.ts';
export type {
  SharedValue,
  WorkletBackend,
  WorkletStyleSpec,
  WorkletScrollSpec,
  WorkletTarget,
} from './animation-types.ts';
export type BindingSpec<T> = Accessor<T | null | undefined>;
export type RefBinding = (ref: NativeRef) => void;

/** Factories are owner-bound. A null spec explicitly suspends a retained screen's binding. */
function refOwner() {
  if (!getOwner()) throw new Error('Animation bindings require a Solid owner.');
  const adapter = useHostAdapter();
  const [ref, setRef] = createSignal<NativeRef>();
  let active = true;
  onCleanup(() => {
    active = false;
  });
  return {
    adapter,
    ref,
    bind: (next: NativeRef) => {
      if (active) setRef(next);
    },
  };
}

function nativeBinding<T>(
  spec: BindingSpec<T>,
  acquire: (target: NonNullable<ReturnType<typeof nativeTarget>>, value: T) => () => void,
  noncollapsable = false,
): RefBinding {
  const { adapter, ref, bind } = refOwner();
  createRenderEffect(() => {
    const target = ref(),
      value = spec();
    if (!target || value == null) return;
    let live = true,
      release: (() => void) | undefined;
    const stop = () => {
      if (!live) return;
      live = false;
      const dispose = release;
      release = undefined;
      dispose?.();
    };
    onCleanup(stop);
    const removeCleanup = adapter.onCleanup(target.node, stop);
    onCleanup(removeCleanup);
    if (noncollapsable) adapter.engine.setProp(target.node, 'collapsable', false);
    const cancel = adapter.afterCommit(() => {
      if (!live || !target.isAttached() || !adapter.isAttached(target.node)) return;
      const native = nativeTarget(adapter.engine, target.node);
      if (!native) return;
      const dispose = acquire(native, value);
      if (live && target.isAttached() && adapter.isAttached(target.node)) release = dispose;
      else dispose();
    });
    onCleanup(cancel);
  });
  return bind;
}

export function WorkletStyle(
  spec: BindingSpec<WorkletStyleSpec>,
  backend: WorkletBackend,
): RefBinding {
  return nativeBinding(spec, (target, value) => backend.bind(target, value));
}
export function WorkletScroll(
  spec: BindingSpec<WorkletScrollSpec>,
  backend: WorkletBackend,
): RefBinding {
  return nativeBinding(spec, (target, value) => backend.scroll(target, value));
}
export function NativeGesture(spec: BindingSpec<GestureSpec>, backend: GestureBackend): RefBinding {
  return nativeBinding(spec, (target, value) => backend.attach(target, value), true);
}

/** JS frames use the animation clock; native-driver connection waits for the commit barrier. */
export function AnimatedStyle(
  spec: BindingSpec<Record<string, unknown>>,
  backend: AnimationBackend,
): RefBinding {
  const { adapter, ref, bind } = refOwner();
  createRenderEffect(() => {
    const target = ref(),
      value = spec();
    if (!target || value == null) return;
    let live = true,
      handle: AnimatedPropsHandle | undefined,
      attached = false,
      committed = false;
    let baseline: Record<string, unknown> | undefined;
    let last: Record<string, unknown> | undefined;
    const restore = () => {
      const current = { ...flattenStyle(target.node.props['style'] as NativeStyle) };
      for (const key of Object.keys(last ?? {})) {
        if (Object.is(current[key], last![key])) {
          if (baseline && key in baseline) current[key] = baseline[key];
          else delete current[key];
        }
      }
      adapter.engine.setProp(target.node, 'style', current);
    };
    const stop = () => {
      if (!live) return;
      live = false;
      try {
        if (attached) handle?.detach();
      } finally {
        restore();
      }
    };
    onCleanup(stop);
    const removeCleanup = adapter.onCleanup(target.node, stop);
    onCleanup(removeCleanup);
    const write = () => {
      if (!live || !handle) return;
      const values = handle.read();
      if (!live) return;
      const current = flattenStyle(target.node.props['style'] as NativeStyle);
      baseline ??= { ...current };
      for (const key of Object.keys(values)) {
        if (!last || !Object.hasOwn(last, key) || !Object.is(current[key], last[key])) {
          if (Object.hasOwn(current, key)) baseline[key] = current[key];
          else delete baseline[key];
        }
      }
      last = values;
      adapter.engine.setProp(target.node, 'style', { ...current, ...values });
    };
    handle = backend.props(value, () =>
      untrack(() => {
        if (!live || !attached) return;
        if (!committed) {
          write();
          return;
        }
        if (!target.isAttached() || !adapter.isAttached(target.node)) {
          stop();
          return;
        }
        write();
        if (live && target.isAttached() && adapter.isAttached(target.node)) adapter.engine.commit();
      }),
    );
    if (!live) return;
    attached = true;
    try {
      handle.attach();
      if (live) write();
    } catch (error) {
      stop();
      throw error;
    }
    const cancel = adapter.afterCommit(() => {
      if (!live || !target.isAttached() || !adapter.isAttached(target.node)) return;
      committed = true;
      const tag = nativeTag(adapter.engine, target.node);
      if (tag !== undefined) {
        try {
          handle?.connect(tag);
        } catch (error) {
          stop();
          throw error;
        }
      }
    });
    onCleanup(cancel);
  });
  return bind;
}
