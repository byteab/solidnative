import {
  ErrorBoundary as SolidErrorBoundary,
  Index as SolidIndex,
  Match as SolidMatch,
  Show as SolidShow,
  Suspense as SolidSuspense,
  SuspenseList as SolidSuspenseList,
  Switch as SolidSwitch,
  createSignal,
  onCleanup,
  type Accessor,
} from 'solid-js';
import { useHostAdapter } from './host-context.ts';
import type { NativeChild } from './root.ts';

/**
 * Solid's control flow is host-independent; only its default DOM return types need adapting. `For`
 * is the platform's own, which disposes removed rows after the commit (`for.ts`).
 */
export { For } from './for.ts';

export const Index = SolidIndex as unknown as <T extends readonly unknown[]>(props: {
  each: T | undefined | null | false;
  fallback?: NativeChild;
  children: (item: Accessor<T[number]>, index: number) => NativeChild;
}) => NativeChild;

type RequiredParameter<T> = T extends () => unknown ? never : T;
interface NativeShow {
  <T, F extends (item: Accessor<NonNullable<T>>) => NativeChild>(props: {
    when: T | undefined | null | false;
    keyed?: false;
    fallback?: NativeChild;
    children: NativeChild | RequiredParameter<F>;
  }): NativeChild;
  <T, F extends (item: NonNullable<T>) => NativeChild>(props: {
    when: T | undefined | null | false;
    keyed: true;
    fallback?: NativeChild;
    children: NativeChild | RequiredParameter<F>;
  }): NativeChild;
}
export const Show = SolidShow as unknown as NativeShow;

export const Switch = SolidSwitch as unknown as (props: {
  fallback?: NativeChild;
  children: NativeChild;
}) => NativeChild;

interface NativeMatch {
  <T, F extends (item: Accessor<NonNullable<T>>) => NativeChild>(props: {
    when: T | undefined | null | false;
    keyed?: false;
    children: NativeChild | RequiredParameter<F>;
  }): NativeChild;
  <T, F extends (item: NonNullable<T>) => NativeChild>(props: {
    when: T | undefined | null | false;
    keyed: true;
    children: NativeChild | RequiredParameter<F>;
  }): NativeChild;
}
export const Match = SolidMatch as unknown as NativeMatch;

export const ErrorBoundary = SolidErrorBoundary as unknown as (props: {
  fallback: NativeChild | ((error: unknown, reset: () => void) => NativeChild);
  children: NativeChild;
}) => NativeChild;

export const Suspense = SolidSuspense as unknown as (props: {
  fallback?: NativeChild;
  children: NativeChild;
}) => NativeChild;

export const SuspenseList = SolidSuspenseList as unknown as (props: {
  revealOrder: 'forwards' | 'backwards' | 'together';
  tail?: 'collapsed' | 'hidden';
  children: NativeChild;
}) => NativeChild;

/**
 * Mount `children` once what is around it has been committed and a frame has passed, with
 * `fallback` (nothing by default) in its place until then. For a part of a screen that need not
 * be in its first frame - a section below the fold, a heavy tab body - so the rest is on screen
 * sooner. The children are created once, under this component, and never torn down by it.
 */
export function Defer(props: { fallback?: NativeChild; children: NativeChild }): NativeChild {
  const adapter = useHostAdapter();
  const [ready, setReady] = createSignal(false);
  let cancelFrame = () => {};
  const cancelCommit = adapter.afterCommit(() => {
    cancelFrame = adapter.requestFrame(() => setReady(true));
  });
  onCleanup(() => {
    cancelCommit();
    cancelFrame();
  });
  return Show({
    get when() {
      return ready();
    },
    get fallback() {
      return props.fallback;
    },
    get children() {
      return props.children;
    },
  });
}
