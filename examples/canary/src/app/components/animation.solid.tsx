/** @jsxImportSource @solidnative/platform/solid */
import { createRenderEffect, createSignal, onCleanup } from 'solid-js';
import { Animated, Easing, AnimatedStyle } from '@solidnative/components/solid/animations';
import { Pressable, Presence, ScrollView, Text, View } from '@solidnative/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader } from '@solidnative/router/solid';
import { page } from '../screen-styles.ts';
import sheet from './animation.native.css';

export function AnimationPage() {
  const front = useService(SCREEN_IN_FRONT);
  const nativeX = new Animated.Value(0),
    jsX = new Animated.Value(0);
  const nativeStyle = { transform: [{ translateX: nativeX }] },
    jsStyle = { transform: [{ translateX: jsX }] };
  const nativeRef = AnimatedStyle(() => (front() ? nativeStyle : null)),
    jsRef = AnimatedStyle(() => (front() ? jsStyle : null));
  const [blocked, setBlocked] = createSignal(false),
    [lit, setLit] = createSignal(false),
    [row, setRow] = createSignal(true);
  let active = true;
  const stop = () => {
    nativeX.stopAnimation();
    jsX.stopAnimation();
  };
  createRenderEffect(() => {
    if (!front()) stop();
  });
  onCleanup(() => {
    active = false;
    stop();
  });
  const run = () => {
    if (!active || !front()) return;
    for (const [value, useNativeDriver] of [
      [nativeX, true],
      [jsX, false],
    ] as const) {
      value.setValue(0);
      Animated.timing(value, {
        toValue: 220,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver,
      }).start();
    }
  };
  const block = () => {
    if (!active || !front()) return;
    setBlocked(true);
    if (!active || !front()) return;
    const until = Date.now() + 2000;
    while (Date.now() < until) {
      /* deliberately spinning */
    }
    if (active) setBlocked(false);
  };
  const box = {
    width: 72,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#3b6ef5',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const boxAlt = { ...box, backgroundColor: '#8a5cf6' },
    label = { color: '#ffffff', fontSize: 12, fontWeight: '600' };
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Animation" backTitle="Back" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          Two identical animations. Start them, then block the JavaScript thread: the native one
          carries on, the JavaScript one freezes.
        </Text>
        <View class="track">
          <View style={box} ref={nativeRef}>
            <Text style={label}>native</Text>
          </View>
        </View>
        <View class="track">
          <View style={boxAlt} ref={jsRef}>
            <Text style={label}>js</Text>
          </View>
        </View>
        <Pressable class="button" onPress={run}>
          <Text class="button-label">run both</Text>
        </Pressable>
        <Pressable class="card" onPress={block}>
          <Text class="button-label">block the JS thread for 2s</Text>
          <Text class="hint">{blocked() ? 'blocking...' : 'a busy loop, no timers'}</Text>
        </Pressable>
        <Text class="hint">
          Below is a CSS transition instead: no animated values, no directive. The class toggles and
          the engine eases the properties that changed, because the stylesheet said to.
        </Text>
        <View class="swatches">
          <View class="swatch" classList={{ on: lit() }} />
          <View class="swatch wide" classList={{ on: lit() }} />
        </View>
        <Pressable class="card" onPress={() => setLit(!lit())}>
          <Text class="button-label">toggle the class</Text>
          <Text class="hint">colour, opacity and width, all from CSS</Text>
        </Pressable>
        <Text class="hint">
          And Solid's owned presence. The row leaves on a transition, held in the tree until it
          finishes, and arrives on a @keyframes animation, which plays from its own frames however
          late the class lands.
        </Text>
        <Presence
          when={row()}
          class="leaver"
          enterClass="arriving"
          enterDuration={400}
          leaveClass="leaving"
          leaveDuration={450}
        >
          <Text class="button-label">enter and leave</Text>
        </Presence>
        <Pressable class="card" onPress={() => setRow(!row())}>
          <Text class="button-label">{row() ? 'remove the row' : 'bring it back'}</Text>
        </Pressable>
      </ScrollView>
    </>
  ));
}
