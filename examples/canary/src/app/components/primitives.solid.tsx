/** @jsxImportSource @solid-native/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputRef,
} from '@solid-native/components/solid';
import { ColorScheme, useService } from '@solid-native/device/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { palette } from '../palette-values.ts';
import { page } from '../screen-styles.ts';
const localImage = require('../../../assets/local.png');
const banner = { uri: 'https://example.invalid/banner.png' };

export function Primitives() {
  const scheme = useService(ColorScheme);
  const [on, setOn] = createSignal(true),
    [draft, setDraft] = createSignal(''),
    [longer, setLonger] = createSignal(''),
    [refreshing, setRefreshing] = createSignal(false);
  let notes: TextInputRef | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  onCleanup(() => {
    active = false;
    clearTimeout(timer);
  });
  const refresh = () => {
    if (!active) return;
    clearTimeout(timer);
    setRefreshing(true);
    if (active)
      timer = setTimeout(() => {
        if (active) setRefreshing(false);
      }, 1200);
  };
  return (
    <>
      <NativeHeader title="Primitives" />
      <ScrollView
        class="screen"
        contentContainerStyle={page.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        refreshControl={{
          get refreshing() {
            return refreshing();
          },
          onRefresh: refresh,
          get tintColor() {
            return palette[scheme.current()].textStrong;
          },
        }}
      >
        <View style={page.row}>
          <Switch value={on()} onValueChange={setOn} />
          <Text class="body">
            switch: <Text class="strong">{String(on())}</Text>
          </Text>
          <ActivityIndicator animating color="#3b6ef5" />
        </View>
        <TextInput
          class="field"
          value={draft()}
          onValueChange={setDraft}
          placeholder="type here"
          placeholderTextColor="#6c6c78"
          returnKeyType="next"
          autoCapitalize="words"
          onSubmitEditing={() => notes?.focus()}
        />
        <TextInput
          ref={(ref) => {
            notes = ref;
          }}
          class="field"
          value={longer()}
          onValueChange={setLonger}
          multiline
          placeholder="multiline, submit from the first field lands here"
          placeholderTextColor="#6c6c78"
        />
        <Text class="body">
          typed: <Text class="strong">{draft() || '-'}</Text>
        </Text>
        <View style={page.row}>
          <Image
            source={localImage}
            style={{ width: 44, height: 44, borderRadius: 6 }}
            alt="the local asset"
          />
          <Text class="body">local require() asset, sized by itself</Text>
        </View>
        <ImageBackground
          source={banner}
          style={{ height: 64, borderRadius: 10, overflow: 'hidden', justifyContent: 'center' }}
        >
          <Text class="body" style={{ paddingLeft: 12 }}>
            image-background
          </Text>
        </ImageBackground>
      </ScrollView>
    </>
  );
}
