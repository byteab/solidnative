import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  Dialogs,
  dialogSource,
  type NativeDialogs,
  type ReactNative,
} from '@solidnative/device/solid';
import { scope, service } from './g7-device-utils.ts';

function recorder(platform = 'ios') {
  let buttons: Parameters<NativeDialogs['alert']>[2] = [];
  let shown: { title: string; message?: string } | undefined;
  const source: NativeDialogs = {
    platform,
    alert(title, message, next) {
      shown = { title, message };
      buttons = next;
    },
  };
  return {
    source,
    buttons: () => buttons,
    shown: () => shown,
    tap: (label: string) => buttons.find((button) => button.text === label)?.onPress?.(),
  };
}

test('dialogs preserve confirm labels, message, destructive/default style and exactly one answer', async () => {
  const native = recorder();
  const root = service(Dialogs, native.source);
  const asked = root.value.confirm('Delete task?', {
    message: 'This cannot be undone.',
    confirm: 'Delete',
    cancel: 'Keep',
    destructive: true,
  });
  assert.deepEqual(native.shown(), { title: 'Delete task?', message: 'This cannot be undone.' });
  assert.deepEqual(
    native.buttons().map(({ text, style }) => ({ text, style })),
    [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive' },
    ],
  );
  native.tap('Delete');
  native.tap('Keep');
  assert.equal(await asked, true);
  const ordinary = root.value.confirm('Continue?');
  assert.equal(native.buttons()[1].style, 'default');
  native.tap('Cancel');
  assert.equal(await ordinary, false);
  const told = root.value.tell('Saved', 'Task updated', 'Close');
  native.tap('Close');
  assert.equal(await told, undefined);
  root.dispose();
});

test('caller cleanup cancels its pending question without disposing the shared dialog service', async () => {
  const native = recorder();
  const root = service(Dialogs, native.source);
  const screen = scope(() => root.value.confirm('Delete?'));
  const late = native.buttons()[1].onPress!;
  screen.dispose();
  late();
  assert.equal(await screen.value, false);
  const next = root.value.confirm('Still available?');
  native.tap('OK');
  assert.equal(await next, true);
  root.dispose();
});

test('scope cleanup settles every pending question and post-disposal methods stay inert', async () => {
  let shows = 0;
  let toasts = 0;
  const answers: (() => void)[] = [];
  const root = service(Dialogs, {
    platform: 'ios',
    alert(_title, _message, buttons) {
      shows++;
      answers.push(() => buttons.at(-1)?.onPress?.());
    },
    prompt(_title, _message, answer) {
      shows++;
      answers.push(() => answer('too late'));
    },
    actionSheet(_options, answer) {
      shows++;
      answers.push(() => answer(0));
    },
    toast() {
      toasts++;
    },
  });
  const waits = [
    root.value.tell('Read'),
    root.value.confirm('Agree'),
    root.value.ask('Name'),
    root.value.choose('Pick', [{ label: 'One' }]),
  ];
  root.dispose();
  root.dispose();
  answers.forEach((answer) => answer());
  assert.deepEqual(await Promise.all(waits), [undefined, false, null, null]);
  assert.deepEqual(
    await Promise.all([
      root.value.tell('No'),
      root.value.confirm('No'),
      root.value.ask('No'),
      root.value.choose('No', []),
    ]),
    [undefined, false, null, null],
  );
  root.value.notify('No');
  assert.equal(shows, 4);
  assert.equal(toasts, 0);
});

test('dialog failures reject once while unavailable capabilities return their documented fallback', async () => {
  const failure = new Error('native dialog error');
  const fail = () => {
    throw failure;
  };
  const root = service(Dialogs, { platform: 'ios', alert: fail, prompt: fail, actionSheet: fail });
  for (const question of [
    () => root.value.tell('fail'),
    () => root.value.confirm('fail'),
    () => root.value.ask('fail'),
    () => root.value.choose('fail', []),
  ])
    await assert.rejects(question, (error) => error === failure);
  root.dispose();
  const inert = service(Dialogs, null);
  assert.deepEqual(
    await Promise.all([
      inert.value.tell('No'),
      inert.value.confirm('No'),
      inert.value.ask('No'),
      inert.value.choose('No', []),
    ]),
    [undefined, false, null, null],
  );
  inert.value.notify('No');
  inert.dispose();
});

test('iOS action sheets preserve explicit cancel indexing and add an implicit dismissal choice', async () => {
  let options!: Parameters<NonNullable<NativeDialogs['actionSheet']>>[0];
  let answer!: (index: number) => void;
  const root = service(Dialogs, {
    platform: 'ios',
    alert() {},
    actionSheet(next, callback) {
      options = next;
      answer = callback;
    },
  });
  const choice = root.value.choose('Task', [
    { label: 'Keep' },
    { label: 'Delete', style: 'destructive' },
  ]);
  assert.deepEqual(options, {
    title: 'Task',
    options: ['Keep', 'Delete', 'Cancel'],
    cancelButtonIndex: 2,
    destructiveButtonIndex: 1,
  });
  answer(1);
  assert.equal(await choice, 1);
  const cancelled = root.value.choose('Task', [{ label: 'Keep' }]);
  answer(1);
  assert.equal(await cancelled, null);
  const explicit = root.value.choose('Task', [
    { label: 'Not now', style: 'cancel' },
    { label: 'Go' },
  ]);
  assert.equal(options.cancelButtonIndex, 0);
  answer(0);
  assert.equal(await explicit, 0, 'preserves legacy explicit iOS cancel index');
  root.dispose();
});

test('Android choices add one cancel and warn when native would truncate more than three buttons', async () => {
  const native = recorder('android');
  const root = service(Dialogs, native.source);
  const first = root.value.choose('Pick', [{ label: 'Camera' }, { label: 'Library' }]);
  assert.deepEqual(
    native.buttons().map((button) => button.text),
    ['Camera', 'Library', 'Cancel'],
  );
  native.tap('Library');
  assert.equal(await first, 1);
  const second = root.value.choose('Pick', [
    { label: 'Camera' },
    { label: 'Later', style: 'cancel' },
  ]);
  assert.equal(native.buttons().length, 2);
  native.tap('Later');
  assert.equal(await second, null);
  const messages: unknown[][] = [];
  const previous = console.error;
  console.error = (...args) => messages.push(args);
  try {
    const third = root.value.choose('Pick', [{ label: 'A' }, { label: 'B' }, { label: 'C' }]);
    assert.equal(messages.length, 1);
    assert.match(String(messages[0][0]), /at most three/);
    native.tap('Cancel');
    assert.equal(await third, null);
  } finally {
    console.error = previous;
    root.dispose();
  }
});

test('native dialog adapters gate platform stubs and wire prompt cancel, value and toast duration', async () => {
  let buttons: { text?: string; onPress?: (value?: string) => void }[] = [];
  let initial: string | undefined;
  const toasts: [string, number][] = [];
  const modules: Pick<ReactNative, 'Platform' | 'Alert' | 'ActionSheetIOS' | 'ToastAndroid'> = {
    Platform: { OS: 'ios' },
    Alert: {
      alert() {},
      prompt(_title, _message, callback, _type, value) {
        assert.ok(Array.isArray(callback));
        buttons = callback;
        initial = value;
      },
    },
    ActionSheetIOS: { showActionSheetWithOptions() {} },
    ToastAndroid: {
      SHORT: 7,
      LONG: 9,
      show: (message, duration) => void toasts.push([message, duration]),
    },
  };
  const ios = dialogSource(modules)!;
  assert.equal(ios.toast, undefined);
  assert.equal(typeof ios.actionSheet, 'function');
  const root = service(Dialogs, ios);
  const asked = root.value.ask('Name', { value: 'Ada' });
  assert.equal(initial, 'Ada');
  buttons.find((button) => button.text === 'Cancel')!.onPress!();
  assert.equal(await asked, null);
  const accepted = root.value.ask('Name');
  buttons.find((button) => button.text === 'OK')!.onPress!('Grace');
  assert.equal(await accepted, 'Grace');
  const empty = root.value.ask('Name');
  buttons.find((button) => button.text === 'OK')!.onPress!();
  assert.equal(await empty, '');
  root.dispose();
  modules.Platform.OS = 'android';
  const android = dialogSource(modules)!;
  assert.equal(android.prompt, undefined);
  assert.equal(android.actionSheet, undefined);
  const androidRoot = service(Dialogs, android);
  assert.equal(await androidRoot.value.ask('Name'), null);
  androidRoot.value.notify('Copied');
  androidRoot.value.notify('Saved', { long: true });
  assert.deepEqual(toasts, [
    ['Copied', 7],
    ['Saved', 9],
  ]);
  androidRoot.dispose();
  assert.equal(dialogSource(null), null);
});
