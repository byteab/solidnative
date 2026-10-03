import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { callerCleanup, ownedRequests, silence, sourcedService } from './owned.ts';
import { Permission, type PermissionResponse } from './permissions.ts';

export interface NativeScreenCapture {
  isAvailableAsync(): Promise<boolean>;
  preventScreenCaptureAsync(key?: string): Promise<void>;
  allowScreenCaptureAsync(key?: string): Promise<void>;
  enableAppSwitcherProtectionAsync(blurIntensity?: number): Promise<void>;
  disableAppSwitcherProtectionAsync(): Promise<void>;
  addScreenshotListener(callback: () => void): { remove(): void };
  getPermissionsAsync(): Promise<PermissionResponse>;
  requestPermissionsAsync(): Promise<PermissionResponse>;
}
export interface ScreenCapture {
  readonly permission: Permission;
  readonly screenshots: Accessor<number>;
  available(): Promise<boolean>;
  prevent(key?: string): Promise<void>;
  allow(key?: string): Promise<void>;
  protectAppSwitcher(blurIntensity?: number): Promise<void>;
  unprotectAppSwitcher(): Promise<void>;
}
const UNAVAILABLE: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };
export const ScreenCapture = sourcedService<ScreenCapture, NativeScreenCapture | null>(
  'expo.screenCapture',
  () =>
    expoModule('expo-screen-capture', () => require('expo-screen-capture') as NativeScreenCapture),
  (native) => {
    const requests = ownedRequests();
    const [screenshots, setScreenshots] = createSignal(0);
    const permission = Permission.of(
      () => native?.getPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
      () => native?.requestPermissionsAsync() ?? Promise.resolve(UNAVAILABLE),
    );
    const shared = native ? captureState(native) : undefined;
    const keys = new Map<string, { key?: string; claim: object }>();
    let protection: Protection | undefined;
    let listener: { remove(): void } | undefined;
    let listening = true;
    const allow = (key?: string, force = false) => {
      const normalized = key ?? 'default';
      const entry = keys.get(normalized);
      keys.delete(normalized);
      if (entry) shared?.keys.get(normalized)?.delete(entry.claim);
      return shared?.syncKey(normalized, key, force) ?? Promise.resolve();
    };
    const unprotect = (force = false) => {
      if (protection && shared) shared.protection.splice(shared.protection.indexOf(protection), 1);
      protection = undefined;
      return shared?.syncProtection(force) ?? Promise.resolve();
    };
    onCleanup(() => {
      listening = false;
      silence(() => listener?.remove());
      for (const { key } of keys.values()) silence(() => allow(key));
      if (protection) silence(() => unprotect());
    });
    listener = native?.addScreenshotListener(() => {
      if (listening && requests.active()) setScreenshots((value) => value + 1);
    });
    if (!requests.active()) silence(() => listener?.remove());
    return {
      permission,
      screenshots,
      available: () => requests.run(false, async () => (await native?.isAvailableAsync()) ?? false),
      prevent: (key) =>
        requests.run(undefined, () => {
          const normalized = key ?? 'default';
          const claim = {};
          const previous = keys.get(normalized);
          keys.set(normalized, { key, claim });
          const claims = shared?.keys.get(normalized) ?? new Set<object>();
          claims.add(claim);
          if (previous) claims.delete(previous.claim);
          shared?.keys.set(normalized, claims);
          callerCleanup(() => {
            if (keys.get(normalized)?.claim === claim) silence(() => allow(key));
          });
          return shared?.syncKey(normalized, key);
        }),
      allow: (key) => requests.run(undefined, () => allow(key, true)),
      protectAppSwitcher: (intensity) =>
        requests.run(undefined, () => {
          const claim = { intensity };
          if (protection && shared)
            shared.protection.splice(shared.protection.indexOf(protection), 1);
          protection = claim;
          shared?.protection.push(claim);
          callerCleanup(() => {
            if (protection === claim) silence(() => unprotect());
          });
          return shared?.syncProtection();
        }),
      unprotectAppSwitcher: () => requests.run(undefined, () => unprotect(true)),
    };
  },
);

interface Protection {
  intensity: number | undefined;
}
interface CaptureState {
  keys: Map<string, Set<object>>;
  protection: Protection[];
  syncKey(normalized: string, nativeKey?: string, forceAllow?: boolean): Promise<void>;
  syncProtection(forceDisable?: boolean): Promise<void>;
}
const captureStates = new WeakMap<NativeScreenCapture, CaptureState>();
/** Native capture keys and switcher policy are shared by all scopes using one source. */
function captureState(native: NativeScreenCapture): CaptureState {
  const existing = captureStates.get(native);
  if (existing) return existing;
  const keys = new Map<string, Set<object>>();
  const protection: Protection[] = [];
  const acquired = new Set<string>();
  let applied: Protection | undefined;
  let tail = Promise.resolve();
  const enqueue = (action: () => unknown) => {
    const result = tail.then(action).then(() => undefined);
    tail = result.catch(() => {});
    return result;
  };
  const state: CaptureState = {
    keys,
    protection,
    syncKey: (normalized, nativeKey, forceAllow) =>
      enqueue(async () => {
        if (keys.get(normalized)?.size) {
          if (acquired.has(normalized)) return;
          await native.preventScreenCaptureAsync(nativeKey);
          acquired.add(normalized);
        } else {
          keys.delete(normalized);
          if (!acquired.delete(normalized) && !forceAllow) return;
          try {
            await native.allowScreenCaptureAsync(nativeKey);
          } catch (error) {
            acquired.add(normalized);
            throw error;
          }
        }
      }),
    syncProtection: (forceDisable) =>
      enqueue(async () => {
        const next = protection.at(-1);
        if (next === applied && (next || !forceDisable)) return;
        if (next) await native.enableAppSwitcherProtectionAsync(next.intensity);
        else await native.disableAppSwitcherProtectionAsync();
        applied = next;
      }),
  };
  captureStates.set(native, state);
  return state;
}
