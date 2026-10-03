/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup, createRenderEffect, createComputed } from 'solid-js';
import {
  ServiceScope,
  Keyboard,
  SafeArea,
  SCREEN_IN_FRONT,
  provideService,
  type KeyboardMetrics,
} from '@solidnative/device/solid';
import { View, Text } from '../src/solid/primitive.ts';
import { Presence } from '../src/solid/presence.ts';
import { TextInput } from '../src/solid/text-input.ts';
import { KeyboardDock, KeyboardLift, type KeyboardDockRef } from '../src/solid/keyboard-dock.ts';
import { provideKeyboardController } from '../src/solid/keyboard-controller.ts';
import type { TextInputRef } from '../src/solid/types.ts';

export function presenceFixture(
  options: { exited?: () => void; cleanup?: () => void; throwCleanup?: boolean } = {},
) {
  const [visible, setVisible] = createSignal(true),
    [label, setLabel] = createSignal('one');
  const calls: string[] = [];
  const Child = () => {
    calls.push('mount');
    onCleanup(() => {
      calls.push('dispose');
      options.cleanup?.();
    });
    createRenderEffect(() => {
      calls.push(`label:${label()}`);
    });
    if (options.throwCleanup)
      createComputed(() =>
        onCleanup(() => {
          throw new Error('cleanup failed');
        }),
      );
    return <Text testID="owned-child">{label()}</Text>;
  };
  const Scene = () => (
    <Presence
      testID="presence"
      when={visible()}
      enterClass="arriving"
      leaveClass="leaving"
      enterDuration={40}
      leaveDuration={60}
      onEntered={() => calls.push('entered')}
      onExited={() => {
        calls.push('exited');
        options.exited?.();
      }}
    >
      <Child />
    </Presence>
  );
  return { Scene, setVisible, setLabel, calls };
}
export function inputFixture() {
  const [value, setValue] = createSignal('kept'),
    [accept, setAccept] = createSignal(false);
  const [disabled, setDisabled] = createSignal(false),
    [readOnly, setReadOnly] = createSignal(false);
  const [metrics, setMetrics] = createSignal<KeyboardMetrics>({ height: 200, screenY: 300 });
  const events: unknown[] = [];
  let input!: TextInputRef;
  const Scene = () => (
    <ServiceScope
      services={[
        provideService(Keyboard, () => ({
          metrics,
          height: () => metrics().height,
          visible: () => true,
          dismiss() {},
        })),
      ]}
    >
      <TextInput
        testID="input"
        ref={(ref) => {
          input = ref;
        }}
        value={value()}
        onValueChange={(text) => {
          events.push(['proposal', text]);
          if (accept()) setValue(text);
        }}
        onChangeText={(text) => events.push(['text', text])}
        onChange={(event) => events.push(['change', event.nativeEvent.eventCount])}
        disabled={disabled()}
        readOnly={readOnly()}
        touched={true}
        invalid={true}
        onTouched={() => events.push('touched')}
        keyboardType="visible-password"
        returnKeyType="previous"
        selectTextOnFocus={true}
        caretHidden={false}
        contextMenuHidden={true}
        textAlign="right"
        allowFontScaling={false}
        maxFontSizeMultiplier={2}
        clearButtonMode="always"
        clearTextOnFocus={true}
        enablesReturnKeyAutomatically={true}
        keyboardAppearance="dark"
        passwordRules="minlength: 8;"
        spellCheck={false}
        smartInsertDelete={false}
        dataDetectorTypes={['link']}
        cursorColor="red"
        selectionHandleColor="blue"
        textAlignVertical="top"
        importantForAutofill="yes"
        showSoftInputOnFocus={false}
        disableFullscreenUI={true}
        inlineImageLeft="mail"
        inlineImagePadding={10}
        textBreakStrategy="balanced"
        onKeyPress={(event) => events.push(['key', event.nativeEvent.key])}
        onContentSizeChange={(event) => events.push(['size', event.nativeEvent.contentSize.height])}
        onScroll={(event) => events.push(['scroll', event.nativeEvent.contentOffset.y])}
        onSubmitEditing={(event) => events.push(['submit', event.nativeEvent.text])}
        onEndEditing={(event) => events.push(['end', event.nativeEvent.text])}
        onBlur={() => events.push('blur')}
        onFocus={() => events.push('focus')}
      />
    </ServiceScope>
  );
  return {
    Scene,
    events,
    setAccept,
    setDisabled,
    setReadOnly,
    setMetrics,
    setValue,
    input: () => input,
  };
}
export function dockFixture(controller = true) {
  const [metrics, setMetrics] = createSignal<KeyboardMetrics>({ height: 0 });
  const [inset, setInset] = createSignal(20),
    [front, setFront] = createSignal(true);
  const [dock, setDock] = createSignal<KeyboardDockRef>();
  let dismisses = 0;
  const Body = () => {
    const lift = KeyboardLift(dock);
    return (
      <View>
        <View testID="transcript" style={{ paddingBottom: 5 }} ref={lift} />
        <KeyboardDock testID="dock" inputNativeID="composer" ref={setDock}>
          <TextInput nativeID="composer" />
        </KeyboardDock>
      </View>
    );
  };
  const Scene = () => (
    <ServiceScope
      services={[
        provideKeyboardController(controller),
        provideService(SCREEN_IN_FRONT, () => front),
        provideService(Keyboard, () => ({
          metrics,
          height: () => metrics().height,
          visible: () => metrics().height > 0,
          dismiss() {
            dismisses++;
          },
        })),
        provideService(SafeArea, () => ({
          known: () => true,
          insets: () => ({ top: 0, left: 0, right: 0, bottom: inset() }),
          frame: () => ({ x: 0, y: 0, width: 400, height: 800 }),
          report() {},
        })),
      ]}
    >
      <Body />
    </ServiceScope>
  );
  return { Scene, dock, setMetrics, setInset, setFront, dismisses: () => dismisses };
}
