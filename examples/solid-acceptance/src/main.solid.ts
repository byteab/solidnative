import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { getFabricUIManager, registerPlatformComponents } from '@solidnative/fabric';
import { mountApp } from './bootstrap.solid.tsx';
// The generated stylesheet. The Tailwind CLI writes CSS; the Metro config compiles it into this
// module, because Expo's transform worker turns a `.css` import into an empty module on native.
import tailwind from '../.solidnative/app.tailwind.js';

// The `.solid.ts` suffix gives this file Metro's clean reload in development: an edit disposes the
// root and reloads the JS VM, where React Refresh would patch components in place.
registerPlatformComponents(Platform.OS);

// registerRunnable, not registerComponent: React Native keeps the mount callback and never renders
// anything with its own renderer.
AppRegistry.registerRunnable('main', ({ rootTag }: { rootTag: number | string }) => {
  mountApp({
    fabric: getFabricUIManager(),
    rootTag: Number(rootTag),
    tailwind,
    engineOptions: {
      // Colours, as the integers the platform wants.
      processColor,
      // Turns a `require('./x.png')` into something native can load. Without it images are blank.
      resolveAssetSource: (value) => Image.resolveAssetSource(value as never),
    },
  });
});
