/** @jsxImportSource @solidnative/platform/solid */
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Pressable, Text, TextInput, View, VirtualList } from '@solidnative/components/solid';
import { LayoutAnimation, SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { For, Show, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader } from '@solidnative/router/solid';
import {
  initialTracks,
  makeTrack,
  moveTrack,
  rowsOf,
  shuffled,
  type Track,
} from './playlist-model.ts';
import sheet from './playlist.native.css';

export function createPlaylist() {
  const layout = useService(LayoutAnimation),
    front = useService(SCREEN_IN_FRONT);
  const [tracks, setTracks] = createSignal<readonly Track[]>(initialTracks()),
    [filter, setFilter] = createSignal('');
  const rows = createMemo(() => rowsOf(tracks(), filter()));
  let seed = 7,
    burstEpoch = 0,
    active = true,
    burst: ReturnType<typeof setInterval> | null = null;
  const actions = [
    { label: 'Insert 3', run: () => change((all) => insert(all, 3)) },
    { label: 'Delete 10', run: () => change((all) => deleteSpread(all, 10)) },
    {
      label: 'Sort',
      run: () => change((all) => [...all].sort((a, b) => a.title.localeCompare(b.title))),
    },
    { label: 'Shuffle', run: () => change((all) => shuffled(all, seed++)) },
    { label: 'Reverse', run: () => change((all) => [...all].reverse()) },
    { label: 'Burst', run: startBurst },
  ];
  onCleanup(() => {
    active = false;
    stopBurst();
  });
  createEffect(() => {
    if (!front()) stopBurst();
  });
  function change(edit: (all: readonly Track[]) => readonly Track[]) {
    if (!active || !front()) return;
    void layout.animate(
      () => {
        if (active && front()) setTracks(edit);
      },
      { duration: 250 },
    );
  }
  function up(track: Track) {
    change((all) => {
      const at = all.findIndex((t) => t.id === track.id);
      let prev = at - 1;
      while (prev >= 0 && all[prev]!.section !== track.section) prev--;
      return prev < 0 ? all : moveTrack(all, at, prev);
    });
  }
  function swapSection(track: Track) {
    change((all) =>
      all.map((t) =>
        t.id === track.id ? { ...t, section: t.section === 'next' ? 'later' : 'next' } : t,
      ),
    );
  }
  function remove(track: Track) {
    change((all) => all.filter((t) => t.id !== track.id));
  }
  function deleteSpread(all: readonly Track[], count: number) {
    const step = Math.max(1, Math.floor(all.length / count));
    let removed = 0;
    return all.filter((_, i) => !(i % step === 0 && removed++ < count));
  }
  function insert(all: readonly Track[], count: number) {
    const next = all.slice();
    for (let i = 0; i < count; i++) {
      const at = (seed++ * 13) % (next.length + 1);
      next.splice(at, 0, makeTrack(i % 2 ? 'later' : 'next'));
    }
    return next;
  }
  function startBurst() {
    stopBurst();
    if (!active || !front()) return;
    let left = 40;
    const request = burstEpoch;
    burst = setInterval(() => {
      if (request !== burstEpoch || left <= 0) return;
      if (!active || !front()) {
        stopBurst();
        return;
      }
      const kind = seed++ % 4,
        all = tracks();
      if (kind === 0) change((t) => insert(t, 1));
      else if (kind === 1 && all.length > 5) remove(all[(seed * 7) % all.length]!);
      else if (kind === 2 && all.length) swapSection(all[(seed * 3) % all.length]!);
      else change((t) => shuffled(t, seed++));
      if (--left === 0) stopBurst();
    }, 50);
  }
  function stopBurst() {
    burstEpoch++;
    if (burst !== null) clearInterval(burst);
    burst = null;
  }
  return { tracks, filter, setFilter, rows, actions, up, swapSection, remove, change, startBurst };
}
export function Playlist() {
  const state = createPlaylist();
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Queue" />
      <View class="screen">
        <View class="toolbar">
          <For each={state.actions}>
            {(action) => (
              <Pressable class="chip" accessibilityRole="button" onPress={action.run}>
                <Text class="chip-label">{action.label}</Text>
              </Pressable>
            )}
          </For>
        </View>
        <TextInput
          class="field filter"
          accessibilityLabel="Filter"
          placeholder="Filter"
          value={state.filter()}
          onValueChange={state.setFilter}
        />
        <VirtualList
          class="list"
          items={state.rows()}
          itemHeight={(row) => (row.kind === 'heading' ? 36 : 52)}
          keyExtractor={(row) => row.id}
          renderItem={(row) => {
            const heading = () => {
              const value = row();
              return value.kind === 'heading' ? value : undefined;
            };
            const track = () => {
              const value = row();
              return value.kind === 'track' ? value.track : undefined;
            };
            return (
              <View nativeID={`row-${row().id}`}>
                <Show when={heading()}>
                  {(value) => (
                    <Text class="section">
                      {value().section === 'next' ? 'Up next' : 'Later'} ({value().count})
                    </Text>
                  )}
                </Show>
                <Show when={track()}>
                  {(value) => (
                    <View class="track">
                      <Text class="body grow">{value().title}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Move up ${value().title}`}
                        onPress={() => state.up(value())}
                      >
                        <Text class="action">Up</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Move ${value().title} to the other section`}
                        onPress={() => state.swapSection(value())}
                      >
                        <Text class="action">⇄</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${value().title}`}
                        onPress={() => state.remove(value())}
                      >
                        <Text class="action danger">✕</Text>
                      </Pressable>
                    </View>
                  )}
                </Show>
              </View>
            );
          }}
        />
      </View>
    </>
  ));
}
