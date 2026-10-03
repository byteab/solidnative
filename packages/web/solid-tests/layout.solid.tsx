/** @jsxImportSource @solid-native/web/solid */
/**
 * Fixtures for `layout-browser.mjs`: one of each thing a real browser has to resolve for a style to
 * look right, and jsdom cannot - layout, a transform, paint, a pressed or hovered state, a colour
 * scheme, two components' scoped sheets side by side, and a breakpoint. Everything sits in one
 * wrapping row so the page fits the viewport, and each check measures against its own elements.
 */
import { ActivityIndicator, Image, Pressable, Text, View } from '@solid-native/components/solid';
import { Animated, AnimatedStyle, Easing } from '@solid-native/components/animations';
import { ColorScheme, useService } from '@solid-native/device';
import { withNativeStyles } from '@solid-native/web/solid';
import { Badge, Card } from './fixtures.solid.tsx';
import held from './held.native.css';

const PICTURE = {
  uri: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'/%3E",
};

export function cascade() {
  const fade = new Animated.Value(1);
  const slide = new Animated.Value(0);
  /** A fade on a timing curve and a slide on a spring, together, as an app would write them. */
  const play = (done: (finished: boolean) => void) =>
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0.2,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(slide, { toValue: 40, useNativeDriver: true }),
    ]).start(({ finished }) => done(finished));
  const view = () => {
    const scheme = useService(ColorScheme);
    return (
      <View class="flex-row flex-wrap items-start gap-2">
        <View id="column" class="w-40 gap-4">
          <View id="c1" class="h-10" />
          <View id="c2" class="h-10" />
        </View>
        <View id="row" style={{ flexDirection: 'row', gap: 12 }}>
          <View id="r1" class="h-10 w-10" />
          <View id="r2" class="h-10 w-10" />
        </View>
        <View id="stage" class="h-40 w-40">
          <View
            id="popover"
            style={{ position: 'absolute', top: 96, left: 40, width: 60, height: 20 }}
          />
        </View>
        <View
          id="moved"
          class="h-10 w-10"
          style={{ transform: [{ translateX: 30 }, { translateY: 10 }] }}
        />
        <View
          id="animated"
          class="h-10 w-10"
          style={{ backgroundColor: 'rgb(3, 2, 1)' }}
          ref={AnimatedStyle(() => ({ opacity: fade, transform: [{ translateX: slide }] }))}
        />
        <View id="gradient" class="h-10 w-20 bg-linear-to-r from-[#ff0000] to-[#0000ff]" />
        <View
          id="shadow"
          class="h-10 w-20"
          style={{
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.45,
            shadowRadius: 12,
          }}
        />
        <View id="framed" class="h-10 w-10" style={{ borderWidth: 2 }} />
        <View id="tinted-frame" class="h-10 w-10 border-2 border-[#ff0000]" />
        <ActivityIndicator id="spinner" color="rgb(255, 0, 0)" />
        <ActivityIndicator id="stopped" animating={false} />
        <Image id="blurred" class="h-10 w-10" source={PICTURE} blurRadius={4} />
        {withNativeStyles(held, () => (
          <Pressable id="held" class="held h-10 w-20">
            <Text>Hold</Text>
          </Pressable>
        ))}
        <Pressable id="pressed" class="h-10 w-20 bg-[#101010] press:bg-[#202020]">
          <Text>Press</Text>
        </Pressable>
        <View id="hovered" class="h-10 w-20 bg-[#303030] hover:bg-[#404040]" />
        {Card()}
        {Badge()}
        <Text id="plain" class="label">
          plain
        </Text>
        <View class={scheme.current()}>
          <View id="themed" class="h-10 w-10 bg-[#ffffff] dark:bg-[#000000]" />
        </View>
        <View id="notched" class="pt-safe" style={{ '--safe-area-inset-top': '30px' }} />
        <View id="unnotched" class="pt-safe" />
      </View>
    );
  };
  return { play, view };
}

/** A row that stacks on a phone and shares the line on a tablet. */
export const breakpoints = () => (
  <View id="layout">
    <View class="flex flex-col md:flex-row">
      <Text>First</Text>
      <Text>Second</Text>
    </View>
  </View>
);
