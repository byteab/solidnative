/** @jsxImportSource solid-js */
/**
 * A phone as it looks in the hand, with a real screen in it: the hero's frame.
 *
 * The rest of the page draws its devices in ink; the hero is the one place that shows the product
 * the way a store listing would, so its phones are rendered - a metal edge, a black bezel, side
 * buttons, and the shadow of something sitting a few centimetres off the page. The screen is
 * still a capture from the simulator or emulator, never a mock (see `README.md`). Styled by
 * `landing.css`'s phone block.
 */
import { Show } from 'solid-js';

export type DevicePlatform = 'ios' | 'android';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'landing-phone': HTMLAttributes<HTMLElement>;
    }
    interface ExplicitAttributes {
      'data-slot': string;
    }
  }
}

/** The captures' own proportions: 1206 x 2622 on iOS, 1080 x 2400 on Android. */
const SCREEN_RATIO: Record<DevicePlatform, string> = { ios: '1206 / 2622', android: '1080 / 2400' };

export function LandingPhone(props: {
  platform: DevicePlatform;
  /** A capture's base name: `player` for `player-ios-light.webp`. */
  shot?: string;
  /** A capture anywhere under `public/`, in place of `shot`: the example apps keep their own. */
  src?: string;
  /** Which of the capture's themes: `settings` has both, `plans` is photographed dark. */
  scheme?: 'light' | 'dark';
  /** A second capture laid over the first, for a section to crossfade to. */
  swap?: string;
  alt?: string;
  eager?: boolean;
  class?: string;
  /** Set as `data-slot` on the host, for the hero's fan. */
  slot?: string;
}) {
  const path = (shot: string) =>
    `/showcase/${shot}-${props.platform}-${props.scheme ?? 'light'}.webp`;
  const height = () => (props.platform === 'ios' ? 1217 : 1244);
  return (
    <landing-phone class={`block ${props.class ?? ''}`} attr:data-slot={props.slot}>
      <div class="phone" data-platform={props.platform}>
        <span class="phone-button is-action" aria-hidden="true" />
        <span class="phone-button is-volume-up" aria-hidden="true" />
        <span class="phone-button is-volume-down" aria-hidden="true" />
        <span class="phone-button is-power" aria-hidden="true" />
        <div class="phone-screen" style={{ 'aspect-ratio': SCREEN_RATIO[props.platform] }}>
          <img
            src={props.src ?? path(props.shot ?? '')}
            alt={props.alt ?? ''}
            width="560"
            height={height()}
            loading={props.eager ? 'eager' : 'lazy'}
            fetchpriority={props.eager ? 'high' : undefined}
            decoding="async"
          />
          <Show when={props.swap}>
            {(next) => (
              // Laid over the first, for a section to crossfade to: see landing.css's .is-swap.
              <img
                class="device-shot is-swap"
                src={path(next())}
                alt=""
                width="560"
                height={height()}
                loading="lazy"
                decoding="async"
              />
            )}
          </Show>
          <Show when={props.platform === 'android'}>
            <span class="phone-camera" aria-hidden="true" />
          </Show>
        </div>
      </div>
    </landing-phone>
  );
}
