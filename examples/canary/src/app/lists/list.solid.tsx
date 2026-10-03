/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { Engine } from '@solid-native/fabric';
import { ScrollView, Text, VirtualList } from '@solid-native/components/solid';
import { useHostEngine, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';
import sheet from './list.native.css';

interface Row {
  kind: 'header' | 'item';
  label: string;
}
const rows: readonly Row[] = Array.from({ length: 100 }, (_, section) => [
  { kind: 'header' as const, label: `section ${section}` },
  ...Array.from({ length: 9 }, (_, index) => ({
    kind: 'item' as const,
    label: `item ${section}.${index}`,
  })),
]).flat();

export function ListPage() {
  const engine = useHostEngine();
  const [mount, setMount] = createSignal(0),
    [worst, setWorst] = createSignal(0),
    [slow, setSlow] = createSignal(0),
    [commits, setCommits] = createSignal(0);
  let lastSample = 0;
  const sample = () => {
    if (!(engine instanceof Engine)) return;
    const now = Date.now();
    if (now - lastSample < 400) return;
    lastSample = now;
    const stats = engine.stats,
      round = (n: number) => Math.round(n * 10) / 10;
    setMount(round(stats.firstCommitMs));
    setWorst(round(stats.worstCommitMs));
    setSlow(stats.slowCommits);
    setCommits(stats.commits);
  };
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Virtual list" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          1000 rows, headers taller than items. Fling it, then read the numbers.
        </Text>
        <Text class="body">
          mount <Text class="strong">{mount()}ms</Text>, worst commit{' '}
          <Text class="strong">{worst()}ms</Text>, slow <Text class="strong">{slow()}</Text>/
          <Text class="strong">{commits()}</Text>
        </Text>
        <VirtualList
          items={rows}
          itemHeight={(row) => (row.kind === 'header' ? 52 : 40)}
          keyExtractor={(row) => row.label}
          recycleItems
          class="list"
          accessibilityLabel="Variable-height rows"
          onScroll={sample}
          renderItem={(row) => (
            <Text class={row().kind === 'header' ? 'list-header' : 'list-item'}>{row().label}</Text>
          )}
        />
      </ScrollView>
    </>
  ));
}
