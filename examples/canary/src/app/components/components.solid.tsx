/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputRef,
} from '@solidnative/components/solid';
import { Show } from '@solidnative/platform/solid';
import { NativeHeader } from '@solidnative/router/solid';
import { page } from '../screen-styles.ts';

export function ComponentsPage() {
  const [outer, setOuter] = createSignal(0),
    [inner, setInner] = createSignal(0),
    [shortPresses, setShortPresses] = createSignal(0),
    [longPresses, setLongPresses] = createSignal(0),
    [textPresses, setTextPresses] = createSignal(0),
    [plain, setPlain] = createSignal(false),
    [typed, setTyped] = createSignal(''),
    [lastChange, setLastChange] = createSignal(''),
    [focuses, setFocuses] = createSignal(0),
    [blurs, setBlurs] = createSignal(0),
    [submits, setSubmits] = createSignal(0),
    [modalOpen, setModalOpen] = createSignal(false),
    [shows, setShows] = createSignal(0),
    [closes, setCloses] = createSignal(0),
    [dismisses, setDismisses] = createSignal(0),
    [loaded, setLoaded] = createSignal(''),
    [errored, setErrored] = createSignal(0);
  let field: TextInputRef | undefined;
  return (
    <>
      <NativeHeader title="Components" />
      <ScrollView
        class="screen"
        contentContainerStyle={page.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          class="card"
          accessibilityLabel="Outer row"
          onPress={() => setOuter(outer() + 1)}
        >
          <Text class="body">outer row</Text>
          <Pressable
            class="button"
            accessibilityLabel="Inner button"
            onPress={() => setInner(inner() + 1)}
          >
            <Text class="button-label">inner button</Text>
          </Pressable>
        </Pressable>
        <Text class="body">
          outer {outer()} inner {inner()}
        </Text>
        <Pressable
          class="card"
          accessibilityLabel="Hold counter"
          onPress={() => setShortPresses(shortPresses() + 1)}
          onLongPress={() => setLongPresses(longPresses() + 1)}
        >
          <Text class="button-label">hold me</Text>
        </Pressable>
        <Text class="body">
          short {shortPresses()} long {longPresses()}
        </Text>
        <Text
          class="body"
          accessibilityLabel="Component text press"
          onPress={() => setTextPresses(textPresses() + 1)}
        >
          tap this text
        </Text>
        <Text class="body">text presses {textPresses()}</Text>
        <View style={page.row}>
          <Switch value={false} accessibilityLabel="Refused switch" />
          <Text class="body">refused switch model false</Text>
        </View>
        <View style={page.row}>
          <Switch value={plain()} onValueChange={setPlain} accessibilityLabel="Plain switch" />
          <Text class="body">plain switch {String(plain())}</Text>
        </View>
        <TextInput
          ref={(ref) => {
            field = ref;
          }}
          class="field"
          value={typed()}
          onValueChange={setTyped}
          maxLength={5}
          placeholder="five at most"
          placeholderTextColor="#6c6c78"
          accessibilityLabel="Component input"
          onChangeText={setLastChange}
          onFocus={() => setFocuses(focuses() + 1)}
          onBlur={() => setBlurs(blurs() + 1)}
          onSubmitEditing={() => setSubmits(submits() + 1)}
        />
        <Text class="body">
          typed [{typed()}] change [{lastChange()}] focus {focuses()} blur {blurs()} submit{' '}
          {submits()}
        </Text>
        <View style={page.row}>
          <Pressable class="card" onPress={() => field?.clear()}>
            <Text class="button-label">clear field</Text>
          </Pressable>
          <Pressable class="card" onPress={() => setTyped('code')}>
            <Text class="button-label">set field</Text>
          </Pressable>
          <Pressable class="card" onPress={() => field?.blur()}>
            <Text class="button-label">blur field</Text>
          </Pressable>
        </View>
        <Pressable class="button" onPress={() => setModalOpen(true)}>
          <Text class="button-label">open plain modal</Text>
        </Pressable>
        <Text class="body">
          modal show {shows()} requestClose {closes()} dismiss {dismisses()}
        </Text>
        <View style={page.row}>
          <Image
            source={{ uri: 'https://reactnative.dev/img/tiny_logo.png' }}
            style={{ width: 50, height: 50 }}
            alt="a remote image"
            onLoad={(event) => {
              const source = event.nativeEvent.source;
              setLoaded(source ? `${source.width}x${source.height}` : 'no source');
            }}
            onError={() => setErrored(errored() + 1)}
          />
          <Image
            source={{ uri: 'https://example.invalid/missing.png' }}
            style={{ width: 50, height: 50 }}
            onError={() => setErrored(errored() + 1)}
          />
          <ActivityIndicator size={50} color="#3b6ef5" />
        </View>
        <Text class="body">
          image load [{loaded()}] errors {errored()}
        </Text>
      </ScrollView>
      <Show when={modalOpen()}>
        <Modal
          animationType="slide"
          onRequestClose={() => {
            setCloses(closes() + 1);
            setModalOpen(false);
          }}
          onShow={() => setShows(shows() + 1)}
          onDismiss={() => setDismisses(dismisses() + 1)}
        >
          <View style={{ flex: 1, padding: 40, paddingTop: 120, gap: 16 }}>
            <Text style={{ color: '#000000', fontSize: 18 }}>A plain modal, on white</Text>
            <Pressable class="button" onPress={() => setModalOpen(false)}>
              <Text class="button-label">close modal</Text>
            </Pressable>
          </View>
        </Modal>
      </Show>
    </>
  );
}
