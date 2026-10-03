import {
  createMemo,
  createRenderEffect,
  createSignal,
  getOwner,
  onCleanup,
  untrack,
  type Accessor,
} from 'solid-js';
import { reactNative, type ReactNative } from '../react-native.ts';
import { SCREEN_IN_FRONT } from './screen-in-front.ts';
import { createServiceToken, useService } from './service-scope.ts';

export type StatusBarStyle = 'default' | 'light' | 'dark';
export interface StatusBarState {
  readonly style?: StatusBarStyle;
  readonly hidden?: boolean;
  readonly animated?: boolean;
  readonly backgroundColor?: string;
  readonly translucent?: boolean;
}
export interface StatusBarSource {
  setStyle(style: StatusBarStyle, animated?: boolean): void;
  setHidden(hidden: boolean, animation?: 'none' | 'fade' | 'slide'): void;
  setBackgroundColor(color: string, animated?: boolean): void;
  setTranslucent(translucent: boolean): void;
  readonly height: number | undefined;
}

const BAR_STYLES = { default: 'default', light: 'light-content', dark: 'dark-content' } as const;
export function statusBarSource(
  native: Pick<ReactNative, 'StatusBar'> | null = reactNative(),
): StatusBarSource {
  const bar = native?.StatusBar;
  return {
    setStyle: (style, animated) => bar?.setBarStyle(BAR_STYLES[style], animated),
    setHidden: (hidden, animation) => bar?.setHidden(hidden, animation),
    setBackgroundColor: (color, animated) => bar?.setBackgroundColor(color, animated),
    setTranslucent: (translucent) => bar?.setTranslucent(translucent),
    get height() {
      return bar?.currentHeight;
    },
  };
}

export interface StatusBar {
  readonly state: Accessor<StatusBarState>;
  readonly height: Accessor<number>;
  /** Replaces the base claim without removing any temporary claims. */
  set(state: StatusBarState): void;
  /** Returns an idempotent release, also bound to the caller's Solid owner when present. */
  push(state: StatusBarState): () => void;
}

function apply(source: StatusBarSource, state: StatusBarState): void {
  const { style, hidden, animated, backgroundColor, translucent } = state;
  if (style !== undefined) source.setStyle(style, animated);
  if (hidden !== undefined) source.setHidden(hidden, animated ? 'fade' : undefined);
  if (backgroundColor !== undefined) source.setBackgroundColor(backgroundColor, animated);
  if (translucent !== undefined) source.setTranslucent(translucent);
}

function createStatusBar(source: StatusBarSource): StatusBar {
  const [base, setBase] = createSignal<StatusBarState>({});
  const [claims, setClaims] = createSignal<readonly StatusBarState[]>([]);
  const state = createMemo(() =>
    claims().reduce((value, claim) => ({ ...value, ...claim }), base()),
  );
  const height = source.height ?? 0;
  let active = true;
  onCleanup(() => {
    active = false;
  });
  return {
    state,
    height: () => height,
    set(next) {
      if (!active) return;
      setBase({ ...next });
      untrack(() => apply(source, state()));
    },
    push(next) {
      if (!active) return () => {};
      const claim = { ...next };
      let claimed = true;
      const release = () => {
        if (!claimed || !active) return;
        claimed = false;
        setClaims((previous) => previous.filter((entry) => entry !== claim));
        untrack(() => apply(source, state()));
      };
      if (getOwner()) onCleanup(release);
      setClaims((previous) => [...previous, claim]);
      try {
        untrack(() => apply(source, state()));
      } catch (error) {
        // A failed native setter must not strand a claim in an otherwise live app scope.
        try {
          release();
        } catch {
          /* Keep the original setter failure. */
        }
        throw error;
      }
      return release;
    },
  };
}

const SOURCE = createServiceToken('native.statusBarSource', statusBarSource);
export const StatusBar = Object.freeze({
  ...createServiceToken('native.statusBar', () => createStatusBar(useService(SOURCE))),
  SOURCE,
});

/** Reactive screen claim; a covered retained route cannot change native chrome. */
export function useStatusBar(state: Accessor<StatusBarState>): void {
  if (!getOwner()) throw new Error('useStatusBar requires an active Solid owner.');
  const bar = useService(StatusBar);
  const front = useService(SCREEN_IN_FRONT);
  createRenderEffect(() => {
    if (front()) {
      const next = state();
      untrack(() => bar.push(next));
    }
  });
}
