/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createRenderEffect, createSignal, onCleanup } from 'solid-js';
import {
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  VirtualList,
} from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { Engine } from '@solid-native/fabric';
import { afterHostCommit, useHostEngine, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { FrameMonitor, stressRows, type StressRow } from './stress-rows.solid.ts';
import sheet from './stress-list.native.css';
const round = (value: number) => Math.round(value * 10) / 10;
export function StressList() {
  const engine = useHostEngine(),
    front = useService(SCREEN_IN_FRONT),
    created = performance.now(),
    rows = stressRows(),
    monitor = new FrameMonitor();
  const [filter, setFilter] = createSignal(''),
    [prices, setPrices] = createSignal<ReadonlyMap<string, number>>(new Map()),
    [ticking, setTicking] = createSignal(false),
    [measuring, setMeasuring] = createSignal(false),
    [readout, setReadout] = createSignal('');
  const shown = createMemo(() => {
    const query = filter().trim().toLowerCase();
    return query ? rows.filter((row) => row.name.includes(query)) : rows;
  });
  let ticker: ReturnType<typeof setInterval> | undefined,
    epoch = 0,
    active = true;
  let started = { commits: 0, created: 0, cloned: 0, at: 0 };
  const stopTicker = () => {
    ++epoch;
    clearInterval(ticker);
    ticker = undefined;
    setTicking(false);
  };
  const stopMeasure = () => {
    const frames = monitor.stop();
    setMeasuring(false);
    const seconds = (performance.now() - started.at) / 1000;
    const stats = engine instanceof Engine ? engine.stats : undefined;
    setReadout(
      `${round(seconds)}s: ${frames.frames} JS frames, ${frames.late} late, worst gap ${round(frames.worst)}ms. ` +
        (stats
          ? `${stats.commits - started.commits} commits, ${stats.slowCommits} over 8ms, worst commit ${round(stats.worstCommitMs)}ms, worst render ${round(stats.worstRenderMs)}ms, ${stats.createdNodes - started.created} created, ${stats.clonedNodes - started.cloned} cloned`
          : 'Native commit statistics unavailable on this host'),
    );
    console.error(`[stress] ${readout()}`);
  };
  const toggleMeasure = () => {
    if (!active || !front()) return;
    if (measuring()) {
      stopMeasure();
      return;
    }
    const stats = engine instanceof Engine ? engine.stats : undefined;
    if (stats) {
      stats.worstCommitMs = 0;
      stats.worstRenderMs = 0;
      stats.slowCommits = 0;
    }
    started = {
      commits: stats?.commits ?? 0,
      created: stats?.createdNodes ?? 0,
      cloned: stats?.clonedNodes ?? 0,
      at: performance.now(),
    };
    monitor.start();
    setMeasuring(true);
    setReadout('Measuring: fling, filter, tick, then Stop');
  };
  const toggleTicker = () => {
    if (!active || !front()) return;
    if (ticker !== undefined) {
      stopTicker();
      return;
    }
    const request = ++epoch;
    setTicking(true);
    ticker = setInterval(() => {
      if (!active || !front() || request !== epoch) return;
      const next = new Map(prices());
      for (let i = 0; i < 20; i++) {
        const id = `s${Math.floor(Math.random() * 300)}`;
        next.set(id, 100 + Math.random() * 100);
      }
      setPrices(next);
    }, 100);
  };
  const priceOf = (row: StressRow) =>
    (prices().get(row.id) ?? 100 + (Number(row.id.slice(1)) % 900) / 10).toFixed(2);
  afterHostCommit(() => {
    if (active)
      setReadout(`${rows.length} rows, first render ${round(performance.now() - created)}ms`);
  });
  createRenderEffect(() => {
    if (!front()) {
      stopTicker();
      if (measuring()) stopMeasure();
    }
  });
  onCleanup(() => {
    active = false;
    stopTicker();
    monitor.stop();
  });
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Stress list" />
      <View class="screen">
        <View class="toolbar">
          <TextInput
            class="field grow"
            accessibilityLabel="Filter"
            placeholder="Filter"
            value={filter()}
            onValueChange={setFilter}
            autoCapitalize="none"
          />
          <Pressable class="chip" accessibilityRole="button" onPress={toggleTicker}>
            <Text class="chip-label">{ticking() ? 'Stop prices' : 'Live prices'}</Text>
          </Pressable>
          <Pressable class="chip" accessibilityRole="button" onPress={toggleMeasure}>
            <Text class="chip-label">{measuring() ? 'Stop' : 'Measure'}</Text>
          </Pressable>
        </View>
        <Text class="hint readout" accessibilityRole="summary">
          {readout()}
        </Text>
        <VirtualList
          class="list"
          items={shown()}
          estimatedItemHeight={88}
          keyExtractor={(row) => row.id}
          renderItem={(row) => (
            <View nativeID={'row-' + row().id} class="row">
              <Image class="thumb" source={{ uri: row().image }} />
              <View class="grow">
                <View class="line">
                  <Text class="strong grow">{row().symbol}</Text>
                  <Text class="price">{priceOf(row())}</Text>
                </View>
                <Text class="body">{row().name}</Text>
                <Text class="hint">{row().note}</Text>
              </View>
            </View>
          )}
        />
      </View>
    </>
  ));
}
