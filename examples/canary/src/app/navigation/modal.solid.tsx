/** @jsxImportSource @solid-native/platform/solid */
import { Modal, Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';
import { Show, withNativeStyles } from '@solid-native/platform/solid';
import { createSignal } from 'solid-js';
import styles from './modal.native.css';

export function ModalPage() {
  const [open, setOpen] = createSignal(false);
  const modalSheet = {
    flex: 1,
    margin: 40,
    marginTop: 160,
    padding: 24,
    gap: 16,
    borderRadius: 14,
    justifyContent: 'center',
  };
  return withNativeStyles(styles, () => (
    <>
      <NativeHeader title="Modal" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          A hidden modal is left out of the native tree, so the screen under it keeps its touches.
        </Text>

        <Pressable
          class="button"
          onPress={() => {
            setOpen(true);
          }}
        >
          <Text class="button-label">open modal</Text>
        </Pressable>

        <Show when={open()}>
          <Modal transparent={true} animationType="fade">
            <View class="sheet" style={modalSheet}>
              <Text class="heading">A native modal</Text>
              <Pressable
                class="button"
                onPress={() => {
                  setOpen(false);
                }}
              >
                <Text class="button-label">close</Text>
              </Pressable>
            </View>
          </Modal>
        </Show>
      </ScrollView>
    </>
  ));
}
