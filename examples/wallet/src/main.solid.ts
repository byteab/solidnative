import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { getFabricUIManager, registerPlatformComponents } from '@solidnative/fabric';
import { mountWallet } from './bootstrap.solid.tsx';
// The generated stylesheet. The Tailwind CLI writes CSS; the Metro config compiles it into this
// module, because Expo's transform worker turns a `.css` import into an empty module on native.
import tailwind from '../.solid-native/app.tailwind.js';

/**
 * The wallet's entry, rendered by Solid.
 */
registerPlatformComponents(Platform.OS);

AppRegistry.registerRunnable('main', ({ rootTag }) => {
  mountWallet({
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
