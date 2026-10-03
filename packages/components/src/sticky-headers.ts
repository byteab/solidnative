import {
  type HostEngine,
  type HostNode,
  type ScrollDrive,
  pinnedRange,
} from '@solidnative/fabric';

interface Extent {
  readonly start: number;
  readonly size: number;
}

type LayoutEvent = {
  nativeEvent?: { layout?: { x?: number; y?: number; width?: number; height?: number } };
};

/**
 * `stickyHeaderIndices` for `<scroll-view>`, done the way RN's `ScrollView.js` does it.
 *
 * There is no native prop for it on either platform. RN wraps each sticky child in
 * `ScrollViewStickyHeader`, which translates it by the scroll offset past its own position and
 * stops where the next sticky child would push it off. The same sums run here, over the content
 * view's element children: control-flow anchors are not children in RN's sense and are skipped,
 * so an index counts what is committed.
 *
 * Each sticky child's position comes from its own layout event, and the translation is written
 * as its `transform` prop, with RN's `zIndex: 10` so it draws over the content scrolling under
 * it. A style of the caller's own that sets either wins, as it would in RN.
 *
 * Where the host can, native moves each one on every frame the scroll view moves, as RN's
 * animated interpolation does, and the translation is written only once scrolling pauses: a
 * translate written from each scroll event lands late, and on a fast fling the header shudders.
 */
export class StickyHeaders {
  private readonly engine: HostEngine;
  private readonly horizontal: () => boolean;
  private headers: HostNode[] = [];
  private readonly extents = new Map<HostNode, Extent>();
  private readonly listening = new Map<HostNode, () => void>();
  /** The translation last written per header, so an unchanged one is not written again. */
  private readonly written = new Map<HostNode, number>();
  private readonly drives = new Map<HostNode, ScrollDrive>();
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private offset = 0;

  constructor(engine: HostEngine, scroll: HostNode, horizontal: () => boolean) {
    this.engine = engine;
    this.scroll = scroll;
    this.horizontal = horizontal;
  }

  private readonly scroll: HostNode;

  /** Find the sticky children again, after a pass that may have changed them. */
  track(content: HostNode | undefined, indices: readonly number[]): void {
    const children = (content?.children ?? []).filter((child) => child.kind === 'element');
    const headers = indices.flatMap((index) => children[index] ?? []);
    for (const node of this.headers) {
      if (!headers.includes(node)) this.release(node);
    }
    for (const node of headers) {
      if (this.listening.has(node)) continue;
      this.engine.setProp(node, 'zIndex', 10);
      this.listening.set(
        node,
        this.engine.setEventListener(node, 'topLayout', (event) => this.measured(node, event)),
      );
    }
    this.headers = headers;
    this.apply();
  }

  scrolled(offset: number): void {
    this.offset = offset;
    if (!this.engine.drivesScroll) return this.apply();
    // RN's sticky header commits its translate after 64 ms without a scroll event.
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.apply(), 64);
  }

  destroy(): void {
    clearTimeout(this.settleTimer);
    for (const node of this.headers) this.release(node);
    this.headers = [];
  }

  private measured(node: HostNode, event: unknown): void {
    const layout = (event as LayoutEvent).nativeEvent?.layout;
    if (!layout) return;
    const horizontal = this.horizontal();
    this.extents.set(node, {
      start: (horizontal ? layout.x : layout.y) ?? 0,
      size: (horizontal ? layout.width : layout.height) ?? 0,
    });
    this.apply();
  }

  private release(node: HostNode): void {
    this.listening.get(node)?.();
    this.listening.delete(node);
    this.extents.delete(node);
    this.written.delete(node);
    this.drives.get(node)?.stop();
    this.drives.delete(node);
    this.engine.setProp(node, 'zIndex', undefined);
    this.engine.setProp(node, 'transform', undefined);
  }

  private drive(node: HostNode, start: number, stop: number): void {
    if (!this.engine.drivesScroll) return;
    const range = pinnedRange(start, stop);
    const drive = this.drives.get(node);
    if (drive) return drive.update(range);
    const axis = this.horizontal() ? 'x' : 'y';
    const next = this.engine.driveByScroll(node, this.scroll, axis, range);
    if (next) this.drives.set(node, next);
  }

  /** `ScrollViewStickyHeader`'s interpolation, as plain arithmetic. */
  private apply(): void {
    const key = this.horizontal() ? 'translateX' : 'translateY';
    this.headers.forEach((node, at) => {
      const own = this.extents.get(node);
      if (!own) return;
      const next = this.extents.get(this.headers[at + 1]!);
      const stop = next ? next.start - own.size : Infinity;
      this.drive(node, own.start, stop);
      const shift = Math.min(Math.max(0, this.offset - own.start), Math.max(0, stop - own.start));
      if (this.written.get(node) === shift) return;
      this.written.set(node, shift);
      this.engine.setProp(node, 'transform', shift > 0 ? [{ [key]: shift }] : undefined);
    });
  }
}
