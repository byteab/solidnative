/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createRenderEffect, createSignal, onCleanup } from 'solid-js';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type ScrollViewRef,
} from '@solid-native/components/solid';
import {
  Dialogs,
  LayoutAnimation,
  Sharing,
  StatusBar,
  Vibration,
  SCREEN_IN_FRONT,
  useService,
} from '@solid-native/device/solid';
import { For } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { Battery } from '@solid-native/expo/solid/battery';
import { Brightness } from '@solid-native/expo/solid/brightness';
import { KeepAwake } from '@solid-native/expo/solid/keep-awake';
import { Locale } from '@solid-native/expo/solid/locale';
import { Network } from '@solid-native/expo/solid/network';
import { DeviceOrientation } from '@solid-native/expo/solid/orientation';
import { Accelerometer } from '@solid-native/expo/solid/sensors';
import { SecureStorage, Storage } from '@solid-native/expo/solid/store';
import { page } from '../screen-styles.ts';
export function VerifyPage() {
  const battery = useService(Battery),
    network = useService(Network),
    locale = useService(Locale),
    orientation = useService(DeviceOrientation),
    brightness = useService(Brightness),
    keepAwake = useService(KeepAwake),
    accelerometer = useService(Accelerometer),
    store = useService(Storage),
    keychain = useService(SecureStorage),
    dialogs = useService(Dialogs),
    sharing = useService(Sharing),
    vibration = useService(Vibration),
    statusBar = useService(StatusBar),
    layout = useService(LayoutAnimation),
    front = useService(SCREEN_IN_FRONT);
  const grow = { flex: 1 },
    hairlineBox = { height: 1, marginBottom: 4 },
    stateRow = {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    };
  const [rows, setRows] = createSignal(['one', 'two', 'three']),
    [reading, setReading] = createSignal(false),
    [answer, setAnswer] = createSignal('Nothing asked yet.'),
    [shared, setShared] = createSignal('');
  const note = store.signal('verify.note', 0),
    secret = keychain.signal('verify.secret', 0);
  const state = createMemo(() => [
    { label: 'battery', value: `${Math.round(battery.level() * 100)}%  ${battery.state()}` },
    { label: 'battery low / saving', value: `${battery.low()} / ${battery.saving()}` },
    { label: 'network', value: `${network.type()}  connected ${network.connected()}` },
    { label: 'reachable', value: String(network.reachable()) },
    { label: 'locale', value: `${locale.tag() ?? '-'}  rtl ${locale.rtl()}` },
    { label: 'locales offered', value: String(locale.locales().length) },
    {
      label: 'orientation',
      value: `${orientation.orientation()}  landscape ${orientation.landscape()}`,
    },
    { label: 'brightness', value: brightness.level().toFixed(2) },
    { label: 'keep awake', value: String(keepAwake.active()) },
    { label: 'accelerometer available', value: String(accelerometer.available()) },
  ]);
  const motion = createMemo(() => {
    const { x, y, z } = accelerometer.reading();
    return `x ${x.toFixed(2)}  y ${y.toFixed(2)}  z ${z.toFixed(2)}`;
  });
  let scroll: ScrollViewRef | undefined;
  let active = true,
    epoch = 0,
    answerRequest = 0,
    shareRequest = 0,
    barIsLight = true,
    dropBar: (() => void) | undefined,
    stopMotion: (() => void) | undefined;
  const owns = (request: number) => active && front() && request === epoch;
  const release = () => {
    epoch++;
    dropBar?.();
    dropBar = undefined;
    stopMotion?.();
    stopMotion = undefined;
    // Root teardown detaches before disposing route owners. Release claims without asking the
    // disposed host to construct replacement text; a retained return synchronizes the label.
    if (active && scroll?.isAttached()) setReading(false);
  };
  createRenderEffect(() => {
    if (!front()) release();
    else setReading(!!stopMotion);
  });
  onCleanup(() => {
    active = false;
    release();
  });
  const toggleMotion = () => {
    if (!active || !front()) return;
    if (stopMotion) {
      stopMotion();
      stopMotion = undefined;
      setReading(false);
    } else {
      stopMotion = accelerometer.start(200);
      setReading(true);
    }
  };
  const bumpStored = () => {
    note.update((n) => n + 1);
    secret.update((n) => n + 1);
  };
  const animate = (change: () => void) => {
    const request = epoch;
    void layout
      .animate(() => {
        if (owns(request)) change();
      })
      .catch((error) => {
        if (owns(request)) setAnswer(String(error));
      });
  };
  const addRow = () => animate(() => setRows((r) => [...r, `row ${r.length + 1}`]));
  const removeRow = () => animate(() => setRows((r) => r.slice(0, -1)));
  async function ask(run: () => Promise<string>) {
    const request = epoch,
      answerId = ++answerRequest;
    try {
      const value = await run();
      if (owns(request) && answerId === answerRequest) setAnswer(value);
    } catch (error) {
      if (owns(request) && answerId === answerRequest) setAnswer(String(error));
    }
  }
  const askConfirm = () =>
    ask(async () =>
      (await dialogs.confirm('Delete this?', { destructive: true })) ? 'Confirmed.' : 'Cancelled.',
    );
  const askText = () =>
    ask(async () => {
      const name = await dialogs.ask('What is your name?');
      return name === null ? 'No prompt on this platform.' : `Typed: ${name}`;
    });
  const askChoice = () =>
    ask(async () => {
      const choices = [
        { label: 'Camera' },
        { label: 'Library' },
        { label: 'Delete', style: 'destructive' as const },
      ];
      const at = await dialogs.choose('Pick one', choices);
      return at === null ? 'Dismissed.' : `Chose: ${choices[at]!.label}`;
    });
  const notify = () => dialogs.notify('Copied to the clipboard');
  async function share() {
    const request = epoch,
      id = ++shareRequest;
    try {
      const took = await sharing.share({ message: 'solid-native', url: 'https://expo.dev' });
      if (owns(request) && id === shareRequest)
        setShared(took ? 'Something took it.' : 'Dismissed, or nothing took it.');
    } catch (error) {
      if (owns(request) && id === shareRequest) setShared(String(error));
    }
  }
  const buzz = () => vibration.buzz(300);
  const flipBar = () => {
    dropBar?.();
    barIsLight = !barIsLight;
    dropBar = statusBar.push({ style: barIsLight ? 'light' : 'dark' });
  };
  return (
    <>
      <NativeHeader title="Verify" />
      <ScrollView
        ref={(ref) => {
          scroll = ref;
        }}
        class="screen"
        contentContainerStyle={page.content}
      >
        <Text class="hint">
          Each of these fails silently when it is wrong. Look at them rather than trust them.
        </Text>

        <Text class="heading">Device state</Text>
        <Text class="body">
          Every one of these is a signal over a native listener. None had ever been read on a device
          before this screen existed; a facade that quietly reports its default looks exactly like a
          device that has nothing to say.
        </Text>
        <For each={state()}>
          {(row) => (
            <>
              <View style={stateRow}>
                <Text class="hint">{row.label}</Text>
                <Text class="body">{row.value}</Text>
              </View>
            </>
          )}
        </For>

        <Text class="heading">Accelerometer</Text>
        <Text class="body">{motion()}</Text>
        <Pressable class="card" onPress={toggleMotion}>
          <Text class="button-label">{reading() ? 'Stop' : 'Start'} reading</Text>
        </Pressable>
        <Text class="hint">
          Nothing is subscribed until it is started, because every event updates the reading. A
          simulator reports a constant, which is still the difference between reaching the sensor
          and not.
        </Text>

        <Text class="heading">Storage</Text>
        <Text class="body">
          plain: {note()} / keychain: {secret()}
        </Text>
        <Pressable class="card" onPress={bumpStored}>
          <Text class="button-label">Write to both</Text>
        </Pressable>
        <Text class="hint">
          Both are signals bound to a store. Kill the app and come back: the numbers should be where
          you left them, which is the only way to tell a write-through from a plain signal.
        </Text>
        <Text class="heading">Structural selectors</Text>
        <Text class="body">
          First and last row are rounded; odd rows are lighter. Only elements count.
        </Text>
        <View>
          <For each={rows()}>
            {(row) => (
              <>
                <View class="verify-row">
                  <Text class="body">{row}</Text>
                </View>
              </>
            )}
          </For>
        </View>
        <View style={page.row}>
          <Pressable class="button" style={grow} onPress={addRow}>
            <Text class="button-label">Add row</Text>
          </Pressable>
          <Pressable class="button" style={grow} onPress={removeRow}>
            <Text class="button-label">Remove</Text>
          </Pressable>
        </View>
        <Text class="hint">
          Adding or removing re-resolves the siblings: the rounding and the striping have to follow.
        </Text>

        <Text class="heading">platform-color()</Text>
        <Text class="verify-platform-color">The system's own label colour</Text>
        <Text class="hint">
          iOS 'label', Android '?attr/textColorPrimary'. It should invert with the system theme
          without a dark-mode rule of its own.
        </Text>

        <Text class="heading">Gradient</Text>
        <View class="verify-gradient"></View>
        <Text class="hint">
          A blue-to-magenta band, left to right. The direction has to reach native as an angle: only
          the four corners are keywords it knows, and a rejected direction takes the whole gradient
          with it.
        </Text>

        <Text class="heading">Hairline</Text>
        <View class="verify-hairline" style={hairlineBox}></View>
        <Text class="hint">
          A third of a point on a 3x screen. Next to a 1px rule it should look visibly thinner.
        </Text>

        <Text class="heading">Dialogs</Text>
        <Text class="body">{answer()}</Text>
        <View style={page.row}>
          <Pressable class="button" style={grow} onPress={askConfirm}>
            <Text class="button-label">Confirm</Text>
          </Pressable>
          <Pressable class="button" style={grow} onPress={askText}>
            <Text class="button-label">Prompt</Text>
          </Pressable>
        </View>
        <View style={page.row}>
          <Pressable class="button" style={grow} onPress={askChoice}>
            <Text class="button-label">Choose</Text>
          </Pressable>
          <Pressable class="button" style={grow} onPress={notify}>
            <Text class="button-label">Notify</Text>
          </Pressable>
        </View>
        <Text class="hint">
          Choose is an action sheet on iOS and a dialog on Android; notify is a toast on Android and
          an alert on iOS. Prompt is iOS-only and resolves to null elsewhere.
        </Text>

        <Text class="heading">Share, vibrate, status bar</Text>
        <View style={page.row}>
          <Pressable class="button" style={grow} onPress={share}>
            <Text class="button-label">Share</Text>
          </Pressable>
          <Pressable class="button" style={grow} onPress={buzz}>
            <Text class="button-label">Vibrate</Text>
          </Pressable>
        </View>
        <Pressable class="card" onPress={flipBar}>
          <Text class="button-label">Toggle the status bar style</Text>
        </Pressable>
        <Text class="hint">{shared()}</Text>
      </ScrollView>
    </>
  );
}
