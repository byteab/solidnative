import type * as Application from 'expo-application';
import type * as Device from 'expo-device';
import type * as Asset from 'expo-asset';
import type * as Font from 'expo-font';
import type * as Splash from 'expo-splash-screen';
import type * as Update from 'expo-updates';
import type { NativeAppInfo } from '../src/solid/app-info.ts';
import type { AssetLike, NativeAssets } from '../src/solid/assets.ts';
import type { NativeFonts } from '../src/solid/fonts.ts';
import type { NativeSplashScreen } from '../src/solid/splash-screen.ts';
import type { NativeUpdates } from '../src/solid/updates.ts';

type Satisfies<T, U extends T> = U;
export type ApplicationContract = Satisfies<
  NonNullable<NativeAppInfo['application']>,
  typeof Application
>;
export type DeviceContract = Satisfies<NonNullable<NativeAppInfo['device']>, typeof Device>;
export type AssetContract = Satisfies<AssetLike, Asset.Asset>;
export type SplashContract = Satisfies<NativeSplashScreen, typeof Splash>;
// Real adapters widen font/asset inputs to accept compiled stylesheet values without
// leaking optional module declarations. Their native-call casts remain checked here.
export function adapters(
  asset: typeof Asset,
  font: typeof Font,
  update: typeof Update,
): {
  assets: NativeAssets;
  fonts: NativeFonts;
  updates: NativeUpdates;
} {
  return {
    assets: { load: (modules) => asset.Asset.loadAsync([...modules] as number[] | string[]) },
    fonts: {
      loadAsync: (map) => font.loadAsync(map as Parameters<typeof font.loadAsync>[0]),
      isLoaded: (family) => font.isLoaded(family),
      getLoadedFonts: () => font.getLoadedFonts(),
    },
    updates: {
      enabled: update.isEnabled,
      check: async () => ({ isAvailable: (await update.checkForUpdateAsync()).isAvailable }),
      fetch: async () => ({ isNew: (await update.fetchUpdateAsync()).isNew }),
      reload: () => update.reloadAsync(),
    },
  };
}
