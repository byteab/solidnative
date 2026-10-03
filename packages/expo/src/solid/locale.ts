import { createMemo, type Accessor } from 'solid-js';
import { createObserved } from '@solid-native/device/solid';
import { expoModule, optional } from '../native.ts';
import { sourcedService } from './owned.ts';
export interface LocaleLike {
  readonly languageTag: string;
  readonly languageCode: string | null;
  readonly regionCode: string | null;
  readonly textDirection: 'ltr' | 'rtl';
  readonly measurementSystem: 'metric' | 'us' | 'uk' | null;
}

export interface CalendarLike {
  readonly calendar: string | null;
  readonly timeZone: string | null;
  readonly uses24hourClock: boolean | null;
  readonly firstWeekday: number | null;
}

export interface NativeLocale {
  locales(): readonly LocaleLike[];
  calendars(): readonly CalendarLike[];
  onChange(listener: () => void): () => void;
}

export interface Locale {
  readonly locales: Accessor<readonly LocaleLike[]>;
  readonly calendars: Accessor<readonly CalendarLike[]>;
  readonly locale: Accessor<LocaleLike | null>;
  readonly rtl: Accessor<boolean>;
  readonly tag: Accessor<string | undefined>;
}
export const Locale = sourcedService<Locale, NativeLocale | null>(
  'expo.locale',
  () => {
    const expo = expoModule(
      'expo-localization',
      () => require('expo-localization') as typeof import('expo-localization'),
    );
    const rn = optional(() => require('react-native') as typeof import('react-native'));
    if (!expo) return null;

    return {
      locales: () => expo.getLocales(),
      calendars: () => expo.getCalendars(),
      /**
       * Re-read when the app comes back to the front.
       *
       * The module has listeners for this but does not export them, and changing a language or
       * a calendar means going to Settings - so returning to the app is exactly when the answer
       * can have changed, and is a public API rather than a path into someone's build directory.
       */
      onChange: (listener) => {
        const subscription = rn?.AppState.addEventListener('change', (state) => {
          if (state === 'active') listener();
        });
        return () => subscription?.remove();
      },
    };
  },
  (native) => {
    const read = () => ({ locales: native?.locales() ?? [], calendars: native?.calendars() ?? [] });
    const current = createObserved(
      native
        ? { current: read, subscribe: (listener) => native.onChange(() => listener(read())) }
        : null,
      { locales: [] as readonly LocaleLike[], calendars: [] as readonly CalendarLike[] },
    );
    const locales = createMemo(() => current().locales);
    const calendars = createMemo(() => current().calendars);
    const locale = createMemo(() => locales()[0] ?? null);
    return {
      locales,
      calendars,
      locale,
      rtl: createMemo(() => locale()?.textDirection === 'rtl'),
      tag: createMemo(() => locale()?.languageTag),
    };
  },
);
