import { getOwner, onCleanup } from 'solid-js';
import { expoModule } from '../native.ts';
import { silence, sourcedService } from './owned.ts';

export interface NativeSplashScreen {
  preventAutoHideAsync(): Promise<boolean>;
  hideAsync(): Promise<void>;
}
export function expoSplashScreen(): NativeSplashScreen | null {
  return expoModule(
    'expo-splash-screen',
    () => require('expo-splash-screen') as NativeSplashScreen,
  );
}

/** The explicit startup instance also works before a Solid owner exists. */
export class Splash {
  private resolved: { native: NativeSplashScreen | null } | undefined;
  private resolving = false;
  private active = true;
  private held = false;
  private holding = false;
  private revision = 0;
  private readonly source: NativeSplashScreen | null | (() => NativeSplashScreen | null);
  constructor(source: NativeSplashScreen | null | (() => NativeSplashScreen | null)) {
    this.source = source;
    if (getOwner()) onCleanup(() => this.dispose());
  }
  private get native(): NativeSplashScreen | null {
    if (!this.active || this.resolving) return null;
    if (this.resolved) return this.resolved.native;
    this.resolving = true;
    const request = this.revision;
    try {
      const native = typeof this.source === 'function' ? this.source() : this.source;
      this.resolved = { native };
    } finally {
      this.resolving = false;
    }
    // A source getter may request another action before its native module is available.
    if (this.active && this.revision !== request) {
      if (this.held) this.hold();
      else silence(() => this.hide());
    }
    return this.resolved.native;
  }
  get available(): boolean {
    return this.native !== null;
  }

  /** Native hold/hide races are harmless; module acquisition errors remain actionable. */
  hold(): void {
    if (!this.active) return;
    this.revision++;
    this.held = true;
    const native = this.native;
    if (!this.active || !this.held || this.holding || !native) return;
    this.holding = true;
    silence(() => native.preventAutoHideAsync());
  }
  async hide(): Promise<void> {
    if (!this.active) return;
    const request = ++this.revision;
    this.held = false;
    this.holding = false;
    const native = this.native;
    if (!native || !this.active || this.revision !== request) return;
    try {
      await native.hideAsync();
    } catch {
      /* An already-hidden splash must not block startup. */
    }
  }

  /** Preserve a work failure, still attempt the frame and hide, and ignore superseded waits. */
  async hideWhenReady(work: Promise<unknown>, nextFrame = defaultFrame): Promise<void> {
    const request = this.revision;
    const current = () => this.active && request === this.revision;
    let failed = false;
    let failure: unknown;
    try {
      await work;
    } catch (error) {
      failed = true;
      failure = error;
    }
    if (current()) {
      try {
        await nextFrame();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
      if (current()) {
        try {
          await this.hide();
        } catch (error) {
          if (!failed) {
            failed = true;
            failure = error;
          }
        }
      }
    }
    if (failed) throw failure;
  }
  /** Cancel future JS work. Disposing a scope never hides another scope's native splash. */
  dispose(): void {
    this.active = false;
    this.revision++;
  }
}
const defaultFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof globalThis.requestAnimationFrame === 'function')
      globalThis.requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });

export const splashScreen = new Splash(expoSplashScreen);
export const SplashScreen = sourcedService(
  'expo.splashScreen',
  expoSplashScreen,
  (native) => new Splash(native),
);
export type SplashScreen = Splash;
