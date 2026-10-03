/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import {
  KeyboardDock,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputRef,
} from '@solidnative/components/solid';
import { ColorScheme, useService } from '@solidnative/device/solid';
import { DeviceOrientation } from '@solidnative/expo/solid/orientation';
import { For, Show, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader, useNavigation } from '@solidnative/router/solid';
import { palette } from '../palette-values.ts';
import { NoteDrafts } from './note-drafts.solid.ts';
import styles from './keyboard-lab.native.css';

export function KeyboardLab() {
  const drafts = useService(NoteDrafts);
  const colors = useService(ColorScheme);
  const nav = useNavigation();
  const orientation = useService(DeviceOrientation);
  const [quick, setQuick] = createSignal('');
  const [landscape, setLandscape] = createSignal(false);
  let amount: TextInputRef | undefined;
  let unlock: (() => void) | undefined;
  onCleanup(() => unlock?.());
  const rotate = () => {
    unlock?.();
    const next = !landscape();
    unlock = orientation.lock(next ? 'landscape' : 'portrait');
    setLandscape(next);
  };
  const openSheet = () => {
    void nav.present('/keyboard/sheet', {
      as: 'formSheet',
      presentation: { sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true },
    });
  };
  return withNativeStyles(styles, () => (
    <>
      <NativeHeader title="Keyboard" />
      <View class="screen">
        <ScrollView
          class="page"
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 80 }}
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          <Text class="hint">
            Every field here should end up clear of the keyboard, with no code measuring it.
          </Text>
          <Pressable class="button" accessibilityRole="button" onPress={openSheet}>
            <Text class="button-label">Edit a note in a sheet</Text>
          </Pressable>
          <Pressable class="card" accessibilityRole="button" onPress={rotate}>
            <Text class="button-label">
              {landscape() ? 'Back to portrait' : 'Rotate to landscape'}
            </Text>
          </Pressable>
          <Show when={drafts.saved()}>
            {(saved) => (
              <Text class="body" accessibilityRole="text">
                Saved: {saved()}
              </Text>
            )}
          </Show>
          <Text class="section">Keyboards of different heights</Text>
          <TextInput
            class="field"
            accessibilityLabel="Email"
            keyboardType="email-address"
            placeholder="Email"
            returnKeyType="next"
            onSubmitEditing={() => amount?.focus()}
          />
          <TextInput
            ref={(ref) => {
              amount = ref;
            }}
            class="field"
            accessibilityLabel="Amount"
            keyboardType="decimal-pad"
            placeholder="Amount"
          />
          <TextInput
            class="field"
            accessibilityLabel="Phone"
            keyboardType="phone-pad"
            placeholder="Phone"
          />
          <TextInput
            class="field"
            accessibilityLabel="Website"
            keyboardType="url"
            placeholder="Website"
          />
          <Text class="section">Fields in a carousel</Text>
          <ScrollView
            horizontal
            contentContainerStyle={{ gap: 12 }}
            showsHorizontalScrollIndicator={false}
          >
            <For each={['Monday', 'Tuesday', 'Wednesday', 'Thursday']}>
              {(card) => (
                <View class="card carousel-card">
                  <Text class="body">{card}</Text>
                  <TextInput class="field" accessibilityLabel={`${card} note`} placeholder="Note" />
                </View>
              )}
            </For>
          </ScrollView>
          <For each={Array.from({ length: 8 }, (_, i) => i + 1)}>
            {(row) => (
              <View class="card">
                <Text class="hint">Row {row}</Text>
              </View>
            )}
          </For>
          <Text class="section">The last field on the page</Text>
          <TextInput class="field" accessibilityLabel="Last field" placeholder="Last field" />
        </ScrollView>
        <KeyboardDock
          backgroundColor={palette[colors.current()].screen}
          inputNativeID="keyboard-quick-note"
        >
          <View class="dock">
            <TextInput
              class="field dock-field"
              nativeID="keyboard-quick-note"
              accessibilityLabel="Quick note"
              placeholder="Quick note"
              value={quick()}
              onValueChange={setQuick}
            />
            <Text class="hint">{quick().length}</Text>
          </View>
        </KeyboardDock>
      </View>
    </>
  ));
}
