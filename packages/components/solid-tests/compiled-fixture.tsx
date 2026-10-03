/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal, getOwner, onCleanup, type Owner } from 'solid-js';
import { Show } from '@solid-native/platform/solid';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Switch,
  type NativeRef,
  type TextInputRef,
  type TextSelection,
} from '@solid-native/components/solid';

export function primitiveFixture() {
  const [disabled, setDisabled] = createSignal(false);
  const [label, setLabel] = createSignal<string | undefined>('alias');
  const [visible, setVisible] = createSignal(true);
  const [delay, setDelay] = createSignal(0);
  const [long, setLong] = createSignal(false);
  const [explicit, setExplicit] = createSignal<string | undefined>('explicit');
  const calls: string[] = [];
  let ref!: NativeRef;
  function Scene() {
    return (
      <View
        testID="container"
        id="identity"
        aria-label={label()}
        accessibilityLabel={explicit()}
        aria-hidden={disabled()}
      >
        <Text testID="paragraph">
          before <Text testID="nested">{label()}</Text>
        </Text>
        <Show when={visible()}>
          <Pressable
            testID="button"
            disabled={disabled()}
            minPressDuration={0}
            delayPressIn={delay()}
            delayLongPress={5}
            onPress={() => calls.push('press')}
            onPressIn={() => calls.push('in')}
            onPressOut={() => calls.push('out')}
            onLongPress={long() ? () => calls.push('long') : undefined}
            style={(state) => ({ opacity: state.pressed ? 0.5 : 1 })}
            ref={(value) => {
              ref = value;
            }}
          >
            {(state) => <Text>{state.pressed ? 'pressed' : 'idle'}</Text>}
          </Pressable>
        </Show>
        <Pressable testID="outer" minPressDuration={0} onPress={() => calls.push('outer')}>
          <Pressable testID="inner" minPressDuration={0} onPress={() => calls.push('inner')}>
            <Text>nested</Text>
          </Pressable>
        </Pressable>
      </View>
    );
  }
  return {
    Scene,
    setDisabled,
    setLabel,
    setVisible,
    setDelay,
    setLong,
    setExplicit,
    calls,
    ref: () => ref,
  };
}

export function inputFixture(
  options: {
    value?: string;
    controlled?: boolean;
    mode?: 'accept' | 'reject' | 'uppercase' | 'throw';
    selection?: TextSelection;
  } = {},
) {
  const [value, setValue] = createSignal<string | undefined>(
    options.controlled ? (options.value ?? '') : undefined,
  );
  const [mode, setMode] = createSignal(options.mode ?? 'accept');
  const [disabled, setDisabled] = createSignal(false);
  const [readOnly, setReadOnly] = createSignal(false);
  const [touched, setTouched] = createSignal(false);
  const [invalid, setInvalid] = createSignal(false);
  const [visible, setVisible] = createSignal(true);
  const [selection, setSelection] = createSignal(options.selection);
  const proposals: string[] = [];
  let ref!: TextInputRef;
  function Scene() {
    return (
      <View>
        <Show when={visible()}>
          <TextInput
            testID="input"
            value={value()}
            defaultValue={options.value}
            disabled={disabled()}
            readOnly={readOnly()}
            touched={touched()}
            invalid={invalid()}
            selection={selection()}
            onTouched={() => setTouched(true)}
            ref={(value) => {
              ref = value;
            }}
            onValueChange={(next) => {
              proposals.push(next);
              if (mode() === 'throw') throw new Error('proposal failed');
              if (mode() === 'accept') setValue(next);
              if (mode() === 'uppercase') setValue(next.toUpperCase());
            }}
          />
        </Show>
      </View>
    );
  }
  return {
    Scene,
    value,
    setValue,
    setMode,
    setDisabled,
    setReadOnly,
    setTouched,
    setInvalid,
    setVisible,
    setSelection,
    proposals,
    ref: () => ref,
  };
}

export function switchFixture(
  options: { controlled?: boolean; accept?: boolean; trackColor?: string } = {},
) {
  const [value, setValue] = createSignal<boolean | undefined>(
    options.controlled ? false : undefined,
  );
  const [accept, setAccept] = createSignal(options.accept ?? true);
  const [disabled, setDisabled] = createSignal(false);
  const [touched, setTouched] = createSignal(false);
  const [invalid, setInvalid] = createSignal(false);
  const proposals: boolean[] = [];
  function Scene() {
    return (
      <Switch
        testID="switch"
        trackColor={options.trackColor ? { true: options.trackColor } : undefined}
        value={value()}
        disabled={disabled()}
        touched={touched()}
        invalid={invalid()}
        onTouched={() => setTouched(true)}
        onValueChange={(next) => {
          proposals.push(next);
          if (accept()) setValue(next);
        }}
      />
    );
  }
  return { Scene, value, setValue, setAccept, setDisabled, setInvalid, proposals };
}

export function InvalidProps() {
  // @ts-expect-error Switch takes a boolean value, never a string.
  return <Switch value="true" />;
}

export function ownershipFixture() {
  const [opacity, setOpacity] = createSignal(1);
  const [pressable, setPressable] = createSignal(false);
  const counts = { mount: 0, cleanup: 0, press: 0 };
  function Child() {
    counts.mount++;
    onCleanup(() => counts.cleanup++);
    return <Text testID="owned-child">once</Text>;
  }
  function Scene() {
    return (
      <View testID="owner" style={{ opacity: opacity() }}>
        <Child />
        <Text
          testID="optional-press"
          minPressDuration={0}
          onPress={pressable() ? () => counts.press++ : undefined}
        >
          label
        </Text>
      </View>
    );
  }
  return { Scene, setOpacity, setPressable, counts };
}

export function pressCallbackFixture() {
  const calls: string[] = [];
  const [handler, setHandler] = createSignal(() => calls.push('old'));
  function Scene() {
    return (
      <Text
        testID="dynamic-press"
        minPressDuration={0}
        onPress={handler()}
        onPressIn={() => calls.push('in')}
        onPressOut={() => calls.push('out')}
      >
        replace callback
      </Text>
    );
  }
  return { Scene, calls, replace: () => setHandler(() => () => calls.push('new')) };
}

/** A Text whose press callback arrives later, with its owner exposed so tests can count computations. */
export function lazyPressFixture() {
  const [onPress, setOnPress] = createSignal<(() => void) | undefined>();
  const counts = { press: 0 };
  let owner: Owner | null = null;
  const computations = (from: Owner | null): number =>
    (from?.owned ?? []).reduce((total, child) => total + 1 + computations(child), 0);
  function Scene() {
    return createMemo(() => {
      owner = getOwner();
      return (
        <Text testID="lazy-press" minPressDuration={0} onPress={onPress()}>
          plain
        </Text>
      );
    });
  }
  return {
    Scene,
    counts,
    computations: () => computations(owner),
    gainPress: () => setOnPress(() => () => counts.press++),
    dropPress: () => setOnPress(undefined),
  };
}
