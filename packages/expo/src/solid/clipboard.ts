import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';
export interface NativeClipboard {
  getStringAsync(): Promise<string>;
  setStringAsync(text: string): Promise<boolean>;
  addClipboardListener(listener: () => void): { remove(): void };
}
export interface Clipboard {
  readonly changes: Accessor<number>;
  read(): Promise<string>;
  write(text: string): Promise<void>;
}
export const Clipboard = sourcedService<Clipboard, NativeClipboard | null>(
  'expo.clipboard',
  () => expoModule('expo-clipboard', () => require('expo-clipboard') as NativeClipboard),
  (native) => {
    const requests = ownedRequests();
    const [changes, setChanges] = createSignal(0);
    let stop: (() => void) | undefined;
    onCleanup(() => {
      const release = stop;
      stop = undefined;
      release?.();
    });
    const subscription = native?.addClipboardListener(() => {
      if (requests.active()) setChanges((n) => n + 1);
    });
    if (subscription) {
      if (!requests.active()) subscription.remove();
      else stop = () => subscription.remove();
    }
    return {
      changes,
      read: () => requests.run('', () => native?.getStringAsync() ?? ''),
      write: (text) =>
        requests.run(undefined, async () => {
          await native?.setStringAsync(text);
        }),
    };
  },
);
