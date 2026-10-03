/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import {
  ServiceScope,
  Direction,
  Keyboard,
  LayoutAnimation,
  provideService,
  type KeyboardMetrics,
} from '@solid-native/device/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import type { StyleSheet } from '@solid-native/fabric';
import { View, Text } from '../src/solid/primitive.ts';
import { Image } from '../src/solid/image.ts';
import { ImageBackground } from '../src/solid/image-background.ts';
import { Modal } from '../src/solid/modal.ts';
import { InputAccessoryView } from '../src/solid/input-accessory-view.ts';
import { TouchableOpacity } from '../src/solid/touchable-opacity.ts';
import { KeyboardAvoidingView } from '../src/solid/keyboard-avoiding-view.ts';
import { TextInput } from '../src/solid/text-input.ts';

export function componentsFixture() {
  const [alt, setAlt] = createSignal<string | undefined>('description');
  const [visible, setVisible] = createSignal(true);
  const [transparent, setTransparent] = createSignal(false);
  const [size, setSize] = createSignal(90);
  const [opacity, setOpacity] = createSignal(0.7);
  const [rtl, setRtl] = createSignal(false);
  const [metrics, setMetrics] = createSignal<KeyboardMetrics>({ height: 0 });
  const events: string[] = [];
  const animations: object[] = [];
  const sheet: StyleSheet = {
    rules: [
      {
        compounds: [{ classes: ['faded'] }],
        combinators: [],
        specificity: 1000,
        order: 0,
        declarations: { opacity: 0.6 },
      },
    ],
  };
  const Scene = () =>
    withNativeStyles(sheet, () => (
      <ServiceScope
        services={[
          provideService(Direction, () => ({ rtl, current: () => (rtl() ? 'rtl' : 'ltr') })),
          provideService(Keyboard, () => ({
            metrics,
            height: () => metrics().height,
            visible: () => metrics().height > 0,
            dismiss: () => {},
          })),
          provideService(LayoutAnimation, () => ({
            animate: async (change, options) => {
              animations.push(options ?? {});
              change();
            },
          })),
        ]}
      >
        <View>
          <Image
            testID="image"
            source={{ uri: 'local', width: 30, height: 40, headers: { Existing: 'yes' } }}
            alt={alt()}
            onLoad={() => events.push('load')}
            crossOrigin="use-credentials"
            referrerPolicy="no-referrer"
          />
          <Image
            testID="sources"
            source={{ uri: 'first' }}
            src="fallback"
            srcSet="hi 2x, bad NaNx"
          />
          <ImageBackground
            testID="background"
            source={{ uri: 'back', width: 1, height: 2 }}
            style={[{ width: size() }, { height: 70 }]}
            imageStyle={{ opacity: 0.5 }}
          >
            <Text testID="front">front</Text>
          </ImageBackground>
          <Modal
            testID="modal"
            visible={visible()}
            transparent={transparent()}
            onRequestClose={() => events.push('close')}
          >
            <Text>modal body</Text>
          </Modal>
          <InputAccessoryView
            testID="accessory"
            nativeID="toolbar"
            backgroundColor="red"
            style={{ position: 'relative' }}
          >
            <Text>toolbar</Text>
          </InputAccessoryView>
          <TextInput testID="accessory-input" inputAccessoryViewID="toolbar" />
          <TouchableOpacity
            testID="touch"
            style={{ opacity: opacity() }}
            minPressDuration={0}
            onPress={() => events.push('press')}
          >
            <Text>touch</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="class-touch" class="faded" />
          <KeyboardAvoidingView testID="avoid">
            <Text>form</Text>
          </KeyboardAvoidingView>
        </View>
      </ServiceScope>
    ));
  return {
    Scene,
    setAlt,
    setVisible,
    setTransparent,
    setSize,
    setOpacity,
    setRtl,
    setMetrics,
    events,
    animations,
  };
}
