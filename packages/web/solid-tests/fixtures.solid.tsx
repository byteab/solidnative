/** @jsxImportSource @solid-native/web/solid */
/**
 * The shared Solid components the jsdom suite mounts through `mountBrowser`, one factory per
 * scenario. Each returns its own signals beside the view, so a test reads and drives the state
 * the component renders from.
 */
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
} from 'solid-js';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  bindFormField,
  createForm,
  formMinLength,
  formRequired,
  type FormError,
  type LayoutEvent,
  type ScrollViewRef,
} from '@solid-native/components/solid';
import { Icon } from '@solid-native/icons';
import { Direction, Screen, StatusBar, createServiceToken, useService } from '@solid-native/device';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solid-native/web/solid';
import card from './card.native.css';
import badge from './badge.native.css';
import themed from './themed.native.css';

/** A real text field, a real toggle, one that refuses its flip, and an image background. */
export function controls() {
  const [text, setText] = createSignal('');
  const [on, setOn] = createSignal(false);
  const [kept, setKept] = createSignal(false);
  const view = () => (
    <>
      <TextInput value={text()} onValueChange={setText} placeholder="Say something" />
      <Switch value={on()} onValueChange={setOn} />
      <Switch nativeID="refusing" value={kept()} onValueChange={() => setKept(false)} />
      <ImageBackground
        source={{ uri: 'https://example.com/photo.png' }}
        style={{ width: 120, height: 80 }}
      />
    </>
  );
  return { text, setText, on, setOn, kept, view };
}

/** A styled field, a validated field, and a multiline one, as a design system builds them. */
export function textFields() {
  const [value, setValue] = createSignal('');
  const [off, setOff] = createSignal(false);
  const [validatedValue, setValidatedValue] = createSignal('');
  const [invalid, setInvalid] = createSignal(false);
  const [touched, setTouched] = createSignal(false);
  const [touchedFired, setTouchedFired] = createSignal(false);
  const [notes, setNotes] = createSignal('');
  const [plainFocused, setPlainFocused] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  const view = () => (
    <>
      <View
        id="plain"
        class="border border-gray-300 focus-visible:border-blue-500"
        data-disabled={off() ? '' : undefined}
        data-focus={plainFocused() ? '' : undefined}
      >
        <TextInput
          onFocus={() => setPlainFocused(true)}
          onBlur={() => setPlainFocused(false)}
          value={value()}
          onValueChange={setValue}
          placeholder="you@example.com"
          editable={!off()}
        />
      </View>
      <View
        id="validated"
        data-invalid={invalid() && touched() ? '' : undefined}
        data-focus={focused() ? '' : undefined}
      >
        <TextInput
          value={validatedValue()}
          onValueChange={setValidatedValue}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setTouchedFired(true);
          }}
        />
      </View>
      <View id="notes">
        <TextInput value={notes()} onValueChange={setNotes} multiline numberOfLines={3} />
      </View>
    </>
  );
  return { value, off, setOff, setInvalid, setTouched, touchedFired, notes, view };
}

/** One real hidden control and a row of display-only glyphs computed from its length. */
export function otp() {
  const [code, setCode] = createSignal('');
  const [length] = createSignal(4);
  const [disabled, setDisabled] = createSignal(false);
  const completions: string[] = [];
  const slots = createMemo(() => {
    const characters = [...code()].slice(0, length());
    return Array.from({ length: length() }, (_, index) => characters[index] ?? '');
  });
  const view = () => {
    createEffect(() => {
      if (code().length === length()) completions.push(code());
    });
    return (
      <View id="otp">
        <TextInput
          data-slot="input-otp-field"
          value={code()}
          onValueChange={setCode}
          maxLength={length()}
          editable={!disabled()}
        />
        <View style={{ flexDirection: 'row' }}>
          <For each={slots()}>{(char) => <TextInput value={char} editable={false} />}</For>
        </View>
      </View>
    );
  };
  return { code, setDisabled, completions, view };
}

/** A required email and an always-on minimum length, bound to the controls they validate. */
export function fieldForms() {
  const form = createForm(
    { email: '', notes: 'hi' },
    {
      email: { validate: formRequired({ message: 'Email is required' }) },
      notes: { validate: formMinLength(5, { message: 'Say a little more' }) },
    },
  );
  const messages = (errors: readonly FormError[]) => [
    ...new Set(errors.map((error) => error.message ?? error.kind)),
  ];
  const view = () => (
    <>
      <View id="email-field">
        <View id="email">
          <TextInput {...bindFormField(form.fields.email)} placeholder="you@example.com" />
        </View>
        <View id="email-error">
          <Show when={form.fields.email.touched()}>
            <For each={messages(form.fields.email.errors())}>
              {(message) => <Text>{message}</Text>}
            </For>
          </Show>
        </View>
      </View>
      <View id="notes-field">
        <View id="notes">
          <TextInput {...bindFormField(form.fields.notes)} multiline />
        </View>
        <View id="notes-error">
          <For each={messages(form.fields.notes.errors())}>
            {(message) => <Text>{message}</Text>}
          </For>
        </View>
      </View>
    </>
  );
  return { form, view };
}

/** An outline icon from markup: inherited paint, explicit overrides, and every shape name. */
export const ICON_MARKUP = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M4 4h16v16H4z" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="12" cy="12" r="3" fill="#ff9f0a" fill-rule="evenodd" clip-rule="evenodd" />
    <rect x="2" y="2" width="4" height="4" fill="none" stroke-dasharray="4 2" transform="translate(3,4)" />
    <line x1="2" y1="20" x2="22" y2="20" stroke="#e5e7eb" />
  </svg>
`;
export const icon = () => <Icon id="icon-root" svg={ICON_MARKUP} size={32} color="#111827" />;

/** A horizontal scroll view driven by its imperative ref. */
export function scrollView() {
  let ref: ScrollViewRef | undefined;
  const view = () => (
    <View id="screen">
      <ScrollView id="content" horizontal ref={(next) => (ref = next)}>
        <For each={[1, 2, 3]}>
          {(slide) => (
            <View id={`item-${slide}`}>
              <Text>{String(slide)}</Text>
            </View>
          )}
        </For>
      </ScrollView>
      <Pressable id="jump" onPress={() => ref!.scrollTo({ x: 300 })}>
        <Text>Jump</Text>
      </Pressable>
      <Pressable id="jump-instant" onPress={() => ref!.scrollTo({ x: 600, animated: false })}>
        <Text>Jump instantly</Text>
      </Pressable>
      <Pressable id="jump-end" onPress={() => ref!.scrollToEnd({ animated: false })}>
        <Text>Jump to end</Text>
      </Pressable>
    </View>
  );
  return { view };
}

/** A pressable inside a scroll view inside another pressable: three candidate responders. */
export function nestedPress() {
  const [log, setLog] = createSignal<string[]>([]);
  const view = () => (
    <Pressable onPress={() => setLog((entries) => [...entries, 'outer'])}>
      <Text>outer</Text>
      <ScrollView>
        <Pressable onPress={() => setLog((entries) => [...entries, 'inner'])}>
          <Text>inner</Text>
        </Pressable>
      </ScrollView>
    </Pressable>
  );
  return { log, view };
}

/** `onLayout` on a view nested one level inside another. */
export function layoutFrame() {
  const [frame, setFrame] = createSignal<LayoutEvent['nativeEvent']['layout'] | null>(null);
  const view = () => (
    <View id="outer">
      <View id="inner" onLayout={(event) => setFrame(event.nativeEvent.layout)} />
    </View>
  );
  return { frame, view };
}

/** A button to place and to dim: the measure and styling cases. */
export function button() {
  const [disabled, setDisabled] = createSignal(false);
  const [presses, setPresses] = createSignal(0);
  const view = () => (
    <Pressable
      id="trigger"
      accessibilityRole="button"
      class="transition-opacity disabled:opacity-50"
      data-disabled={disabled() ? '' : undefined}
      disabled={disabled()}
      onPress={() => setPresses((n) => n + 1)}
    >
      <Text>Delete</Text>
    </Pressable>
  );
  return { setDisabled, presses, view };
}

/** The device services a component reads, as the browser answers them. */
export function device() {
  let screen!: Screen;
  let direction!: Direction;
  const view = () => {
    screen = useService(Screen);
    direction = useService(Direction);
    return (
      <View>
        <Text>{String(screen.window().width)}</Text>
      </View>
    );
  };
  return { screen: () => screen, direction: () => direction, view };
}

/** A component that claims a status bar style, which a browser tab does not have. */
export function statusBar() {
  return () => {
    useService(StatusBar).set({ style: 'dark' });
    return <Text>A light screen</Text>;
  };
}

/** One of each control, logging every event in the order it arrived. */
export function events() {
  const [log, setLog] = createSignal<readonly string[]>([]);
  const [chat, setChat] = createSignal('');
  const [notes, setNotes] = createSignal('');
  const [contentSize, setContentSize] = createSignal<{ width: number; height: number } | null>(
    null,
  );
  const [restedAt, setRestedAt] = createSignal<number | null>(null);
  const add = (event: string) => () => setLog((events) => [...events, event]);
  const view = () => (
    <>
      <Pressable
        id="button"
        accessibilityRole="button"
        onPressIn={add('pressIn')}
        onPress={add('press')}
        onPressOut={add('pressOut')}
        onLongPress={add('longPress')}
      >
        <Text>Save</Text>
      </Pressable>
      <TextInput
        id="line"
        onFocus={add('focus')}
        onSubmitEditing={add('submitEditing')}
        onEndEditing={add('endEditing')}
        onBlur={add('blur')}
      />
      <TextInput
        id="chat"
        multiline
        submitBehavior="submit"
        value={chat()}
        onValueChange={setChat}
        onSubmitEditing={add('submitEditing')}
      />
      <TextInput id="notes" multiline value={notes()} onValueChange={setNotes} />
      <ScrollView
        id="strip"
        horizontal
        style={{ width: 100, height: 50 }}
        onContentSizeChange={setContentSize}
        onMomentumScrollEnd={(event) => setRestedAt(event.nativeEvent.contentOffset.x)}
      >
        <View style={{ width: 80, height: 40 }} />
        <View style={{ width: 80, height: 40 }} />
      </ScrollView>
      <ScrollView id="frozen" scrollEnabled={false} style={{ height: 20, flexGrow: 0 }}>
        <View style={{ height: 80 }} />
      </ScrollView>
    </>
  );
  return { log, setLog, chat, notes, contentSize, restedAt, view };
}

/** Two components that both style a `.label`, each from its own compiled sheet. */
export const Card = () =>
  withNativeStyles(card, () => (
    <Text id="card-label" class="label">
      card
    </Text>
  ));
export const Badge = () =>
  withNativeStyles(badge, () => (
    <Text id="badge-label" class="label">
      badge
    </Text>
  ));

/**
 * A component's own sheet: scoped rules, `:host`, custom properties written and bound by the
 * names they were written with.
 */
export function Themed(props: { id?: string }) {
  return withNativeStyles(themed, () => (
    <view ref={(node) => setNativeStyleHost(node, themed)} nativeID={props.id ?? 'themed-host'}>
      <View id="themed-card" class="card" />
      <View
        id="bound"
        class="bound"
        style={{ '--tint': 'rgb(0, 0, 255)', '--brandTint': 'rgb(0, 0, 255)', '--columns': 3 }}
      />
    </view>
  ));
}

/** A host-app service the host and its islands should share, not each own a copy of. */
export const Tally = createServiceToken('test.tally', () => {
  const [count, setCount] = createSignal(0);
  return { count, increment: () => setCount((n) => n + 1) };
});
/** Provided by the host page above where an island is mounted. */
export const HostName = createContext('nobody');
export const Section = createContext('none');

export function IslandCounter() {
  const tally = useService(Tally);
  const name = useContext(HostName);
  return (
    <Pressable id="island-press" onPress={tally.increment}>
      <Text id="island-label">{`${name}: ${tally.count()}`}</Text>
    </Pressable>
  );
}

export function IslandDetails(props: { onScreen?: (screen: Screen) => void }) {
  props.onScreen?.(useService(Screen));
  return (
    <View>
      <Text id="details-section">{useContext(Section)}</Text>
      <Pressable
        id="details-fail"
        onPress={() => {
          throw new Error('island press failed');
        }}
      >
        <Text>Fail</Text>
      </Pressable>
    </View>
  );
}

/** Counts its own disposals, so a test can tell an input update from a remount. */
export const disposals = { count: 0 };
export function IslandBadge(props: { label: string; onPressed?: (label: string) => void }) {
  onCleanup(() => disposals.count++);
  return (
    <Pressable id="badge" onPress={() => props.onPressed?.(props.label)}>
      <Text id="badge-label">{props.label}</Text>
    </Pressable>
  );
}
export function OtherIslandBadge(props: { label: string; onPressed?: (label: string) => void }) {
  onCleanup(() => disposals.count++);
  return <Text id="other-label">{`Other ${props.label}`}</Text>;
}
