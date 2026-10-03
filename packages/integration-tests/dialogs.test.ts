/**
 * The platform's own dialogs and the share sheet.
 *
 * All of these are callback APIs, and the reason to wrap them is that a dialog is a *question*:
 * `Alert.alert` hands its answer to one of several `onPress` callbacks, so asking something and
 * acting on the answer means splitting one thought across three functions.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Dialogs,
  Sharing,
  dialogSource,
  useService,
  type NativeDialogs,
} from '@solid-native/device';
import { serviceWith } from './ui-services.ts';

/** A platform that records what it was asked to show and lets a test answer. */
function ios(): NativeDialogs & {
  shown: unknown;
  tap(label: string): void;
  pick(index: number): void;
} {
  const state = {
    platform: 'ios',
    shown: null as unknown,
    buttons: [] as { text: string; style?: string; onPress?: () => void }[],
    select: null as ((index: number) => void) | null,
    alert(title: string, message: string | undefined, buttons: never) {
      state.shown = { title, message };
      state.buttons = buttons;
    },
    prompt(title: string, _m: string | undefined, onResult: (value: string | null) => void) {
      state.shown = { title };
      state.select = null;
      queueMicrotask(() => onResult('typed'));
    },
    actionSheet(
      options: { options: string[]; cancelButtonIndex: number },
      onSelect: (i: number) => void,
    ) {
      state.shown = options;
      state.select = onSelect;
    },
    tap: (label: string) => state.buttons.find((b) => b.text === label)?.onPress?.(),
    pick: (index: number) => state.select?.(index),
  };
  return state as never;
}

function android() {
  const platform = ios();
  return Object.assign(platform, {
    platform: 'android',
    prompt: undefined,
    actionSheet: undefined,
    toasts: [] as string[],
    toast(message: string) {
      (platform as unknown as { toasts: string[] }).toasts.push(message);
    },
  });
}

describe('a dialog', () => {
  it('resolves once it has been read', async () => {
    const native = ios();
    const dialogs = serviceWith(Dialogs.SOURCE, native, () => useService(Dialogs));
    const told = dialogs.tell('Saved');

    native.tap('OK');
    await told;
  });

  it('turns a confirmation into the answer, not three callbacks', async () => {
    const native = ios();
    const dialogs = serviceWith(Dialogs.SOURCE, native, () => useService(Dialogs));

    const answer = dialogs.confirm('Delete this?', { destructive: true });
    native.tap('OK');
    assert.equal(await answer, true);
  });

  it('resolves false when they back out', async () => {
    const native = ios();
    const dialogs = serviceWith(Dialogs.SOURCE, native, () => useService(Dialogs));

    const answer = dialogs.confirm('Delete this?');
    native.tap('Cancel');
    assert.equal(await answer, false);
  });

  it('paints a destructive confirmation the way the platform does', async () => {
    const native = ios();
    void serviceWith(Dialogs.SOURCE, native, () => useService(Dialogs)).confirm('Delete', {
      destructive: true,
    });
    const [cancel, confirm] = (native as unknown as { buttons: { style?: string }[] }).buttons;

    assert.equal(cancel!.style, 'cancel');
    assert.equal(confirm!.style, 'destructive');
  });

  it('leaves an ordinary confirmation ordinary', async () => {
    // The other half, and the half that was missing: every test above passed `destructive: true`,
    // so an implementation that painted every confirm button red would have passed all of them.
    // Red is how a platform says "this one cannot be undone", and it means nothing if it is on
    // everything.
    const native = ios();
    void serviceWith(Dialogs.SOURCE, native, () => useService(Dialogs)).confirm('Save this?');
    const [cancel, confirm] = (native as unknown as { buttons: { style?: string }[] }).buttons;

    assert.equal(cancel!.style, 'cancel', 'cancel is still cancel');
    assert.notEqual(confirm!.style, 'destructive');
  });
});

describe('asking for a line of text', () => {
  it('resolves what they typed', async () => {
    const dialogs = serviceWith(Dialogs.SOURCE, ios(), () => useService(Dialogs));
    assert.equal(await dialogs.ask('Name'), 'typed');
  });

  it('resolves null on a platform with no prompt, so a caller can fall back', async () => {
    // `Alert.prompt` is iOS only, and inventing one out of a modal and a text input would be a
    // dialog that looks nothing like the platform's.
    const dialogs = serviceWith(Dialogs.SOURCE, android() as never, () => useService(Dialogs));
    assert.equal(await dialogs.ask('Name'), null);
  });
});

describe('offering a choice', () => {
  it('is an action sheet on iOS, with cancel where the platform puts it', async () => {
    const native = ios();
    const dialogs = serviceWith(Dialogs.SOURCE, native, () => useService(Dialogs));

    const chosen = dialogs.choose('Photo', [{ label: 'Camera' }, { label: 'Library' }]);
    const shown = native.shown as { options: string[]; cancelButtonIndex: number };
    assert.deepEqual(shown.options, ['Camera', 'Library', 'Cancel'], 'a way out was added');
    assert.equal(shown.cancelButtonIndex, 2);

    native.pick(1);
    assert.equal(await chosen, 1);
  });

  it('marks a destructive choice for the action sheet to draw in red', async () => {
    const native = ios();
    void serviceWith(Dialogs.SOURCE, native, () => useService(Dialogs)).choose('Photo', [
      { label: 'Keep' },
      { label: 'Delete', style: 'destructive' },
    ]);
    assert.equal((native.shown as { destructiveButtonIndex?: number }).destructiveButtonIndex, 1);
  });

  it('reports a dismissal as no choice at all', async () => {
    const native = ios();
    const chosen = serviceWith(Dialogs.SOURCE, native, () => useService(Dialogs)).choose('Photo', [
      { label: 'Camera' },
    ]);
    native.pick(1);
    assert.equal(await chosen, null);
  });

  it('is a dialog on Android, because that is what Android means by this', async () => {
    const native = android();
    const dialogs = serviceWith(Dialogs.SOURCE, native as never, () => useService(Dialogs));

    const chosen = dialogs.choose('Photo', [{ label: 'Camera' }, { label: 'Library' }]);
    native.tap('Library');
    assert.equal(await chosen, 1);
  });

  it('gives Android a way out too, since its dialog is not cancelable', async () => {
    /*
     * React Native puts up Android's alert with `cancelable: false`, so a press outside does
     * nothing and so does the back button. Without a Cancel button among the choices there is
     * literally no way to decline - the user has to pick something. iOS has had one appended since
     * this was written; Android had not.
     */
    const native = android();
    const dialogs = serviceWith(Dialogs.SOURCE, native as never, () => useService(Dialogs));

    const chosen = dialogs.choose('Photo', [{ label: 'Camera' }, { label: 'Library' }]);
    const labels = (native as unknown as { buttons: { text: string }[] }).buttons.map(
      (b) => b.text,
    );
    assert.deepEqual(labels, ['Camera', 'Library', 'Cancel']);

    native.tap('Cancel');
    assert.equal(await chosen, null, 'declining is not a choice');
  });

  it('does not add a second Cancel when the caller supplied one', async () => {
    const native = android();
    const dialogs = serviceWith(Dialogs.SOURCE, native as never, () => useService(Dialogs));

    dialogs.choose('Photo', [{ label: 'Camera' }, { label: 'Not now', style: 'cancel' }]);
    const labels = (native as unknown as { buttons: { text: string }[] }).buttons.map(
      (b) => b.text,
    );
    assert.deepEqual(labels, ['Camera', 'Not now']);
  });
});

describe('saying something small', () => {
  it('is a toast where there is one', () => {
    const native = android();
    serviceWith(Dialogs.SOURCE, native as never, () => useService(Dialogs)).notify('Copied');
    assert.deepEqual((native as unknown as { toasts: string[] }).toasts, ['Copied']);
  });

  it('does nothing on iOS rather than interrupting with a modal', () => {
    // iOS has never had a toast. An alert for something that did not warrant interrupting anyone
    // is worse than saying nothing; an app that must be seen uses `tell`.
    const native = ios();
    serviceWith(Dialogs.SOURCE, native, () => useService(Dialogs)).notify('Copied');
    assert.equal(native.shown, null);
  });
});

describe('the share sheet', () => {
  it('reports whether anything took the content', async () => {
    const shared = serviceWith(
      Sharing.SOURCE,
      { share: async () => ({ action: 'sharedAction' }) },
      () => useService(Sharing),
    );
    assert.equal(await shared.share({ url: 'https://example.com' }), true);

    const dismissed = serviceWith(
      Sharing.SOURCE,
      { share: async () => ({ action: 'dismissedAction' }) },
      () => useService(Sharing),
    );
    assert.equal(await dismissed.share({ url: 'https://example.com' }), false);
  });

  it('does not open a sheet with nothing in it', async () => {
    let opened = false;
    const sharing = serviceWith(
      Sharing.SOURCE,
      {
        share: async () => ((opened = true), { action: 'sharedAction' }),
      },
      () => useService(Sharing),
    );

    assert.equal(await sharing.share({ title: 'Just a title' }), false);
    assert.equal(opened, false);
  });

  it('treats a failure as a dismissal, because at the call site they are the same', async () => {
    const sharing = serviceWith(
      Sharing.SOURCE,
      {
        share: async () => {
          throw new Error('no sheet');
        },
      },
      () => useService(Sharing),
    );
    assert.equal(await sharing.share({ message: 'hello' }), false);
  });
});

/**
 * What `dialogSource` decides from React Native's own modules.
 *
 * The capability check used to be "is the module there", and on a device it is there on both
 * platforms: `react-native` exports `ActionSheetIOS` on Android with a null TurboModule under it,
 * and `Alert.prompt` on Android with a body that checks `Platform.OS` and returns. Neither absence
 * is visible from JavaScript, so the platform name is what decides.
 */
describe('reading the platform off React Native', () => {
  const modules = (os: string) => ({
    Platform: { OS: os },
    // Present on both platforms, whatever the platform actually does with them.
    Alert: { alert: () => {}, prompt: () => {} },
    ActionSheetIOS: { showActionSheetWithOptions: () => {} },
    ToastAndroid: { show: () => {}, SHORT: 0, LONG: 1 },
  });

  it('takes the iOS-only ones on iOS', () => {
    const source = dialogSource(modules('ios'))!;
    assert.equal(typeof source.prompt, 'function');
    assert.equal(typeof source.actionSheet, 'function');
    assert.equal(source.toast, undefined, 'no toast on iOS, whatever the module says');
  });

  it('leaves the iOS-only ones behind on Android, module or no module', () => {
    const source = dialogSource(modules('android'))!;
    assert.equal(source.prompt, undefined, 'Alert.prompt is there and does nothing: a hang');
    assert.equal(source.actionSheet, undefined, 'ActionSheetIOS is there and throws');
    assert.equal(typeof source.toast, 'function');
  });

  it('is nothing at all off a device', () => {
    assert.equal(dialogSource(null), null);
  });

  describe("Alert.prompt's buttons", () => {
    type Button = { text?: string; onPress?: (value?: string) => void };
    /**
     * What React Native's `Alert.prompt` does with its third argument: a function is the callback
     * of button 0, and with no buttons the native alert shows OK as 0 and Cancel as 1.
     */
    const prompting = () => {
      const shown: { press?: (label: string, value?: string) => void } = {};
      const native = {
        ...modules('ios'),
        Alert: {
          alert: () => {},
          prompt: (_t: string, _m: unknown, answer: ((text: string) => void) | Button[]) => {
            const buttons: Button[] =
              typeof answer === 'function'
                ? [{ text: 'OK', onPress: answer as Button['onPress'] }, { text: 'Cancel' }]
                : answer;
            shown.press = (label, value) =>
              buttons.find((button) => button.text === label)?.onPress?.(value);
          },
        },
      };
      const dialogs = serviceWith(Dialogs.SOURCE, dialogSource(native as never), () =>
        useService(Dialogs),
      );
      return { dialogs, shown };
    };

    it('resolves what was typed on OK', async () => {
      const { dialogs, shown } = prompting();
      const asked = dialogs.ask('Name');
      shown.press!('OK', 'Ada');
      assert.equal(await asked, 'Ada');
    });

    it('resolves null on Cancel, rather than never', async () => {
      const { dialogs, shown } = prompting();
      const asked = dialogs.ask('Name');
      shown.press!('Cancel');
      const outcome = await Promise.race([
        asked,
        new Promise((resolve) => setTimeout(() => resolve('unresolved'), 20)),
      ]);
      assert.equal(outcome, null);
    });
  });
});
