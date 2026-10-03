/**
 * React Native's dev banner - "Refreshing...", "Downloading..." - as its callers drive it.
 */
export interface LoadingBanner {
  showMessage(message: string, type: string, options?: unknown): void;
  hide(): void;
}

/**
 * How long a native hide takes to finish: iOS keeps the banner up for at least 0.6s, then slides
 * it away over 0.25s. Anything sent before then lands on a banner still leaving.
 */
const SETTLE_MS = 900;

/**
 * One show and one hide per burst, however many the callers send.
 *
 * A single edit reaches the banner from three places - Expo's HMR client for each update it
 * receives, its lazy bundle loader, and React Native's own HMR client - so one save sends two or
 * three show/hide pairs inside half a second. On iOS every `hide()` starts a fresh slide upwards
 * from wherever the window is, and a `show()` in between snaps it back while the old slide is still
 * running. UIKit adds the animations together, and the banner is drawn a whole banner-height
 * down: under the navigation bar instead of under the status bar.
 *
 * So a hide goes through only if a show did since the last one, and nothing but an error goes
 * through while a hide is still playing out, which native would half-honour anyway.
 */
export function calmLoadingBanner(banner: LoadingBanner, now: () => number = Date.now): void {
  const show = banner.showMessage.bind(banner);
  const hide = banner.hide.bind(banner);
  let showing = false;
  let settlesAt = 0;

  banner.showMessage = (message, type, options) => {
    // A compile error always shows: it is the one banner that matters.
    if (type !== 'error' && now() < settlesAt) return;
    showing = true;
    show(message, type, options);
  };
  banner.hide = () => {
    if (!showing) return;
    showing = false;
    settlesAt = now() + SETTLE_MS;
    hide();
  };
}

const calmed = Symbol.for('@solid-native/platform/dev-loading-view/calmed');

/**
 * Calm React Native's own banner, once per VM however many roots mount. Dev only, and required
 * rather than imported: React Native ships Flow, which Node cannot parse.
 */
export function calmDevBanner(): void {
  try {
    const { default: banner } = require('react-native/Libraries/Utilities/DevLoadingView') as {
      default?: LoadingBanner & { [calmed]?: true };
    };
    if (!banner || banner[calmed]) return;
    banner[calmed] = true;
    calmLoadingBanner(banner);
  } catch {
    // No React Native under us: a test, or the web.
  }
}
