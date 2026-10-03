import { createSignal, type Accessor } from 'solid-js';
import { createServiceToken } from '@solid-native/device/solid';

export interface NoteDrafts {
  readonly saved: Accessor<string | null>;
  save(title: string): void;
}

/** The sheet and its retained parent share this app-scoped draft. */
export const NoteDrafts = createServiceToken<NoteDrafts>('canary.note-drafts', () => {
  const [saved, setSaved] = createSignal<string | null>(null);
  return {
    saved,
    save: (title) => {
      setSaved(title);
    },
  };
});
