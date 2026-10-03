/** @jsxImportSource @solid-native/platform/solid */
import { createRenderEffect, createSignal, onCleanup } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { ExpoImage, type ExpoImageSource } from '@solid-native/expo/solid';
import { Clipboard } from '@solid-native/expo/solid/clipboard';
import { FileSystem } from '@solid-native/expo/solid/file-system';
import { Haptics } from '@solid-native/expo/solid/haptics';
import { useHostEngine, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';
import sheet from './expo.native.css';
const localAsset = require('../../../assets/local.png');

export function ExpoPage() {
  const clipboard = useService(Clipboard),
    files = useService(FileSystem),
    haptics = useService(Haptics),
    front = useService(SCREEN_IN_FRONT);
  const local = [useHostEngine().resolveAsset(localAsset) as ExpoImageSource];
  const remote = [{ uri: 'https://picsum.photos/seed/solid-native/900/500' }];
  const [status, setStatus] = createSignal('Nothing copied yet.'),
    [file, setFile] = createSignal('No file written yet.');
  let active = true,
    request = 0;
  createRenderEffect(() => {
    if (!front()) request++;
  });
  onCleanup(() => {
    active = false;
    request++;
  });
  const current = (token: number) => active && front() && request === token;
  const copy = async () => {
    if (!active || !front()) return;
    const token = ++request,
      stamp = `Solid Native at ${new Date().toLocaleTimeString()}`;
    try {
      await clipboard.write(stamp);
      if (current(token)) setStatus(`Copied: ${stamp}`);
    } catch (error) {
      if (current(token)) setStatus(`Failed: ${String(error)}`);
    }
  };
  const paste = async () => {
    if (!active || !front()) return;
    const token = ++request;
    try {
      const text = await clipboard.read();
      if (current(token)) setStatus(text ? `Pasted: ${text}` : 'The clipboard is empty.');
    } catch (error) {
      if (current(token)) setStatus(`Failed: ${String(error)}`);
    }
  };
  const writeFile = () => {
    if (!active || !front()) return;
    try {
      const target = files.cache('canary.txt');
      files.write(target, `written at ${new Date().toISOString()}`);
      if (active && front()) setFile(`${target.textSync()} (${target.size} bytes)`);
    } catch (error) {
      if (active && front()) setFile(`Failed: ${String(error)}`);
    }
  };
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Expo modules" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          Expo's native modules as scoped services. React is in the bundle, because react-native
          imports it; it is never in the render path.
        </Text>
        <Text class="heading">expo-image</Text>
        <Text class="body">A Fabric view, registered by name and driven by the engine.</Text>
        <ExpoImage
          source={remote}
          contentFit="cover"
          transition={{ duration: 400 }}
          class="image"
        />
        <ExpoImage source={local} contentFit="contain" class="image" />
        <Text class="heading">Clipboard</Text>
        <Text class="body">{status()}</Text>
        <Text class="hint">The pasteboard has changed {clipboard.changes()} times.</Text>
        <View style={page.row}>
          <Pressable
            class="card"
            style={{ flex: 1 }}
            onPress={() => {
              void copy();
            }}
          >
            <Text class="button-label">Copy</Text>
          </Pressable>
          <Pressable
            class="card"
            style={{ flex: 1 }}
            onPress={() => {
              void paste();
            }}
          >
            <Text class="button-label">Paste</Text>
          </Pressable>
        </View>
        <Text class="hint">
          The count is a signal over an Expo EventEmitter. Reading is a separate call because on iOS
          16 and later it is what prompts the user for permission.
        </Text>
        <Text class="heading">File system</Text>
        <Text class="body">{file()}</Text>
        <Pressable class="button" onPress={writeFile}>
          <Text class="button-label">Write and read back</Text>
        </Pressable>
        <Text class="heading">Haptics</Text>
        <Pressable
          class="button"
          onPress={() => {
            if (active && front()) haptics.impact();
          }}
        >
          <Text class="button-label">{haptics.available ? 'Impact' : 'Not installed'}</Text>
        </Pressable>
        <Text class="hint">
          Fire and forget, and silent on a simulator, which has no Taptic Engine.
        </Text>
      </ScrollView>
    </>
  ));
}
