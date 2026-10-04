import {
  $TRACK,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  untrack,
  type Accessor,
  type Owner,
  type Setter,
} from 'solid-js';
import { activeRoot } from './context.ts';
import type { NativeChild } from './root.ts';

const FALLBACK: unique symbol = Symbol('fallback');

/** Solid's computation, as far as `quiet` reaches into it. */
interface Computation {
  fn?: (value: unknown) => unknown;
  owned: Computation[] | null;
}

const unchanged = (value: unknown): unknown => value;

/**
 * Stop a removed row's computations from doing anything until it is disposed: one that re-runs
 * hands back the value it has and, reading nothing, unsubscribes itself. A row commonly derives
 * its data from the list it was removed from (`lines().find(...)!`), which would throw if it ran.
 * Solid never runs them, as it disposes the row before they can; this is the cheap half of that
 * disposal, a walk with no unlinking, and the rest waits for the commit. It writes Solid's
 * internal `fn`, which every Solid 1.x computation has.
 */
function quiet(owner: Owner | null | undefined): void {
  const owned = (owner as unknown as Computation | null | undefined)?.owned;
  if (!owned) return;
  for (let i = 0; i < owned.length; i++) {
    const computation = owned[i]!;
    computation.fn = unchanged;
    if (computation.owned) quiet(computation as unknown as Owner);
  }
}

/**
 * Solid's `<For>`, except that a removed row's owner is disposed after the commit that takes its
 * nodes off screen rather than before it, as React runs unmount effects after its commit. On a
 * cleared list the teardown of every row's computations and cleanups was most of the time to the
 * commit (`docs/mount-performance.md`). Until then a removed row's effects stay subscribed, so a
 * signal written in that window runs them against nodes that are no longer attached.
 */
export function For<T extends readonly unknown[]>(props: {
  each: T | undefined | null | false;
  fallback?: NativeChild;
  children: (item: T[number], index: Accessor<number>) => NativeChild;
}): NativeChild {
  const fallback = 'fallback' in props ? () => props.fallback : undefined;
  return createMemo(mapArray(() => props.each, props.children, fallback)) as unknown as NativeChild;
}

/** `solid-js`'s `mapArray`, with removed rows retired to the native root (see `For`). */
function mapArray<T, U>(
  list: Accessor<readonly T[] | undefined | null | false>,
  mapFn: (item: T, index: Accessor<number>) => U,
  fallback: (() => U) | undefined,
): () => U[] {
  const root = activeRoot();
  const retire = root
    ? (dispose: () => void, owner: Owner | null) => {
        quiet(owner);
        root.retire(dispose);
      }
    : (dispose: () => void) => dispose();
  let items: (T | typeof FALLBACK)[] = [],
    mapped: U[] = [],
    disposers: (() => void)[] = [],
    // Each row's owner, beside its disposer, for `quiet`.
    owners: (Owner | null)[] = [],
    len = 0,
    indexes: Setter<number>[] | null = mapFn.length > 1 ? [] : null;
  // The list itself going away is not a removal on screen: its rows go with their owner, now.
  onCleanup(() => {
    for (let i = 0; i < disposers.length; i++) disposers[i]!();
  });
  return () => {
    const newItems = list() || [],
      newLen = newItems.length;
    (newItems as unknown as Record<symbol, unknown>)[$TRACK];
    // Solid's own update, kept as close to it as the types allow so the two can be diffed.
    // eslint-disable-next-line complexity
    return untrack(() => {
      let i: number, j: number;
      const mapper = (disposer: () => void): U => {
        disposers[j] = disposer;
        owners[j] = getOwner();
        if (indexes) {
          const [s, set] = createSignal(j);
          indexes[j] = set;
          return mapFn(newItems[j]!, s);
        }
        return mapFn(newItems[j]!, undefined as unknown as Accessor<number>);
      };
      if (newLen === 0) {
        if (len !== 0) {
          for (i = 0; i < len; i++) retire(disposers[i]!, owners[i]!);
          disposers = [];
          owners = [];
          items = [];
          mapped = [];
          len = 0;
          if (indexes) indexes = [];
        }
        if (fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot((disposer) => {
            disposers[0] = disposer;
            owners[0] = getOwner();
            return fallback();
          });
          len = 1;
        }
      } else if (len === 0) {
        mapped = new Array<U>(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j]!;
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        const temp = new Array<U>(newLen);
        const tempDisposers = new Array<() => void>(newLen);
        const tempOwners = new Array<Owner | null>(newLen);
        const tempIndexes = indexes ? new Array<Setter<number>>(newLen) : null;
        let start: number, end: number, newEnd: number;
        for (
          start = 0, end = Math.min(len, newLen);
          start < end && items[start] === newItems[start];
          start++
        );
        for (
          end = len - 1, newEnd = newLen - 1;
          end >= start && newEnd >= start && items[end] === newItems[newEnd];
          end--, newEnd--
        ) {
          temp[newEnd] = mapped[end]!;
          tempDisposers[newEnd] = disposers[end]!;
          tempOwners[newEnd] = owners[end]!;
          if (tempIndexes) tempIndexes[newEnd] = indexes![end]!;
        }
        const newIndices = new Map<unknown, number>();
        const newIndicesNext = new Array<number>(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          const item = newItems[j];
          const at = newIndices.get(item);
          newIndicesNext[j] = at === undefined ? -1 : at;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
          const item = items[i];
          const at = newIndices.get(item);
          if (at !== undefined && at !== -1) {
            temp[at] = mapped[i]!;
            tempDisposers[at] = disposers[i]!;
            tempOwners[at] = owners[i]!;
            if (tempIndexes) tempIndexes[at] = indexes![i]!;
            newIndices.set(item, newIndicesNext[at]!);
          } else retire(disposers[i]!, owners[i]!);
        }
        for (j = start; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j]!;
            disposers[j] = tempDisposers[j]!;
            owners[j] = tempOwners[j]!;
            if (tempIndexes) {
              indexes![j] = tempIndexes[j]!;
              indexes![j]!(j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, (len = newLen));
        // The rest are retired: a later cleanup of the list must not dispose them a second time.
        disposers.length = owners.length = len;
        items = newItems.slice(0);
      }
      return mapped;
    });
  };
}
