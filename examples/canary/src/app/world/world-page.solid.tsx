/** @jsxImportSource @solidnative/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { Accessibility, useService } from '@solidnative/device/solid';
import { For, setNativeStyleHost, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader } from '@solidnative/router/solid';
import { LOCALES, SCRIPTS, message, samples } from './world-model.solid.ts';
import sheet from './world-page.native.css';
export function WorldPage() {
  const accessibility = useService(Accessibility),
    today = new Date();
  const [count, setCount] = createSignal(3),
    [saves, setSaves] = createSignal(0),
    [flagged, setFlagged] = createSignal(false),
    [archived, setArchived] = createSignal(false);
  const savedText = createMemo(() =>
    saves() === 0 ? 'Not saved yet' : saves() === 1 ? 'Saved once' : `Saved ${saves()} times`,
  );
  const itemState = createMemo(() =>
    [flagged() ? 'Flagged' : 'Not flagged', archived() ? 'archived' : 'in the inbox'].join(', '),
  );
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title="Everywhere" largeTitle />
      <ScrollView class="page" contentInsetAdjustmentBehavior="automatic">
        <Text class="section" accessibilityRole="header">
          Plurals
        </Text>
        <View class="stepper">
          <Pressable
            class="step"
            accessibilityRole="button"
            accessibilityLabel="Fewer"
            onPress={() => setCount(Math.max(0, count() - 1))}
          >
            <Text class="step-label" maxFontSizeMultiplier={1.3}>
              −
            </Text>
          </Pressable>
          <Text
            class="count"
            accessibilityRole="adjustable"
            accessibilityLabel={`${count()} messages`}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) =>
              setCount(
                Math.max(0, count() + (event.nativeEvent.actionName === 'increment' ? 1 : -1)),
              )
            }
          >
            {count()}
          </Text>
          <Pressable
            class="step"
            accessibilityRole="button"
            accessibilityLabel="More"
            onPress={() => setCount(count() + 1)}
          >
            <Text class="step-label" maxFontSizeMultiplier={1.3}>
              +
            </Text>
          </Pressable>
        </View>
        <For each={LOCALES}>
          {(locale) => {
            const sample = samples(locale, today);
            return (
              <View
                class="locale"
                classList={{ rtl: locale.direction === 'rtl' }}
                style={{ direction: locale.direction }}
                accessibilityLanguage={locale.tag}
              >
                <View class="card-head">
                  <Text class="language">{locale.name}</Text>
                  <Text class="tag">{locale.tag}</Text>
                </View>
                <Text class="message" accessibilityLabel={message(locale, count())}>
                  {message(locale, count())}
                </Text>
                <View class="facts">
                  <Text class="fact">{sample.money}</Text>
                  <Text class="fact">{sample.number}</Text>
                </View>
                <Text class="date">{sample.date}</Text>
              </View>
            );
          }}
        </For>
        <Text class="section" accessibilityRole="header">
          Scripts
        </Text>
        <For each={SCRIPTS}>
          {(script) => (
            <View class="script">
              <Text class="script-label">{script.label}</Text>
              <Text class="script-text">{script.text}</Text>
            </View>
          )}
        </For>
        <Text class="section" accessibilityRole="header">
          For a screen reader
        </Text>
        <View class="panel">
          <Pressable
            class="action"
            accessibilityRole="button"
            accessibilityLabel="Save draft"
            accessibilityHint="Keeps the draft on this device"
            onPress={() => {
              setSaves(saves() + 1);
              accessibility.announce(savedText());
            }}
          >
            <Text class="action-label">Save draft</Text>
          </Pressable>
          <Text class="status" accessibilityLiveRegion="polite">
            {savedText()}
          </Text>
          <View
            class="item"
            accessible
            accessibilityLabel={`Invoice from Kiln, ${itemState()}`}
            accessibilityActions={[
              { name: 'flag', label: 'Flag' },
              { name: 'archive', label: 'Archive' },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'flag') setFlagged(!flagged());
              if (event.nativeEvent.actionName === 'archive') setArchived(!archived());
            }}
          >
            <View class="item-dot" classList={{ flagged: flagged() }} />
            <View class="item-text">
              <Text class="item-title">Invoice from Kiln</Text>
              <Text class="item-hint">
                {itemState()}. Swipe up or down with VoiceOver for actions.
              </Text>
            </View>
          </View>
          <View class="pulse-row" accessibilityElementsHidden>
            <View class="pulse" />
            <Text class="pulse-label">Pulses, unless reduce motion is on</Text>
          </View>
        </View>
      </ScrollView>
    </view>
  ));
}
