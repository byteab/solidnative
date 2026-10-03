/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { Show } from '@solidnative/platform/solid';
import { ServiceScope, useService } from '@solidnative/device/solid';
import { Text, View, type NativeRef, type NativeStyle } from '@solidnative/components/solid';
import { ActivityIndicator } from '../src/solid/activity-indicator.ts';
import {
  KEYBOARD_CONTROLLER,
  KeyboardControllerProvider,
  provideKeyboardController,
} from '../src/solid/keyboard-controller.ts';

export function indicatorFixture() {
  const [size, setSize] = createSignal<'small' | 'large' | number>();
  const [animating, setAnimating] = createSignal<boolean>();
  const [hides, setHides] = createSignal<boolean>();
  const [color, setColor] = createSignal<string>();
  const [style, setStyle] = createSignal<NativeStyle>({ opacity: 0.5, marginTop: 8 });
  const [visible, setVisible] = createSignal(true);
  const [label, setLabel] = createSignal('Loading');
  const layouts: unknown[] = [];
  let ref!: NativeRef;
  function Scene() {
    return (
      <View testID="shell">
        <Show when={visible()}>
          <ActivityIndicator
            testID="indicator"
            id="loading-indicator"
            size={size()}
            animating={animating()}
            hidesWhenStopped={hides()}
            color={color()}
            style={style()}
            role="progressbar"
            aria-label={label()}
            aria-busy={animating() ?? true}
            onLayout={(event) => layouts.push(event.nativeEvent)}
            ref={(value) => (ref = value)}
          />
        </Show>
      </View>
    );
  }
  return {
    Scene,
    setSize,
    setAnimating,
    setHides,
    setColor,
    setStyle,
    setVisible,
    setLabel,
    layouts,
    ref: () => ref,
  };
}

export function keyboardProviderFixture(optIn = false) {
  const [enabled, setEnabled] = createSignal<boolean>();
  const [visible, setVisible] = createSignal(true);
  const [label, setLabel] = createSignal('first');
  const values = new Map<string, boolean>();
  const counts = { mounts: 0, cleanups: 0 };
  const errors: unknown[] = [];
  function Read(props: { name: string }) {
    values.set(props.name, useService(KEYBOARD_CONTROLLER));
    counts.mounts++;
    onCleanup(() => counts.cleanups++);
    return <Text testID={props.name}>{label()}</Text>;
  }
  function Scene() {
    return (
      <ServiceScope
        services={optIn ? [provideKeyboardController()] : []}
        onError={(e) => errors.push(e)}
      >
        <View testID="keyboard-shell">
          <Read name="outside" />
          <Show when={visible()}>
            <KeyboardControllerProvider enabled={enabled()}>
              <View testID="provider-child">
                <Read name="inside" />
                <ServiceScope>
                  <Read name="inherited" />
                </ServiceScope>
                <KeyboardControllerProvider enabled={false}>
                  <Read name="disabled" />
                </KeyboardControllerProvider>
              </View>
            </KeyboardControllerProvider>
          </Show>
          <Read name="sibling" />
        </View>
      </ServiceScope>
    );
  }
  return { Scene, setEnabled, setVisible, setLabel, values, counts, errors };
}

export function InvalidActivityIndicator() {
  // @ts-expect-error Named indicator sizes have a finite native mapping.
  return <ActivityIndicator size="huge" />;
}

export function InvalidKeyboardProvider() {
  // @ts-expect-error Controller installation is a boolean capability.
  return <KeyboardControllerProvider enabled="false" />;
}
