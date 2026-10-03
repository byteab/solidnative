/** @jsxImportSource @solid-native/platform/solid */
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Gesture } from 'react-native-gesture-handler';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { GestureRoot, NativeGesture } from '@solid-native/components/solid/gestures';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { For, Show, withNativeStyles } from '@solid-native/platform/solid';
import { FullWindowOverlay, NativeHeader } from '@solid-native/router/solid';
import { KanbanCard, type Hold } from './kanban-card.solid.tsx';
import {
  Board,
  COLUMNS,
  TAG_TONES,
  columnAt,
  type Card,
  type ColumnId,
} from './kanban-model.solid.ts';
import sheet from './kanban-page.native.css';
const LAYOUT = { inset: 16, width: 290, gap: 14 };
export function KanbanPage() {
  const board = useService(Board),
    front = useService(SCREEN_IN_FRONT);
  const boardGesture = createMemo(() => (front() ? Gesture.Native() : null)),
    boardRef = NativeGesture(boardGesture);
  const [chosen, setChosen] = createSignal<Card | null>(null),
    [held, setHeld] = createSignal<(Hold & { readonly card: Card }) | null>(null),
    [scrolledBy, setScrolledBy] = createSignal(0);
  const over = createMemo(() => {
    const hold = held();
    return hold ? columnAt(hold.x, scrolledBy(), LAYOUT) : null;
  });
  let active = true;
  onCleanup(() => {
    active = false;
  });
  createEffect(() => {
    if (!front()) setHeld(null);
  });
  const share = (points: number) => (board.total() ? (points / board.total()) * 100 : 0);
  const choose = (card: Card) => setChosen(chosen()?.id === card.id ? null : card);
  function moveChosen(to: ColumnId) {
    const card = chosen();
    if (!card || !active || !front()) return;
    board.move(card.id, to);
    setChosen(null);
  }
  function lift(card: Card, hold: Hold) {
    if (!active || !front()) return;
    setChosen(null);
    setHeld({ ...hold, card });
  }
  function follow(hold: Hold) {
    const value = held();
    if (active && front() && value) setHeld({ ...value, x: hold.x, y: hold.y });
  }
  function drop(hold: Hold) {
    const value = held();
    setHeld(null);
    const to = value ? columnAt(hold.x, scrolledBy(), LAYOUT) : null;
    if (active && front() && value && to && to !== value.card.column) board.move(value.card.id, to);
  }
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Sprint 14" largeTitle />
      <GestureRoot>
        <ScrollView class="page" contentInsetAdjustmentBehavior="automatic">
          <View class="summary">
            <Text class="summary-label">Done this sprint</Text>
            <Text class="summary-value">
              {board.done()} of {board.total()} points
            </Text>
            <View class="meter">
              <View class="meter-fill" style={{ width: `${share(board.done())}%` }} />
            </View>
          </View>
          <ScrollView
            class="board"
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            scrollEnabled={!held()}
            ref={boardRef}
            contentContainerStyle={{ paddingHorizontal: LAYOUT.inset, paddingBottom: 140 }}
            onScroll={(event) => setScrolledBy(event.nativeEvent.contentOffset?.x ?? 0)}
          >
            <For each={COLUMNS}>
              {(column) => {
                const cards = createMemo(() =>
                  board.cards().filter((card) => card.column === column.id),
                );
                const points = () => cards().reduce((sum, card) => sum + card.points, 0);
                return (
                  <View
                    class={`column${over() === column.id && held()?.card.column !== column.id ? ' target' : ''}`}
                    style={{ '--tone': column.tone }}
                  >
                    <View
                      class="head"
                      accessible
                      accessibilityRole="header"
                      accessibilityLabel={`${column.name}, ${cards().length} cards`}
                    >
                      <View class="dot" />
                      <Text class="name">{column.name}</Text>
                      <View class="count">
                        <Text class="count-label">{cards().length}</Text>
                      </View>
                    </View>
                    <View class="rail">
                      <View class="rail-fill" style={{ width: `${share(points())}%` }} />
                    </View>
                    <For
                      each={cards().map((card) => card.id)}
                      fallback={
                        <View class="empty">
                          <Text class="empty-label">Nothing here yet</Text>
                        </View>
                      }
                    >
                      {(id) => {
                        const card = () => cards().find((card) => card.id === id)!;
                        return (
                          <KanbanCard
                            class="slot"
                            card={card()}
                            chosen={chosen()?.id === id}
                            lifted={held()?.card.id === id}
                            outer={boardGesture() ?? undefined}
                            onTapped={() => choose(card())}
                            onLift={(hold) => lift(card(), hold)}
                            onDrag={follow}
                            onDrop={drop}
                            onCancel={() => setHeld(null)}
                          />
                        );
                      }}
                    </For>
                  </View>
                );
              }}
            </For>
          </ScrollView>
        </ScrollView>
        <Show when={chosen()}>
          {(card) => (
            <View class="bar" accessibilityRole="toolbar">
              <Text class="bar-title" numberOfLines={1}>
                Move {card().title}
              </Text>
              <View class="bar-row">
                <For each={COLUMNS}>
                  {(column) => (
                    <Show when={column.id !== card().column}>
                      <Pressable
                        class="move"
                        style={{ '--tone': column.tone }}
                        accessibilityRole="button"
                        accessibilityLabel={`Move to ${column.name}`}
                        onPress={() => moveChosen(column.id)}
                      >
                        <Text class="move-label">{column.name}</Text>
                      </Pressable>
                    </Show>
                  )}
                </For>
              </View>
            </View>
          )}
        </Show>
      </GestureRoot>
      <FullWindowOverlay>
        <Show when={held()}>
          {(hold) => (
            <View
              class="ghost"
              pointerEvents="none"
              style={{
                left: hold().x - hold().offsetX,
                top: hold().y - hold().offsetY,
                '--tag': TAG_TONES[hold().card.tag],
              }}
            >
              <Text class="ghost-title">{hold().card.title}</Text>
              <Text class="ghost-meta">
                {hold().card.points} pt, {hold().card.owner}
              </Text>
            </View>
          )}
        </Show>
      </FullWindowOverlay>
    </>
  ));
}
