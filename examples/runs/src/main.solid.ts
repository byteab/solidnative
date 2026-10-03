import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { getFabricUIManager, registerPlatformComponents } from '@solidnative/fabric';
import { registerExpoMap } from '@solidnative/expo/solid/map-view';
import { mountRuns } from './bootstrap.solid.tsx';
// The generated stylesheet. The Tailwind CLI writes CSS; the Metro config compiles it into this
// module, because Expo's transform worker turns a `.css` import into an empty module on native.
import tailwind from '../.solidnative/app.tailwind.js';

/**
 * The app's entry, rendered by Solid. The `.solid.ts` suffix is what gives this file Metro's
 * clean native reload in development.
 */
registerPlatformComponents(Platform.OS);
// `<expo-map>`: expo-maps' Apple view here, its Google view on Android.
registerExpoMap(Platform.OS as 'ios' | 'android');

// registerRunnable, not registerComponent: React Native stores a raw mount callback and never
// renders it with its own renderer.
AppRegistry.registerRunnable('main', ({ rootTag }) => {
  mountRuns({
    fabric: getFabricUIManager(),
    rootTag: Number(rootTag),
    tailwind,
    engineOptions: {
      processColor,
      // require()d images compile to an asset id; only this turns one into a usable source.
      resolveAssetSource: (value: unknown) => Image.resolveAssetSource(value as never),
    },
  });
});
