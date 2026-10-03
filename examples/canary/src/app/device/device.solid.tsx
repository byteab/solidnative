/** @jsxImportSource @solid-native/platform/solid */
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
} from '@solid-native/components/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';
import {
  useService,
  Accessibility,
  AppState,
  ColorScheme,
  Keyboard,
  Screen,
  SafeArea,
  DeepLinks,
} from '@solid-native/device/solid';

export function DevicePage() {
  const accessibility = useService(Accessibility);
  const app = useService(AppState);
  const colors = useService(ColorScheme);
  const keyboard = useService(Keyboard);
  const screen = useService(Screen);
  const insets = useService(SafeArea).insets;
  const links = useService(DeepLinks);
  const on = (value: boolean) => (value ? 'on' : 'off');
  const announce = () => accessibility.announce('Solid Native says hello');
  const openSite = () => {
    void links.open('https://www.solidjs.com');
  };
  return (
    <>
      <NativeHeader title="Device" />
      <KeyboardAvoidingView class="screen" keyboardVerticalOffset={100}>
        <ScrollView class="screen" contentContainerStyle={page.content}>
          <Text class="hint">
            Every value below is an accessor over a platform subscription. Rotate the device, switch
            the theme, or turn on Reduce Motion and they follow.
          </Text>

          <Text class="heading">Screen</Text>
          <Text class="body">
            {screen.window().width} x {screen.window().height},{screen.orientation()}
          </Text>
          <Text class="hint">
            The same numbers the engine answers media queries with. Reduced motion is
            {accessibility.reduceMotion() ? 'on' : 'off'}, and @media (prefers-reduced-motion:
            reduce) reads it too.
          </Text>

          <Text class="heading">Safe area</Text>
          <Text class="body">
            top {insets().top}, bottom {insets().bottom}, left {insets().left}, right
            {insets().right}
          </Text>
          <Text class="hint">
            Measured by the provider at the app's root. A layout wanting the space usually wants
            &lt;safe-area-view&gt; instead, which applies it natively.
          </Text>

          <Text class="heading">Appearance and state</Text>
          <Text class="body">
            {colors.current()} theme, app is {app.current()}
          </Text>

          <Text class="heading">Accessibility</Text>
          <Text class="body">
            screen reader {on(accessibility.screenReader())}, reduce motion
            {on(accessibility.reduceMotion())}, bold text {on(accessibility.boldText())}
          </Text>
          <Pressable
            class="card"
            onPress={() => {
              announce();
            }}
          >
            <Text class="button-label">Announce to a screen reader</Text>
          </Pressable>

          <Text class="heading">Keyboard</Text>
          <Text class="body">{keyboard.visible() ? keyboard.height() + 'pt tall' : 'hidden'}</Text>
          <TextInput
            class="field"
            placeholder="Tap here to raise the keyboard"
            placeholderTextColor="#6c6c78"
          />
          <Pressable
            class="card"
            onPress={() => {
              keyboard.dismiss();
            }}
          >
            <Text class="button-label">Dismiss it</Text>
          </Pressable>

          <Text class="heading">Links</Text>
          <Pressable
            class="card"
            onPress={() => {
              openSite();
            }}
          >
            <Text class="button-label">Open solidjs.com</Text>
          </Pressable>
          <Text class="hint">
            The other half of deep linking: this app handed a url to whatever handles it.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
