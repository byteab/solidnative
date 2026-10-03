/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { Show, withNativeStyles } from '@solidnative/platform/solid';
import {
  ServiceScope,
  SafeArea,
  provideService,
  useService,
  type SafeAreaMetrics,
} from '@solidnative/device/solid';
import type { StyleSheet } from '@solidnative/fabric';
import { View, Text } from '@solidnative/components/solid';
import { SafeAreaProvider } from '../src/solid/safe-area-provider.ts';
import { SafeAreaView, type SafeAreaEdges } from '../src/solid/safe-area-view.ts';
import { ScrollView, type ScrollViewRef, type ScrollEvent } from '../src/solid/scroll-view.ts';
import type { NativeStyle } from '../src/solid/types.ts';

const sheet: StyleSheet = {
  rules: [
    {
      compounds: [{ classes: ['insets'] }],
      combinators: [],
      specificity: 1000,
      order: 0,
      declarations: {},
      deferred: [
        { props: ['paddingTop'], kind: 'length', reference: '--safe-area-inset-top', fallback: 7 },
        {
          props: ['marginBottom'],
          kind: 'length',
          reference: '--safe-area-inset-bottom',
          fallback: 9,
        },
      ],
    },
  ],
};

export function safeAreaFixture(initialReport = true, initial: SafeAreaMetrics | null = null) {
  const [edges, setEdges] = createSignal<SafeAreaEdges>();
  const [mode, setMode] = createSignal<'padding' | 'margin'>('padding');
  const [nested, setNested] = createSignal(true);
  const [visible, setVisible] = createSignal(true);
  const [report, setReport] = createSignal(initialReport);
  const [opacity, setOpacity] = createSignal(1);
  const areas = new Map<string, SafeArea>();
  const counts = { mounts: 0, cleanups: 0, subscriptions: 0, stops: 0 };
  const events: SafeAreaMetrics[] = [];
  let sourceListener!: (metrics: SafeAreaMetrics | null) => void;
  const services = [
    provideService(SafeArea.SOURCE, () => ({
      current: () => initial,
      subscribe(listener: typeof sourceListener) {
        counts.subscriptions++;
        sourceListener = listener;
        return () => counts.stops++;
      },
    })),
  ];
  function Read(props: { id: string }) {
    areas.set(props.id, useService(SafeArea));
    counts.mounts++;
    onCleanup(() => counts.cleanups++);
    return <View testID={props.id} class="insets" />;
  }
  function Scene() {
    return withNativeStyles(sheet, () => (
      <ServiceScope services={services}>
        <View testID="shell">
          <Read id="outside" />
          <Show when={visible()}>
            <SafeAreaProvider
              testID="provider"
              reportInsets={report()}
              style={{ opacity: opacity() }}
              onInsetsChange={(event) => events.push(event.nativeEvent)}
            >
              <Read id="outer" />
              <SafeAreaView testID="safe" edges={edges()} mode={mode()}>
                <Text>safe child</Text>
              </SafeAreaView>
              <Show when={nested()}>
                <SafeAreaProvider testID="nested">
                  <Read id="inner" />
                </SafeAreaProvider>
              </Show>
            </SafeAreaProvider>
          </Show>
        </View>
      </ServiceScope>
    ));
  }
  return {
    Scene,
    areas,
    counts,
    events,
    setEdges,
    setMode,
    setNested,
    setVisible,
    setReport,
    setOpacity,
    emitSource: (metrics: SafeAreaMetrics) => sourceListener(metrics),
  };
}

export function scrollFixture() {
  const [horizontal, setHorizontal] = createSignal(false);
  const [contentStyle, setContentStyle] = createSignal<NativeStyle>({ padding: 12 });
  const [visible, setVisible] = createSignal(true);
  const [enabled, setEnabled] = createSignal(true);
  const [handler, setHandler] = createSignal(true);
  const [bounce, setBounce] = createSignal<boolean>();
  const [rate, setRate] = createSignal<'normal' | 'fast' | number>('normal');
  const counts = { mounts: 0, cleanups: 0 };
  const events: { name: string; event: ScrollEvent }[] = [];
  const sizes: { width: number; height: number }[] = [];
  let ref!: ScrollViewRef;
  function Child() {
    counts.mounts++;
    onCleanup(() => counts.cleanups++);
    return <Text testID="scroll-child">scroll me</Text>;
  }
  const receive = (name: string) => (event: ScrollEvent) => events.push({ name, event });
  const oldHandler = receive('old');
  function Scene() {
    return (
      <View testID="ancestor">
        <Show when={visible()}>
          <ScrollView
            testID="scroll"
            horizontal={horizontal()}
            contentContainerStyle={contentStyle()}
            scrollEnabled={enabled()}
            decelerationRate={rate()}
            alwaysBounceHorizontal={bounce()}
            onScroll={handler() ? oldHandler : receive('new')}
            onScrollBeginDrag={receive('begin')}
            onScrollEndDrag={receive('end')}
            onMomentumScrollBegin={receive('momentum-begin')}
            onMomentumScrollEnd={receive('momentum-end')}
            onScrollToTop={receive('top')}
            onContentSizeChange={enabled() ? (size) => sizes.push(size) : undefined}
            ref={(value) => {
              ref = value;
            }}
          >
            <Child />
          </ScrollView>
        </Show>
      </View>
    );
  }
  return {
    Scene,
    events,
    sizes,
    counts,
    ref: () => ref,
    setHorizontal,
    setContentStyle,
    setVisible,
    setEnabled,
    setBounce,
    setRate,
    replaceHandler: () => setHandler(false),
  };
}

export function InvalidSafeAreaProps() {
  // @ts-expect-error Native safe-area edges have a finite set of modes.
  return <SafeAreaView edges={{ top: 'multiply' }} />;
}

export function InvalidScrollProps() {
  // @ts-expect-error Native scroll offsets are numbers.
  return <ScrollView contentOffset={{ x: 'start', y: 0 }} />;
}
