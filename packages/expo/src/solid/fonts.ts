import { createSignal, getOwner, onCleanup, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { sourcedService } from './owned.ts';

export interface FontFace {
  readonly family: string;
  readonly source: unknown;
  readonly weight?: number;
  readonly style?: string;
}
export interface SheetWithFonts {
  readonly fonts?: readonly FontFace[];
}
export interface NativeFonts {
  loadAsync(map: Record<string, unknown>): Promise<void>;
  isLoaded(family: string): boolean;
  getLoadedFonts(): string[];
}

export function registrationsFor(faces: readonly FontFace[]): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const face of faces) {
    map[face.family] ??= face.source;
    if (face.weight !== undefined) map[`${face.family}-${face.weight}`] = face.source;
    if (face.style) map[`${face.family}-${face.style}`] = face.source;
  }
  return map;
}

export function expoFonts(): NativeFonts | null {
  const expo = expoModule('expo-font', () => require('expo-font') as typeof import('expo-font'));
  if (!expo) return null;
  return {
    loadAsync: (map) => expo.loadAsync(map as Parameters<typeof expo.loadAsync>[0]),
    isLoaded: (family) => expo.isLoaded(family),
    getLoadedFonts: () => expo.getLoadedFonts(),
  };
}

/** Usable before mounting; owner-created registries also end with that owner. */
export class FontRegistry {
  private active = true;
  private readonly generation = createSignal(0);
  private readonly pending = new Set<() => void>();
  private readonly native: NativeFonts | null;
  constructor(native: NativeFonts | null) {
    this.native = native;
    if (getOwner()) onCleanup(() => this.dispose());
  }
  get available(): boolean {
    return this.native !== null;
  }
  readonly families: Accessor<readonly string[]> = () => {
    this.generation[0]();
    return this.native?.getLoadedFonts() ?? [];
  };
  has(family: string): boolean {
    this.generation[0]();
    return this.native?.isLoaded(family) ?? false;
  }
  async loadSheet(...sheets: readonly (SheetWithFonts | null | undefined)[]): Promise<void> {
    if (!this.active) return;
    const faces = sheets.flatMap((sheet) => [...(sheet?.fonts ?? [])]);
    if (faces.length) await this.load(registrationsFor(faces));
  }
  load(map: Record<string, unknown>): Promise<void> {
    if (!this.active || !this.native) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      let active = true;
      const finish = (complete: () => void) => {
        if (!active) return;
        active = false;
        this.pending.delete(cancel);
        complete();
      };
      const cancel = () => finish(resolve);
      this.pending.add(cancel);
      if (getOwner()) onCleanup(cancel);
      try {
        const snapshot = { ...map };
        if (!this.active || !active) return cancel();
        void Promise.resolve(this.native!.loadAsync(snapshot)).then(
          () => {
            if (!active) return;
            this.generation[1]((value) => value + 1);
            finish(resolve);
          },
          (error: unknown) => finish(() => reject(error)),
        );
      } catch (error) {
        finish(() => reject(error));
      }
    });
  }
  dispose(): void {
    if (!this.active) return;
    this.active = false;
    for (const cancel of [...this.pending]) cancel();
  }
}
export const Fonts = sourcedService('expo.fonts', expoFonts, (native) => new FontRegistry(native));
export type Fonts = FontRegistry;

/** Pre-owner bootstrap helper. Use FontRegistry explicitly to inject a startup source. */
export function loadFonts(
  ...sheets: readonly (SheetWithFonts | null | undefined)[]
): Promise<void> {
  return new FontRegistry(expoFonts()).loadSheet(...sheets);
}
