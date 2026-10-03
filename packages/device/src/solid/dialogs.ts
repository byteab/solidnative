import { reactNative, type ReactNative } from '../react-native.ts';
import { createRequests } from './requests.ts';
import { createServiceToken, useService } from './service-scope.ts';

export interface Choice {
  readonly label: string;
  readonly style?: 'default' | 'cancel' | 'destructive';
}

export interface NativeDialogs {
  readonly platform: 'ios' | 'android' | string;
  alert(
    title: string,
    message: string | undefined,
    buttons: readonly { text: string; style?: string; onPress?: () => void }[],
  ): void;
  prompt?(
    title: string,
    message: string | undefined,
    onResult: (value: string | null) => void,
    defaultValue?: string,
  ): void;
  actionSheet?(
    options: {
      title?: string;
      options: string[];
      cancelButtonIndex: number;
      destructiveButtonIndex?: number;
    },
    onSelect: (index: number) => void,
  ): void;
  toast?(message: string, long: boolean): void;
}

export interface Dialogs {
  tell(title: string, message?: string, dismiss?: string): Promise<void>;
  confirm(
    title: string,
    options?: { message?: string; confirm?: string; cancel?: string; destructive?: boolean },
  ): Promise<boolean>;
  ask(title: string, options?: { message?: string; value?: string }): Promise<string | null>;
  choose(title: string, choices: readonly Choice[]): Promise<number | null>;
  notify(message: string, options?: { long?: boolean }): void;
}

/** Pending questions settle as cancelled on caller/service disposal; native UI cannot be dismissed. */
const SOURCE = createServiceToken('native.dialogSource', () => dialogSource());
export const Dialogs = Object.freeze({
  ...createServiceToken<Dialogs>('native.dialogs', () => {
    const native = useService(SOURCE);
    const requests = createRequests();
    return {
      tell: (title, message, dismiss = 'OK') =>
        requests.run<void>(undefined, (resolve) => {
          if (!native) return resolve();
          native.alert(title, message, [{ text: dismiss, onPress: () => resolve() }]);
        }),
      confirm: (title, options = {}) =>
        requests.run(false, (resolve) => {
          if (!native) return resolve(false);
          native.alert(title, options.message, [
            { text: options.cancel ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: options.confirm ?? 'OK',
              style: options.destructive ? 'destructive' : 'default',
              onPress: () => resolve(true),
            },
          ]);
        }),
      ask: (title, options = {}) =>
        requests.run<string | null>(null, (resolve) => {
          if (!native?.prompt) return resolve(null);
          native.prompt(title, options.message, resolve, options.value);
        }),
      choose: (title, choices) =>
        requests.run<number | null>(null, (resolve) => {
          if (!native) return resolve(null);
          showChoices(native, title, choices, resolve);
        }),
      notify: (message, options = {}) => {
        if (requests.active()) native?.toast?.(message, options.long ?? false);
      },
    };
  }),
  SOURCE,
});

function showChoices(
  native: NativeDialogs,
  title: string,
  choices: readonly Choice[],
  resolve: (answer: number | null) => void,
): void {
  const cancelAt = choices.findIndex((choice) => choice.style === 'cancel');
  if (native.actionSheet) {
    const destructiveAt = choices.findIndex((choice) => choice.style === 'destructive');
    const labels = choices.map((choice) => choice.label);
    const cancelIndex = cancelAt >= 0 ? cancelAt : labels.push('Cancel') - 1;
    native.actionSheet(
      {
        title,
        options: labels,
        cancelButtonIndex: cancelIndex,
        ...(destructiveAt >= 0 ? { destructiveButtonIndex: destructiveAt } : {}),
      },
      // Preserve the existing iOS explicit-cancel index; an appended cancel returns null.
      (index) => resolve(index === cancelIndex && cancelAt < 0 ? null : index),
    );
    return;
  }
  const buttons = choices.map((choice, index) => ({
    text: choice.label,
    style: choice.style,
    onPress: () => resolve(choice.style === 'cancel' ? null : index),
  }));
  if (cancelAt < 0) buttons.push({ text: 'Cancel', style: 'cancel', onPress: () => resolve(null) });
  if (buttons.length > 3)
    console.error(
      `[native-solid] Dialogs.choose was given ${choices.length} choices and Android shows ` +
        'at most three buttons, counting the cancel. Use a selection screen for longer lists.',
    );
  native.alert(title, undefined, buttons);
}

/** Platform gates matter: RN exposes iOS-only stub methods on Android too. */
export function dialogSource(
  native: Pick<
    ReactNative,
    'Platform' | 'Alert' | 'ActionSheetIOS' | 'ToastAndroid'
  > | null = reactNative(),
): NativeDialogs | null {
  if (!native) return null;
  return {
    platform: native.Platform.OS,
    alert: (title, message, buttons) => native.Alert.alert(title, message, [...buttons]),
    ...(native.Platform.OS === 'ios' && native.Alert.prompt
      ? {
          prompt: (title, message, onResult, defaultValue) =>
            native.Alert.prompt!(
              title,
              message,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => onResult(null) },
                { text: 'OK', onPress: (value) => onResult(value ?? '') },
              ],
              undefined,
              defaultValue,
            ),
        }
      : {}),
    ...(native.Platform.OS === 'ios' && native.ActionSheetIOS
      ? {
          actionSheet: (options, onSelect) =>
            native.ActionSheetIOS!.showActionSheetWithOptions(options, onSelect),
        }
      : {}),
    ...(native.Platform.OS === 'android' && native.ToastAndroid
      ? {
          toast: (message, long) =>
            native.ToastAndroid!.show(
              message,
              long ? native.ToastAndroid!.LONG : native.ToastAndroid!.SHORT,
            ),
        }
      : {}),
  };
}
