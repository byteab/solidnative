import {
  For as SolidFor,
  Show as SolidShow,
  createSignal,
  onCleanup,
  type Accessor,
} from 'solid-js';
import { useHostAdapter, type HostChild as NativeChild } from './context.ts';

/** Solid's control flow is host-independent; only its default DOM return types need adapting. */
export const For = SolidFor as unknown as <T extends readonly unknown[]>(props: {
  each: T | undefined | null | false;
  fallback?: NativeChild;
  children: (item: T[number], index: Accessor<number>) => NativeChild;
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
