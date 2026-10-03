/**
 * The screen: the learner's app mounted with `@solid-native/web/solid`, replaced on every good run
 * and kept on every bad one, so an error is shown over the last thing that worked.
 *
 * The platform is fixed for the life of the frame, because `registerPlatformComponents` changes a
 * table in `@solid-native/fabric` that cannot be put back; the lesson page reloads the frame to
 * switch. The colour scheme is not: the toggle drives `ColorScheme` directly, in place of
 * `prefers-color-scheme`, and keeps the `dark` class on the app's root, as `watchConditions`
 * does on a device.
 */
import { ColorScheme, provideService, type Scheme } from '@solid-native/device/solid';
import { mount, type BrowserComponent, type MountResult } from '@solid-native/web/solid';
import type { Platform } from '../protocol.ts';

/** Where the status bar and home indicator are, as `<SafeAreaProvider>` would report them. */
const INSETS: Record<Platform, { top: number; bottom: number }> = {
  ios: { top: 54, bottom: 34 },
  android: { top: 28, bottom: 16 },
};

export class Phone {
  private mounted: { result: MountResult<object>; root: HTMLElement } | undefined;
  private scheme: Scheme = 'light';
  private readonly listeners = new Set<(scheme: Scheme) => void>();
  private readonly screen: HTMLElement;
  private readonly onError: (error: unknown) => void;

  constructor(screen: HTMLElement, platform: Platform, onError: (error: unknown) => void) {
    this.screen = screen;
    this.onError = onError;
    const root = document.documentElement;
    root.classList.add(`platform-${platform}`);
    root.style.setProperty('--safe-area-inset-top', `${INSETS[platform].top}px`);
    root.style.setProperty('--safe-area-inset-bottom', `${INSETS[platform].bottom}px`);
  }

  get root(): HTMLElement | undefined {
    return this.mounted?.root;
  }

  /** What `ColorScheme` reports, and whether the app's root has the `dark` class. */
  setScheme(scheme: Scheme): void {
    this.scheme = scheme;
    this.mounted?.root.classList.toggle('dark', scheme === 'dark');
    for (const listener of this.listeners) listener(scheme);
  }

  /**
   * Mount `component` beside the current app, and swap it in only if it mounted without an
   * error. Returns the errors the first render raised; with any, the old app stays.
   */
  replace(component: BrowserComponent<object>): unknown[] {
    // The new app is mounted over the old one, both absolutely positioned, so each lays out at
    // the full size of the screen and nothing is painted until the swap is done.
    const errors: unknown[] = [];
    const root = document.createElement('div');
    root.className = 'app-root';
    root.classList.toggle('dark', this.scheme === 'dark');
    this.screen.appendChild(root);
    let result: MountResult<object> | undefined;
    try {
      result = mount(root, component, {
        injectReset: false,
        services: [provideService(ColorScheme.SOURCE, () => this.source())],
        onError: (error) => (result ? this.onError(error) : errors.push(error)),
      });
    } catch (error) {
      errors.push(error);
    }
    if (errors.length || !result) {
      result?.destroy();
      root.remove();
      return errors;
    }
    // `mount` marks its root `platform-web`, for the `web:` variant. This is a phone.
    root.classList.remove('platform-web');
    this.unmount();
    this.mounted = { result, root };
    return [];
  }

  unmount(): void {
    if (!this.mounted) return;
    this.mounted.result.destroy();
    this.mounted.root.remove();
    this.mounted = undefined;
  }

  private source() {
    return {
      current: () => this.scheme,
      subscribe: (listener: (scheme: Scheme) => void) => {
        this.listeners.add(listener);
        return () => void this.listeners.delete(listener);
      },
    };
  }
}
