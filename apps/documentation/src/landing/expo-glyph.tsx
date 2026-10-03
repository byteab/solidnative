/** @jsxImportSource solid-js */
/**
 * A small drawing for each Expo module card, in the page's ink with one blue accent.
 *
 * Illustrations, not screenshots: each says what the module is for at a glance, so the card needs
 * no code to be understood. Drawn on a 64-unit square at the stroke weight of the device frames.
 */
import { Match, Switch } from 'solid-js';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'landing-expo-glyph': HTMLAttributes<HTMLElement>;
    }
  }
}

export type ExpoGlyphName =
  | 'haptics'
  | 'secure-storage'
  | 'notifications'
  | 'updates'
  | 'file-system'
  | 'network'
  | 'camera'
  | 'location'
  | 'biometrics'
  | 'sign-in'
  | 'media'
  | 'database';

export function LandingExpoGlyph(props: { name: ExpoGlyphName; class?: string }) {
  return (
    <landing-expo-glyph class={`block ${props.class ?? ''}`}>
      <svg viewBox="0 0 64 64" class="expo-glyph" aria-hidden="true">
        <Switch>
          <Match when={props.name === 'haptics'}>
            <rect x="22" y="12" width="20" height="40" rx="4" class="glyph-ink" />
            <path d="M29 47h6" class="glyph-ink" />
            <path d="M15 24c-3 5-3 11 0 16M9 20c-5 8-5 16 0 24" class="glyph-accent" />
            <path d="M49 24c3 5 3 11 0 16M55 20c5 8 5 16 0 24" class="glyph-accent" />
          </Match>
          <Match when={props.name === 'secure-storage'}>
            <path d="M22 29v-7a10 10 0 0 1 20 0v7" class="glyph-ink" />
            <rect x="16" y="29" width="32" height="24" rx="4" class="glyph-ink" />
            <circle cx="32" cy="39" r="3" class="glyph-accent-fill" />
            <path d="M32 42v5" class="glyph-accent" />
          </Match>
          <Match when={props.name === 'notifications'}>
            <path
              d="M20 42V30a12 12 0 0 1 24 0v12l4 5H16Z M28 51a4 4 0 0 0 8 0"
              class="glyph-ink"
            />
            <circle cx="45" cy="18" r="7" class="glyph-accent-fill" />
            <path d="M45 15v6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
          </Match>
          <Match when={props.name === 'updates'}>
            <path d="M18 34a14 14 0 0 1 24-10l4 4" class="glyph-ink" />
            <path d="M46 20v8h-8" class="glyph-ink" />
            <path d="M46 34a14 14 0 0 1-24 10l-4-4" class="glyph-ink" />
            <path d="M18 48v-8h8" class="glyph-ink" />
            <path d="M32 26v12M27 33l5 5 5-5" class="glyph-accent" />
          </Match>
          <Match when={props.name === 'file-system'}>
            <path
              d="M12 22v26a3 3 0 0 0 3 3h34a3 3 0 0 0 3-3V26a3 3 0 0 0-3-3H31l-5-6H15a3 3 0 0 0-3 3Z"
              class="glyph-ink"
            />
            <path d="M22 34h20M22 41h13" class="glyph-accent" />
          </Match>
          <Match when={props.name === 'camera'}>
            <path
              d="M10 24a4 4 0 0 1 4-4h7l4-5h14l4 5h7a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4Z"
              class="glyph-ink"
            />
            <circle cx="32" cy="35" r="9" class="glyph-ink" />
            <circle cx="32" cy="35" r="3.5" class="glyph-accent-fill" />
            <circle cx="46" cy="27" r="1.5" class="glyph-accent-fill" />
          </Match>
          <Match when={props.name === 'location'}>
            <path
              d="M32 54s-15-13.5-15-26a15 15 0 0 1 30 0c0 12.5-15 26-15 26Z"
              class="glyph-ink"
            />
            <circle cx="32" cy="28" r="5" class="glyph-accent-fill" />
            <path d="M18 56h28" class="glyph-ink" />
          </Match>
          <Match when={props.name === 'biometrics'}>
            <path d="M14 22v-5a3 3 0 0 1 3-3h5M42 14h5a3 3 0 0 1 3 3v5" class="glyph-ink" />
            <path d="M50 42v5a3 3 0 0 1-3 3h-5M22 50h-5a3 3 0 0 1-3-3v-5" class="glyph-ink" />
            <path d="M25 26v4M39 26v4" class="glyph-ink" />
            <path d="M32 26v9h-3" class="glyph-ink" />
            <path d="M25 40c4 4 10 4 14 0" class="glyph-accent" />
          </Match>
          <Match when={props.name === 'sign-in'}>
            <rect x="12" y="14" width="30" height="36" rx="4" class="glyph-ink" />
            <path d="M18 22h18" class="glyph-ink" />
            <circle cx="27" cy="33" r="5" class="glyph-ink" />
            <path d="M44 32h12M50 26l6 6-6 6" class="glyph-accent" />
          </Match>
          <Match when={props.name === 'media'}>
            <rect x="10" y="16" width="44" height="30" rx="4" class="glyph-ink" />
            <path d="M28 25v12l10-6Z" class="glyph-accent-fill" />
            <path d="M10 52h44" class="glyph-ink" />
            <circle cx="24" cy="52" r="2.5" class="glyph-accent-fill" />
          </Match>
          <Match when={props.name === 'database'}>
            <ellipse cx="32" cy="16" rx="16" ry="6" class="glyph-ink" />
            <path d="M16 16v32c0 3.3 7.2 6 16 6s16-2.7 16-6V16" class="glyph-ink" />
            <path d="M16 32c0 3.3 7.2 6 16 6s16-2.7 16-6" class="glyph-accent" />
          </Match>
          <Match when={props.name === 'network'}>
            <path d="M10 27a31 31 0 0 1 44 0" class="glyph-ink" />
            <path d="M17 34a21 21 0 0 1 30 0" class="glyph-ink" />
            <path d="M24 41a11 11 0 0 1 16 0" class="glyph-accent" />
            <circle cx="32" cy="48" r="3" class="glyph-accent-fill" />
          </Match>
        </Switch>
      </svg>
    </landing-expo-glyph>
  );
}
