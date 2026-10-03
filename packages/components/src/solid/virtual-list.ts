import {
  batch,
  createMemo,
  createRenderEffect,
  createSignal,
  mapArray,
  mergeProps,
  onCleanup,
  untrack,
  type Accessor,
} from 'solid-js';
import {
  pinnedRange,
  type HostNode,
  type ScrollDrive,
  type StaticTransform,
} from '@solid-native/fabric';
import { insertHostChildren, useHostAdapter, type HostChild } from '@solid-native/platform/solid';
import type { LayoutEvent, ScrollEvent } from '../events.ts';
import { HeightIndex } from '../height-index.ts';
import { View } from './primitive.ts';
import { ScrollView, type ScrollViewProps, type ScrollViewRef } from './scroll-view.ts';
import { commitTask } from './ref.ts';

export type VirtualItemHeight<T> = number | ((item: T, index: number) => number);
export interface VirtualListVisiblePosition {
  readonly minIndexForVisible?: number;
  readonly autoscrollToTopThreshold?: number;
}
export interface VirtualRow<T> {
  readonly key: unknown;
  readonly item: T;
  readonly index: number;
}
export interface VirtualListViewability<T> {
  readonly viewable: readonly VirtualRow<T>[];
  readonly entered: readonly number[];
  readonly left: readonly number[];
}
export interface VirtualListRef extends ScrollViewRef {
  scrollToIndex(options: { index: number; animated?: boolean; viewOffset?: number }): void;
  scrollToOffset(options: { offset: number; animated?: boolean }): void;
}
export interface VirtualListProps<T> extends Omit<
  ScrollViewProps,
  'children' | 'ref' | 'maintainVisibleContentPosition'
> {
  items: readonly T[];
  itemHeight?: VirtualItemHeight<T>;
  estimatedItemHeight?: VirtualItemHeight<T>;
  keyExtractor?: (item: T, index: number) => unknown;
  /** Called once per keyed owner. Read both accessors in reactive bindings. */
  renderItem: (item: Accessor<T>, index: Accessor<number>) => HostChild;
  /** Opt into legacy row.slot reuse. Local row state then belongs to the slot, not the item. */
  recycleItems?: boolean;
  /** Recycling never assigns a slot to a different row type. */
  itemType?: (item: T, index: number) => unknown;
  renderSeparator?: (
    leading: Accessor<T>,
    trailing: Accessor<T>,
    index: Accessor<number>,
  ) => HostChild;
  listHeader?: HostChild;
  listFooter?: HostChild;
  overscan?: number;
  /**
   * Rows to create ahead of the window, in the direction of scroll, a few per frame while the
   * list scrolls, so a row is usually made before it is needed rather than in the scroll event
   * that needs it. 10 by default; 0 turns it off.
   */
  prefetch?: number;
  inverted?: boolean;
  stickyIndices?: readonly number[];
  stickyHeader?: boolean;
  maintainVisibleContentPosition?: VirtualListVisiblePosition;
  itemVisiblePercentThreshold?: number;
  endReachedThreshold?: number;
  onEndReached?: (event: { distanceFromEnd: number }) => void;
  onViewableItemsChanged?: (event: VirtualListViewability<T>) => void;
  ref?: (ref: VirtualListRef) => void;
}

const LIST_PROPS = new Set([
  'items',
  'itemHeight',
  'estimatedItemHeight',
  'keyExtractor',
  'renderItem',
  'renderSeparator',
  'recycleItems',
  'itemType',
  'listHeader',
  'listFooter',
  'overscan',
  'prefetch',
  'inverted',
  'stickyIndices',
  'stickyHeader',
  'maintainVisibleContentPosition',
  'itemVisiblePercentThreshold',
  'endReachedThreshold',
  'onEndReached',
  'onViewableItemsChanged',
  'ref',
]);
const sizeOf = <T>(height: VirtualItemHeight<T>, item: T, index: number) => {
  const size = typeof height === 'number' ? height : height(item, index);
  if (!Number.isFinite(size) || size < 0)
    throw new Error('List row heights must be finite and nonnegative.');
  return size;
};
/**
 * How long a frame's prefetch may run before it waits for the next frame. At least one row is
 * made per frame whatever it costs.
 *
 * ponytail: a fixed share of a 60Hz frame, not one measured from the frame's own deadline, which
 * nothing here can see. Measure from the frame start if a 120Hz screen shows dropped frames.
 */
const PREFETCH_BUDGET_MS = 4;
const now = (): number => globalThis.performance?.now?.() ?? Date.now();
const PARKED = Object.freeze({ display: 'none' });
const NO_FLIP = Object.freeze([]) as unknown as StaticTransform[];
const FLIP_X = Object.freeze([Object.freeze({ scaleX: -1 })]) as unknown as StaticTransform[];
const FLIP_Y = Object.freeze([Object.freeze({ scaleY: -1 })]) as unknown as StaticTransform[];

function changedMeasurement(
  size: number | undefined,
  previous: number | undefined,
): size is number {
  return size !== undefined && Number.isFinite(size) && size >= 0 && size !== previous;
}

interface Anchor {
  key: unknown;
  within: number;
  keys: readonly unknown[];
  index: number;
}

/** A native scroll host windowing keyed Solid owners, with Fenwick-indexed measured heights. */
export function VirtualList<T>(props: VirtualListProps<T>): HostChild {
  const adapter = useHostAdapter();
  const engine = adapter.engine;
  const [viewport, setViewport] = createSignal(0);
  const [offset, setOffset] = createSignal(0);
  const [settled, setSettled] = createSignal(0);
  const [headerSize, setHeaderSize] = createSignal(0);
  const [revision, setRevision] = createSignal(0);
  const measured = new Map<unknown, number>();
  const drives = new Map<HostNode, { drive: ScrollDrive; axis: string; statics: string }>();
  let scroll!: ScrollViewRef;
  let schedule: (callback: () => void) => void;
  let active = true;
  let anchor: Anchor | null = null;
  let contentSize = 0;
  let endReachedFor = -1;
  let announced: VirtualRow<T>[] = [];
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const model = createMemo(() => {
    const items = props.items;
    const keys = items.map((item, index) =>
      props.keyExtractor ? props.keyExtractor(item, index) : item,
    );
    const indices = new Map<unknown, number>();
    keys.forEach((key, index) => {
      if (indices.has(key)) throw new Error('VirtualList keys must be unique.');
      indices.set(key, index);
    });
    // Keep at most the current data set's measurements; departed items do not leak indefinitely.
    for (const key of measured.keys()) if (!indices.has(key)) measured.delete(key);
    const height = props.itemHeight;
    const estimate = props.estimatedItemHeight ?? 50;
    const table = new HeightIndex(
      items.map((item, index) =>
        height === undefined
          ? (measured.get(keys[index]) ?? sizeOf(estimate, item, index))
          : sizeOf(height, item, index),
      ),
    );
    return { items, keys, indices, table };
  });
  const layout = () => {
    revision();
    return model().table;
  };
  const extent = () => layout().total;
  const topOf = (index: number) => layout().topOf(index);
  const heightOf = (index: number) => layout().heightOf(index);
  const overscan = () => Math.max(0, Math.floor(props.overscan ?? 4));
  const measuring = () => props.itemHeight === undefined;
  const flip = (): StaticTransform[] =>
    props.inverted ? (props.horizontal ? FLIP_X : FLIP_Y) : NO_FLIP;
  const sticky = createMemo(() =>
    [...new Set(props.stickyIndices ?? [])]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < model().items.length)
      .sort((a, b) => a - b),
  );
  const pinned = createMemo(() => {
    let at = -1;
    for (const index of sticky()) {
      if (topOf(index) > offset()) break;
      at = index;
    }
    return at;
  });
  const span = createMemo(() => {
    const table = layout();
    const count = table.length;
    if (!count) return { first: 0, last: 0 };
    const visible = table.indexAt(Math.max(0, offset()));
    const first = Math.max(0, visible - overscan());
    const budget = viewport() || Math.max(1, heightOf(visible)) * Math.max(1, overscan() * 2);
    // Include the partial leading row, so uneven heights cannot leave the viewport's end blank.
    const end = Math.max(0, offset()) + budget;
    let last = visible;
    while (last < count && topOf(last) < end) last++;
    return { first, last: Math.min(count, Math.max(visible + 1, last) + overscan()) };
  });
  /** The way the list last scrolled, 1 forwards or -1 back: the side rows are prefetched on. */
  let heading = 1;
  /**
   * The index prefetched rows reach to, past the window on `heading`'s side. Every change of
   * `heading` writes it, which is what lets `windowKeys` read `heading` untracked.
   */
  const [reach, setReach] = createSignal(-1, { equals: false });
  const windowKeys = createMemo(() => {
    const { first, last } = span();
    const to = reach();
    const all = model().keys;
    const start = heading < 0 ? Math.max(0, Math.min(first, to)) : first;
    const end = heading > 0 ? Math.min(all.length, Math.max(last, to)) : last;
    const keys = all.slice(start, end);
    if (pinned() >= 0 && pinned() < start) keys.unshift(all[pinned()]);
    return keys;
  });
  const prefetchCount = () => Math.max(0, Math.floor(props.prefetch ?? 10));
  let cancelPrefetch: (() => void) | undefined;
  const schedulePrefetch = () => {
    if (cancelPrefetch || !active || !prefetchCount()) return;
    cancelPrefetch = adapter.requestFrame(prefetchFrame);
  };
  /** Widen the window by a row at a time on the side the list is heading, within the budget. */
  const prefetchFrame = () => {
    cancelPrefetch = undefined;
    if (!active) return;
    const started = now();
    do {
      const { first, last } = span();
      const to = reach();
      if (heading > 0) {
        const at = Math.max(last, to);
        if (at >= Math.min(model().keys.length, last + prefetchCount())) return;
        setReach(at + 1);
      } else {
        const at = Math.min(first, to);
        if (at <= Math.max(0, first - prefetchCount())) return;
        setReach(at - 1);
      }
    } while (now() - started < PREFETCH_BUDGET_MS);
    schedulePrefetch();
  };
  const remember = (along: number) => {
    const current = model();
    if (!current.items.length) {
      anchor = null;
      return;
    }
    const index = current.table.indexAt(Math.max(0, along));
    anchor = { key: current.keys[index], index, keys: current.keys, within: along - topOf(index) };
  };
  const scrollToOffset = (options: { offset: number; animated?: boolean }) => {
    if (!active) return;
    scroll.scrollTo(
      props.horizontal
        ? { x: options.offset, y: 0, animated: options.animated }
        : { x: 0, y: options.offset, animated: options.animated },
    );
  };
  const correct = (along: number, animated = false) => {
    setOffset(along);
    schedule?.(() => scrollToOffset({ offset: headerSize() + along, animated }));
  };
  const successor = (old: Anchor): number | undefined => {
    const indices = model().indices;
    const own = indices.get(old.key);
    if (own !== undefined) return own;
    for (const key of old.keys.slice(old.index + 1, old.index + overscan() * 4 + 2)) {
      const index = indices.get(key);
      if (index !== undefined) return index;
    }
    return undefined;
  };
  const minimumHeldIndex = () => props.maintainVisibleContentPosition?.minIndexForVisible ?? 0;
  const holdAnchor = (old: Anchor, changedItems: boolean): boolean => {
    const hold = props.maintainVisibleContentPosition;
    if (changedItems && !hold) return false;
    const threshold = hold?.autoscrollToTopThreshold;
    if (changedItems && threshold !== undefined && offset() <= threshold) {
      correct(-headerSize(), true);
      remember(0);
      return true;
    }
    const index = successor(old);
    if (index === undefined || (changedItems && index < minimumHeldIndex())) return false;
    const along = topOf(index) + old.within;
    if (Math.abs(along - offset()) > 0.5) correct(along);
    anchor = { ...old, key: model().keys[index], index, keys: model().keys };
    return true;
  };
  createRenderEffect(() => {
    const current = model();
    revision();
    untrack(() => {
      if (!current.items.length) return;
      const old = anchor;
      if (old) {
        const changed =
          old.keys.length !== current.keys.length ||
          old.keys.some((key, index) => key !== current.keys[index]);
        if (holdAnchor(old, changed)) return;
      }
      const end = Math.max(0, extent() - viewport());
      if (viewport() && offset() > end + 0.5) correct(end);
      remember(offset());
    });
  });
  const announce = () => {
    if (!active || !viewport()) return;
    const along = offset(),
      end = along + viewport();
    const threshold = (props.itemVisiblePercentThreshold ?? 0) / 100;
    const current = model();
    const viewable: VirtualRow<T>[] = [];
    let index = current.table.indexAt(Math.max(0, along));
    for (; index < current.items.length && topOf(index) < end; index++) {
      const size = heightOf(index);
      const shown = Math.min(topOf(index) + size, end) - Math.max(topOf(index), along);
      if (shown > 0 && shown >= size * threshold)
        viewable.push({ key: current.keys[index], item: current.items[index]!, index });
    }
    const entered = viewable
      .filter((row) => !announced.some((old) => old.key === row.key && old.index === row.index))
      .map((row) => row.index);
    const left = announced
      .filter((row) => !viewable.some((next) => next.key === row.key && next.index === row.index))
      .map((row) => row.index);
    const changed =
      entered.length || left.length || viewable.some((row, at) => row.item !== announced[at]?.item);
    announced = viewable;
    if (changed) props.onViewableItemsChanged?.({ viewable, entered, left });
  };
  const checkEnd = (along: number) => {
    if (!active || !model().items.length || !viewport()) return;
    const distanceFromEnd = (contentSize || headerSize() + extent()) - along - viewport();
    if (distanceFromEnd > (props.endReachedThreshold ?? 2) * viewport()) {
      endReachedFor = -1;
      return;
    }
    if (endReachedFor === model().items.length) return;
    endReachedFor = model().items.length;
    props.onEndReached?.({ distanceFromEnd });
  };
  const onScroll = (event: ScrollEvent) => {
    const point = event.nativeEvent?.contentOffset;
    const along = (props.horizontal ? point?.x : point?.y) ?? 0;
    batch(() => {
      const moved = along - headerSize() - offset();
      if (moved && Math.sign(moved) !== heading) {
        // Turned round: the rows made for the other way are let go.
        heading = Math.sign(moved);
        setReach(heading > 0 ? -1 : Infinity);
      }
      setOffset(along - headerSize());
      remember(along - headerSize());
    });
    schedulePrefetch();
    if (engine.drivesScroll && (sticky().length || props.stickyHeader)) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (active) setSettled(along - headerSize());
      }, 64);
    }
    try {
      announce();
    } finally {
      try {
        checkEnd(along);
      } finally {
        props.onScroll?.(event);
      }
    }
  };
  const onLayout = (event: LayoutEvent) => {
    const frame = event.nativeEvent?.layout;
    setViewport((props.horizontal ? frame?.width : frame?.height) ?? 0);
    try {
      announce();
    } finally {
      props.onLayout?.(event);
    }
  };
  const releaseDrive = (node: HostNode) => {
    drives.get(node)?.drive.stop();
    drives.delete(node);
  };
  const drive = (node: HostNode, start: number, stop: number) => {
    const axis = props.horizontal ? 'x' : 'y';
    const statics = JSON.stringify(flip());
    const held = drives.get(node);
    const range = pinnedRange(start, stop);
    if (held && held.axis === axis && held.statics === statics) {
      held.drive.update(range);
      return;
    }
    releaseDrive(node);
    const next = engine.driveByScroll(node, scroll.node, axis, range, flip());
    if (next) drives.set(node, { drive: next, axis, statics });
  };
  const nextStop = (index: number) => {
    const next = sticky()[sticky().indexOf(index) + 1];
    return next === undefined ? Infinity : topOf(next) - heightOf(index);
  };
  const shift = (start: number, stop: number) =>
    Math.min(
      Math.max(0, (engine.drivesScroll ? settled() : offset()) - start),
      Math.max(0, stop - start),
    );
  interface Slot {
    key: Accessor<unknown>;
    setKey: (key: unknown) => void;
    parked: Accessor<boolean>;
    setParked: (parked: boolean) => void;
    type: unknown;
  }
  const allocated = new Map<unknown, Slot>();
  const pools = new Map<unknown, Slot[]>();
  const slots = createMemo(() => {
    const keys = windowKeys();
    const live = new Set(keys);
    const recycle = props.recycleItems ?? false;
    const current = model();
    const getType = props.itemType;
    const types = new Map(
      keys.map((key) => {
        const index = current.indices.get(key)!;
        return [key, getType?.(current.items[index]!, index)] as const;
      }),
    );
    const typeOf = (key: unknown) => types.get(key);
    return untrack(() => {
      if (!recycle) pools.clear();
      for (const [key, slot] of allocated) {
        if (live.has(key) && (!recycle || slot.type === typeOf(key))) continue;
        allocated.delete(key);
        if (!recycle) continue;
        slot.setParked(true);
        let pool = pools.get(slot.type);
        if (!pool) pools.set(slot.type, (pool = []));
        pool.push(slot);
      }
      const result = keys.map((key) => {
        let slot = allocated.get(key);
        if (slot) return slot;
        const type = typeOf(key);
        slot = recycle ? pools.get(type)?.pop() : undefined;
        if (slot) {
          slot.setKey(key);
          slot.setParked(false);
        } else {
          const [readKey, setKey] = createSignal(key);
          const [parked, setParked] = createSignal(false);
          slot = { key: readKey, setKey: (key) => setKey(() => key), parked, setParked, type };
        }
        allocated.set(key, slot);
        return slot;
      });
      for (const [type, pool] of pools) {
        if (pool.length > 6) pool.splice(0, pool.length - 6);
        result.push(...pool);
        if (!pool.length) pools.delete(type);
      }
      return result;
    });
  });
  const rows = mapArray(slots, (slot) => {
    let lastIndex = model().indices.get(slot.key()) ?? -1;
    let lastItem = model().items[lastIndex]!;
    const index = () => {
      if (!slot.parked()) lastIndex = model().indices.get(slot.key()) ?? -1;
      return lastIndex;
    };
    const item = () => {
      if (!slot.parked()) {
        const at = index();
        if (at >= 0) lastItem = model().items[at]!;
      }
      return lastItem;
    };
    let node!: HostNode;
    // Written into one object: this runs for every row on every step of a scroll.
    const rowStyle = (): Record<string, unknown> => {
      if (slot.parked()) return PARKED;
      const at = index();
      const style: Record<string, unknown> = {};
      if (!measuring() || at < span().first) {
        style['position'] = 'absolute';
        if (props.horizontal) {
          style['top'] = 0;
          style['bottom'] = 0;
          style['left'] = topOf(at);
          style['width'] = heightOf(at);
        } else {
          style['left'] = 0;
          style['right'] = 0;
          style['top'] = topOf(at);
          style['height'] = heightOf(at);
        }
      }
      const isSticky = sticky().includes(at);
      if (isSticky) style['zIndex'] = 1;
      const translation = isSticky ? shift(topOf(at), nextStop(at)) : 0;
      const flipped = flip();
      if (translation)
        style['transform'] = [
          { [props.horizontal ? 'translateX' : 'translateY']: translation },
          ...flipped,
        ];
      else if (flipped.length) style['transform'] = flipped;
      return style;
    };
    const measure = (event: LayoutEvent) => {
      const at = index();
      if (!active || slot.parked() || !measuring() || at < 0) return;
      const frame = event.nativeEvent?.layout;
      const size = props.horizontal ? frame?.width : frame?.height;
      if (!changedMeasurement(size, measured.get(slot.key()))) return;
      measured.set(slot.key(), size);
      model().table.set(at, size);
      setRevision((value) => value + 1);
    };
    const separator = mapArray(
      () =>
        !slot.parked() &&
        props.renderSeparator &&
        index() >= 0 &&
        index() < model().items.length - 1
          ? [true]
          : [],
      () =>
        View({
          get style() {
            return props.horizontal
              ? { position: 'absolute', top: 0, bottom: 0, right: 0, pointerEvents: 'box-none' }
              : { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' };
          },
          get children() {
            return props.renderSeparator!(item, () => model().items[index() + 1]!, index);
          },
        }),
    );
    node = View({
      get style() {
        return rowStyle();
      },
      collapsable: false,
      onLayout: measure,
      children: [props.renderItem(item, index), separator],
    });
    const bind = commitTask(node);
    createRenderEffect(() => {
      const at = index();
      const isSticky = !slot.parked() && sticky().includes(at);
      const start = headerSize() + topOf(at),
        stop = headerSize() + nextStop(at);
      props.horizontal;
      props.inverted;
      if (engine.drivesScroll && isSticky)
        bind(() => {
          if (!slot.parked() && sticky().includes(index())) drive(node, start, stop);
        });
      else releaseDrive(node);
    });
    onCleanup(() => releaseDrive(node));
    return node;
  });
  const header = View({
    get style() {
      const limit = sticky().length ? topOf(sticky()[0]!) : Infinity;
      const translation = props.stickyHeader ? shift(-headerSize(), limit - headerSize()) : 0;
      return {
        ...(props.stickyHeader ? { zIndex: 1 } : {}),
        transform: [
          ...(translation
            ? [{ [props.horizontal ? 'translateX' : 'translateY']: translation }]
            : []),
          ...flip(),
        ],
      };
    },
    onLayout(event) {
      const frame = event.nativeEvent?.layout;
      const next = (props.horizontal ? frame?.width : frame?.height) ?? 0;
      const previous = headerSize();
      setHeaderSize(next);
      if (
        next !== previous &&
        props.maintainVisibleContentPosition &&
        offset() > (props.maintainVisibleContentPosition.autoscrollToTopThreshold ?? 0)
      )
        correct(offset());
    },
    get children() {
      return props.listHeader;
    },
  });
  const headerBind = commitTask(header);
  createRenderEffect(() => {
    const enabled = props.stickyHeader;
    const stop = sticky().length ? topOf(sticky()[0]!) : Infinity;
    props.horizontal;
    props.inverted;
    headerSize();
    if (engine.drivesScroll && enabled)
      headerBind(() => {
        if (props.stickyHeader) drive(header, 0, stop);
      });
    else releaseDrive(header);
  });
  const spacer = View({
    get style() {
      return props.horizontal ? { width: topOf(span().first) } : { height: topOf(span().first) };
    },
  });
  const canvas = View({
    collapsable: false,
    get style() {
      return props.horizontal ? { width: extent(), flexDirection: 'row' } : { height: extent() };
    },
  });
  insertHostChildren(canvas, () => [measuring() ? spacer : null, rows]);
  const footer = View({
    get style() {
      return { transform: flip() };
    },
    get children() {
      return props.listFooter;
    },
  });
  const forwarded = () =>
    Object.fromEntries(Object.entries(props).filter(([key]) => !LIST_PROPS.has(key)));
  const result = ScrollView(
    mergeProps(forwarded, {
      get style() {
        return [props.style, props.inverted ? { transform: flip() } : null];
      },
      get scrollEventThrottle() {
        return sticky().length || props.stickyHeader ? 1 : (props.scrollEventThrottle ?? 16);
      },
      onScroll,
      onLayout,
      onContentSizeChange(size) {
        contentSize = props.horizontal ? size.width : size.height;
        props.onContentSizeChange?.(size);
      },
      children: [header, canvas, footer],
      ref(ref: ScrollViewRef) {
        scroll = ref;
      },
    } satisfies ScrollViewProps),
  );
  schedule = commitTask(scroll.node);
  props.ref?.({
    ...scroll,
    scrollToOffset,
    scrollToIndex(options) {
      if (!active || !model().items.length) return;
      const index = Math.max(0, Math.min(Math.floor(options.index), model().items.length - 1));
      const along = topOf(index) - (options.viewOffset ?? 0);
      batch(() => {
        setOffset(along);
        anchor = {
          key: model().keys[index],
          index,
          keys: model().keys,
          within: -(options.viewOffset ?? 0),
        };
      });
      scrollToOffset({ offset: headerSize() + along, animated: options.animated });
    },
  });
  // Data changes can alter viewability without native emitting another scroll event.
  createRenderEffect(() => {
    model();
    revision();
    untrack(announce);
  });
  onCleanup(() => {
    active = false;
    cancelPrefetch?.();
    clearTimeout(settleTimer);
    for (const { drive } of drives.values()) drive.stop();
    drives.clear();
    measured.clear();
    allocated.clear();
    pools.clear();
  });
  return result;
}
