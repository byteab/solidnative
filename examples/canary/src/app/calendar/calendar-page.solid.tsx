/** @jsxImportSource @solid-native/platform/solid */
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Gesture } from 'react-native-gesture-handler';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { GestureRoot, NativeGesture } from '@solid-native/components/solid/gestures';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import {
  Agenda,
  CALENDAR_TONES,
  DAY_END,
  DAY_START,
  HOUR,
  clock,
  dateOf,
  lanes,
  minuteAt,
  monthGrid,
  type Day,
} from './calendar-model.solid.ts';
import sheet from './calendar-page.native.css';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const LONG_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
function monthOf(day: Day, by = 0) {
  const date = dateOf(day),
    moved = new Date(date.getFullYear(), date.getMonth() + by, 1);
  return { year: moved.getFullYear(), month: moved.getMonth() };
}
function minutesNow() {
  const date = new Date();
  return date.getHours() * 60 + date.getMinutes();
}

export function CalendarPage() {
  const agenda = useService(Agenda),
    front = useService(SCREEN_IN_FRONT);
  const [shown, setShown] = createSignal(monthOf(agenda.today));
  const weeks = createMemo(() => monthGrid(shown().year, shown().month));
  const monthTitle = createMemo(() => MONTH.format(new Date(shown().year, shown().month, 1)));
  const placed = createMemo(() => lanes(agenda.selectedEvents()));
  const [now, setNow] = createSignal(minutesNow());
  const [draft, setDraft] = createSignal<{ readonly from: number; readonly to: number } | null>(
    null,
  );
  let active = true;
  onCleanup(() => {
    active = false;
  });
  createEffect(() => {
    if (!front()) {
      setDraft(null);
      return;
    }
    setNow(minutesNow());
    const timer = setInterval(() => setNow(minutesNow()), 60_000);
    onCleanup(() => clearInterval(timer));
  });
  const gestures = createMemo(() => {
    if (!front()) return null;
    let current = true;
    onCleanup(() => {
      current = false;
    });
    const owns = () => active && current && front();
    const page = Gesture.Native();
    const draw = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(300)
      .simultaneousWithExternalGesture(page)
      .onStart((event) => {
        if (owns()) {
          const from = minuteAt(event.y);
          setDraft({ from, to: from + 30 });
        }
      })
      .onUpdate((event) => {
        const span = draft();
        if (owns() && span)
          setDraft({ from: span.from, to: Math.max(span.from + 15, minuteAt(event.y)) });
      })
      .onEnd(() => {
        const span = draft();
        if (owns() && span) agenda.add(agenda.selected(), span.from, span.to);
      })
      .onFinalize(() => {
        if (owns()) setDraft(null);
      });
    return { page, draw };
  });
  const pageRef = NativeGesture(() => gestures()?.page ?? null);
  const drawRef = NativeGesture(() => gestures()?.draw ?? null);
  const step = (by: number) => {
    const { year, month } = shown();
    setShown(monthOf(`${year}-${String(month + 1).padStart(2, '0')}-01`, by));
  };
  function dayLabel(day: Day) {
    const count = agenda.events().filter((event) => event.day === day).length;
    return `${LONG_DAY.format(dateOf(day))}, ${count === 1 ? '1 event' : `${count} events`}`;
  }
  const inMonth = (day: Day) =>
    dateOf(day).getMonth() === shown().month && dateOf(day).getFullYear() === shown().year;
  const hours = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i);
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title={monthTitle()} largeTitle />
      <GestureRoot>
        <ScrollView
          class="page"
          contentInsetAdjustmentBehavior="automatic"
          ref={pageRef}
          scrollEnabled={draft() === null}
        >
          <View class="month">
            <View class="nav">
              <Pressable
                class="step"
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => step(-1)}
              >
                <Text class="step-glyph">‹</Text>
              </Pressable>
              <Text class="month-name">{monthTitle()}</Text>
              <Pressable
                class="step"
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => step(1)}
              >
                <Text class="step-glyph">›</Text>
              </Pressable>
            </View>
            <View class="weekdays">
              <For each={WEEKDAYS}>{(name) => <Text class="weekday">{name}</Text>}</For>
            </View>
            <For each={weeks()}>
              {(week) => (
                <View class="week">
                  <For each={week}>
                    {(day) => (
                      <Pressable
                        class={`day${!inMonth(day) ? ' outside' : ''}${day === agenda.today ? ' today' : ''}${day === agenda.selected() ? ' chosen' : ''}`}
                        accessibilityRole="button"
                        accessibilityLabel={dayLabel(day)}
                        accessibilityState={{ selected: day === agenda.selected() }}
                        onPress={() => agenda.setSelected(day)}
                      >
                        <View class="day-disc">
                          <Text class="day-number">{dateOf(day).getDate()}</Text>
                        </View>
                        <View class="dots">
                          <For each={agenda.busy().get(day) ?? []}>
                            {(calendar) => (
                              <View class="dot" style={{ '--tone': CALENDAR_TONES[calendar] }} />
                            )}
                          </For>
                        </View>
                      </Pressable>
                    )}
                  </For>
                </View>
              )}
            </For>
          </View>
          <View class="day-head">
            <Text class="day-title">{LONG_DAY.format(dateOf(agenda.selected()))}</Text>
            <Pressable
              class="add"
              accessibilityRole="button"
              accessibilityLabel="Add event at 10:00"
              onPress={() => agenda.add(agenda.selected(), 600, 660)}
            >
              <Text class="add-label">+ 10:00</Text>
            </Pressable>
          </View>
          <View
            class="timeline"
            collapsable={false}
            ref={drawRef}
            style={{ height: (DAY_END - DAY_START) * HOUR + 16 }}
          >
            <For each={hours}>
              {(hour) => (
                <View class="hour" style={{ '--at': hour * 60 }}>
                  <Text class="hour-label">{clock(hour * 60)}</Text>
                  <View class="hour-line" />
                </View>
              )}
            </For>
            <For each={agenda.selectedEvents()}>
              {(event) => (
                <View
                  class="event"
                  style={{
                    '--start': event.start,
                    '--end': event.end,
                    '--tone': CALENDAR_TONES[event.calendar],
                    left: `${((placed().get(event.id)?.lane ?? 0) / (placed().get(event.id)?.of ?? 1)) * 100}%`,
                    width: `${100 / (placed().get(event.id)?.of ?? 1)}%`,
                  }}
                  accessible
                  accessibilityLabel={`${event.title}, ${clock(event.start)} to ${clock(event.end)}`}
                  accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
                  onAccessibilityAction={() => agenda.remove(event.id)}
                >
                  <Text class="event-title" numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Show when={event.end - event.start >= 30}>
                    <Text class="event-time">
                      {clock(event.start)} to {clock(event.end)}
                    </Text>
                  </Show>
                </View>
              )}
            </For>
            <Show
              when={
                agenda.selected() === agenda.today &&
                now() >= DAY_START * 60 &&
                now() <= DAY_END * 60
              }
            >
              <View class="now" style={{ '--now': now() }} accessibilityLabel="Now">
                <View class="now-dot" />
              </View>
            </Show>
            <Show when={draft()}>
              {(span) => (
                <View
                  class="event draft"
                  style={{ '--start': span().from, '--end': span().to, left: '0%', width: '100%' }}
                >
                  <Text class="event-title">New event</Text>
                  <Text class="event-time">
                    {clock(span().from)} to {clock(span().to)}
                  </Text>
                </View>
              )}
            </Show>
          </View>
        </ScrollView>
      </GestureRoot>
    </view>
  ));
}
