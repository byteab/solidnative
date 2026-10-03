---
title: Keyboard-avoiding view
summary: KeyboardAvoidingView moves its content clear of the on-screen keyboard.
art: keyboard-avoiding-view
---

# Keyboard-avoiding view

`KeyboardAvoidingView` moves its content clear of the keyboard, by padding
(`behavior="padding"`, the default here), shrinking (`"height"`) or shifting (`"position"`).

```tsx
<KeyboardAvoidingView class="screen">
  <TextInput placeholder="Message" {...bindFormField(form.fields.message)} />
</KeyboardAvoidingView>
```

There is no native component behind it: it measures its frame against the keyboard and adjusts a
style, so it does nothing where there is no keyboard.

## How the overlap is measured

The overlap is the view's frame against the keyboard's top edge, so a view short of the screen
bottom moves only as far as needed. The frame is measured in window coordinates, as the keyboard
reports, so a navigation bar needs no allowance. React Native measures in parent coordinates and
needs the header height in `keyboardVerticalOffset`; here that would count it twice. Use
`keyboardVerticalOffset` only for extra room above the keyboard. The overlap is capped at the view's
height, so a fully covered view shrinks to nothing, not past it.

A body that should shrink and a bar that should sit on the keyboard both go inside:

```tsx
<KeyboardAvoidingView class="screen">
  <ScrollView class="body">{/* the body */}</ScrollView>
  <View class="footer">
    <Text>{wordCount()} words</Text>
  </View>
</KeyboardAvoidingView>
```

## A bar that rides the keyboard

A composer or formatting bar that sits on the keyboard belongs in a `KeyboardDock`, not at the
bottom of a `KeyboardAvoidingView`. During an interactive dismiss
(`keyboardDismissMode="interactive"`) iOS reports no frame changes until release, so views moved by
keyboard events leave a gap.

On iOS, with [react-native-keyboard-controller](https://kirillzyusko.github.io/react-native-keyboard-controller/)
installed and `provideKeyboardController()` in the app's `ServiceScope` (or the subtree in
`KeyboardControllerProvider`), the bar moves with the keyboard natively every frame, including
interactive dismissal. Pass the composer's `nativeID` as `inputNativeID` for that. The drag takes
the keyboard from the top of the bar, as in Messages; a short drag springs back.
`KeyboardLift(dock)` returns a ref binding that moves the content above with it:

```tsx
import { provideKeyboardController } from '@solidnative/components/solid';
import { ServiceScope } from '@solidnative/device/solid';

<ServiceScope services={[provideKeyboardController()]}>{props.children}</ServiceScope>;
```

```tsx
const [dock, setDock] = createSignal<KeyboardDockRef>();
const lift = KeyboardLift(dock);

<View class="screen">
  <View class="transcript-frame">
    <View class="transcript" ref={lift}>
      <VirtualList
        class="transcript"
        inverted
        keyboardDismissMode="interactive"
        items={messages()}
        renderItem={(message) => <Bubble message={message()} />}
      />
    </View>
  </View>
  <KeyboardDock ref={setDock} inputNativeID="composer" backgroundColor="#f4f4f7">
    <View class="composer">
      <TextInput nativeID="composer" class="field" multiline />
    </View>
  </KeyboardDock>
</View>;
```

The lifted view sits in a clipping parent (`overflow: hidden` on `.transcript-frame`) so content
rising past its top is hidden. Without the library, and on Android, the dock sits in flow, padded by
the covered part of the keyboard as the keyboard starts to move.

`covered()` on the `KeyboardDockRef` is how much of the screen bottom the keyboard covers beyond the
dock's place, for content that pads clear instead of moving; it updates once the keyboard has
moved. `backgroundColor` fills the bar and the inset under it. While another screen is pushed over
or presented from the dock's screen, the dock lets the keyboard go.

<!-- api: KeyboardDock -->

## Your own style

Style it with `class` or `style`. While the keyboard is up, the adjustment overrides the properties
it moves, as in React Native: `paddingBottom` (`padding`), `height` and `flex: 0` (`height`), the
inner view's `bottom` (`position`). So `style={{ flex: 1 }}` still shrinks in `height` mode; your
values return when the keyboard goes. `enabled` (default `true`) stops avoiding without removing the
view. With `behavior="position"`, `contentContainerStyle` styles the shifted inner view.

## Animation

The adjustment animates with the keyboard, as in React Native: the keyboard event's `duration` and
`easing` configure the next layout animation before the style change, so the two move together.

<!-- api: KeyboardAvoidingView -->
