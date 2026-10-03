import { createMemo, type Accessor } from 'solid-js';
import { createObserved, type ObservedSource } from './observed.ts';
import { createServiceToken, useService } from './service-scope.ts';

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SafeAreaMetrics {
  readonly insets: Insets;
  readonly frame: Frame;
}

export type SafeAreaSource = ObservedSource<SafeAreaMetrics | null>;

export interface SafeArea {
  readonly insets: Accessor<Insets>;
  readonly frame: Accessor<Frame | null>;
  readonly known: Accessor<boolean>;
  /** Native providers report their own geometry; app code normally reads the accessors. */
  report(insets: Insets, frame: Frame): void;
}

const EMPTY: Insets = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

/** Each instance belongs to the current Solid owner; nested providers create local instances. */
export function createSafeArea(source?: SafeAreaSource): SafeArea {
  let report: (value: SafeAreaMetrics) => void = () => {};
  const metrics = createObserved<SafeAreaMetrics | null>(
    {
      current: () => source?.current() ?? null,
      subscribe(listener) {
        report = listener;
        return source?.subscribe(listener) ?? (() => {});
      },
    },
    null,
  );
  return {
    insets: createMemo(() => metrics()?.insets ?? EMPTY),
    frame: createMemo(() => metrics()?.frame ?? null),
    known: createMemo(() => metrics() !== null),
    // A provider report is a listener event, so it outranks an outstanding initial source read.
    report: (insets, frame) => report({ insets: { ...insets }, frame: { ...frame } }),
  };
}

const SOURCE = createServiceToken<SafeAreaSource>('native.safeAreaSource', () => ({
  current: () => null,
  subscribe: () => () => {},
}));
export const SafeArea = Object.freeze({
  ...createServiceToken('native.safeArea', () => createSafeArea(useService(SOURCE))),
  SOURCE,
});
