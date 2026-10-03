import { children, createRenderEffect, mergeProps, onCleanup, untrack } from 'solid-js';
import { nativePlatform, type HostNode } from '@solidnative/fabric';
import {
  insertHostChildren,
  onHostCleanup,
  spreadHostProps,
  useHostEngine,
  useHostAdapter,
  type HostChild,
} from '@solidnative/platform/solid';
import type { Insets, LayoutEvent, Point, Rect, ScrollEvent, Size } from '../events.ts';
import { dismissKeyboardOnTap, type KeyboardShouldPersistTaps } from '../keyboard-taps.ts';
import { StickyHeaders } from '../sticky-headers.ts';
import { hostProps, primitiveNode } from './primitive.ts';
import { createNativeRef } from './ref.ts';
import { RefreshControl, splitRefreshStyle, type RefreshControlProps } from './refresh-control.ts';
import type { NativeRef, NativeStyle, ViewProps } from './types.ts';

export type { ScrollEvent, ScrollPayload } from '../events.ts';

export interface ScrollViewRef extends NativeRef {
  scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
  scrollToEnd(options?: { animated?: boolean }): void;
  flashScrollIndicators(): void;
  zoomToRect(rect: Rect, animated?: boolean): void;
}

export interface ScrollViewProps extends Omit<ViewProps, 'ref'> {
  ref?: (ref: ScrollViewRef) => void;
  contentContainerStyle?: NativeStyle;
  /** Native pull-to-refresh. On Android supply at mount to install the permanent native wrapper. */
  refreshControl?: RefreshControlProps;
  onContentSizeChange?: (size: Size) => void;
  horizontal?: boolean;
  contentOffset?: Point;
  maintainVisibleContentPosition?: {
    readonly minIndexForVisible: number;
    readonly autoscrollToTopThreshold?: number;
  };
  nestedScrollEnabled?: boolean;
  scrollEnabled?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  showsVerticalScrollIndicator?: boolean;
  pagingEnabled?: boolean;
  decelerationRate?: 'normal' | 'fast' | number;
  snapToInterval?: number;
  snapToOffsets?: readonly number[];
  snapToAlignment?: 'start' | 'center' | 'end';
  snapToStart?: boolean;
  snapToEnd?: boolean;
  disableIntervalMomentum?: boolean;
  scrollEventThrottle?: number;
  stickyHeaderIndices?: readonly number[];
  contentInset?: Insets;
  scrollIndicatorInsets?: Insets;
  bounces?: boolean;
  alwaysBounceHorizontal?: boolean;
  alwaysBounceVertical?: boolean;
  bouncesZoom?: boolean;
  directionalLockEnabled?: boolean;
  canCancelContentTouches?: boolean;
  centerContent?: boolean;
  automaticallyAdjustContentInsets?: boolean;
  automaticallyAdjustKeyboardInsets?: boolean;
  automaticallyAdjustsScrollIndicatorInsets?: boolean;
  contentInsetAdjustmentBehavior?: 'automatic' | 'scrollableAxes' | 'never' | 'always';
  pinchGestureEnabled?: boolean;
  maximumZoomScale?: number;
  minimumZoomScale?: number;
  zoomScale?: number;
  indicatorStyle?: 'default' | 'black' | 'white';
  scrollsToTop?: boolean;
  scrollToOverflowEnabled?: boolean;
  keyboardDismissMode?: 'none' | 'on-drag' | 'interactive';
  /** Defaults to never; handled lets a child responder take the tap before dismissing. */
  keyboardShouldPersistTaps?: KeyboardShouldPersistTaps;
  overScrollMode?: 'auto' | 'always' | 'never';
  persistentScrollbar?: boolean;
  fadingEdgeLength?: number;
  endFillColor?: string;
  onScroll?: (event: ScrollEvent) => void;
  onScrollBeginDrag?: (event: ScrollEvent) => void;
  onScrollEndDrag?: (event: ScrollEvent) => void;
  onMomentumScrollBegin?: (event: ScrollEvent) => void;
  onMomentumScrollEnd?: (event: ScrollEvent) => void;
  onScrollToTop?: (event: ScrollEvent) => void;
}

const DECELERATION = { normal: 0.998, fast: 0.99 };
const ANDROID_DECELERATION = { normal: 0.985, fast: 0.9 };

function trackStickyHeaders(
  node: HostNode,
  content: HostNode,
  props: ScrollViewProps,
  readChildren: () => unknown,
): void {
  const host = useHostAdapter();
  const sticky = new StickyHeaders(host.engine, node, () => !!props.horizontal);
  let horizontal = !!props.horizontal;
  createRenderEffect(() => {
    readChildren();
    const indices = props.stickyHeaderIndices ?? [];
    const axis = !!props.horizontal;
    if (axis !== horizontal) {
      sticky.destroy();
      horizontal = axis;
    }
    const cancel = host.afterCommit(() => {
      if (host.isAttached(node)) sticky.track(content, indices);
    });
    onCleanup(cancel);
  });
  const stopScroll = host.engine.setEventListener(node, 'topScroll', (event) => {
    if (!host.isAttached(node) || !props.stickyHeaderIndices?.length) return;
    const offset = (event as ScrollEvent).nativeEvent?.contentOffset;
    sticky.scrolled((props.horizontal ? offset?.x : offset?.y) ?? 0);
  });
  const release = () => {
    stopScroll();
    sticky.destroy();
  };
  onCleanup(release);
}

function scrollRef(node: HostNode): ScrollViewRef {
  const ref = createNativeRef(node);
  return {
    ...ref,
    scrollTo: ({ x = 0, y = 0, animated = true }) =>
      ref.dispatchCommand('scrollTo', [x, y, animated]),
    scrollToEnd: (options = {}) => ref.dispatchCommand('scrollToEnd', [options.animated ?? true]),
    flashScrollIndicators: () => ref.dispatchCommand('flashScrollIndicators'),
    zoomToRect: (rect, animated = true) => ref.dispatchCommand('zoomToRect', [rect, animated]),
  };
}

/** Native scroll host with a noncollapsable content view and commit-safe imperative commands. */
export function ScrollView(props: ScrollViewProps): HostChild {
  const node = primitiveNode('scroll-view');
  const content = primitiveNode('view');
  const androidRefresh = nativePlatform() === 'android' && untrack(() => !!props.refreshControl);
  onHostCleanup(
    node,
    dismissKeyboardOnTap(useHostEngine(), node, () => props.keyboardShouldPersistTaps ?? 'never'),
  );
  const onContentLayout = (event: LayoutEvent) => {
    const layout = event.nativeEvent?.layout;
    if (layout) props.onContentSizeChange?.({ width: layout.width, height: layout.height });
  };
  spreadHostProps(
    node,
    () => ({
      ...hostProps(props, {}, [
        'contentContainerStyle',
        'onContentSizeChange',
        'keyboardShouldPersistTaps',
        'refreshControl',
        'stickyHeaderIndices',
      ]),
      style: androidRefresh ? splitRefreshStyle(props.style).inner : props.style,
      nestedScrollEnabled: props.nestedScrollEnabled ?? (androidRefresh ? true : undefined),
      flexDirection: props.horizontal ? 'row' : 'column',
      alwaysBounceHorizontal: props.alwaysBounceHorizontal ?? !!props.horizontal,
      alwaysBounceVertical: props.alwaysBounceVertical ?? !props.horizontal,
      sendMomentumEvents: true,
      scrollEventThrottle: props.stickyHeaderIndices?.length ? 1 : props.scrollEventThrottle,
      decelerationRate:
        typeof props.decelerationRate === 'string'
          ? (nativePlatform() === 'android' ? ANDROID_DECELERATION : DECELERATION)[
              props.decelerationRate
            ]
          : props.decelerationRate,
    }),
    true,
  );
  spreadHostProps(
    content,
    () => ({
      collapsable: false,
      style: [props.horizontal ? { flexDirection: 'row' } : null, props.contentContainerStyle],
      onLayout: props.onContentSizeChange ? onContentLayout : undefined,
    }),
    true,
  );
  const contentChildren = children(() => props.children as never);
  insertHostChildren(content, contentChildren as () => HostChild);
  trackStickyHeaders(node, content, props, contentChildren);
  // Android native tags cannot be reparented. Once installed the disabled wrapper stays put.
  const refresh = RefreshControl(
    mergeProps(() => props.refreshControl ?? {}, {
      get enabled() {
        return props.refreshControl ? props.refreshControl.enabled : false;
      },
      get style() {
        return nativePlatform() === 'android'
          ? [
              {
                flexGrow: 1,
                flexShrink: 1,
                flexDirection: props.horizontal ? 'row' : 'column',
                overflow: 'scroll',
              },
              splitRefreshStyle(props.style).outer,
            ]
          : props.refreshControl?.style;
      },
    }),
  );
  props.ref?.(scrollRef(node));
  if (nativePlatform() === 'android') {
    insertHostChildren(node, content);
    if (!androidRefresh) return node;
    insertHostChildren(refresh, node);
    return refresh;
  }
  insertHostChildren(node, () => (props.refreshControl ? [refresh, content] : [content]));
  return node;
}
