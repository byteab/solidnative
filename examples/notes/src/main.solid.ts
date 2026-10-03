import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { getFabricUIManager, registerPlatformComponents } from '@solid-native/fabric';
import { mountNotes } from './bootstrap.solid.tsx';
// The generated stylesheet. The Tailwind CLI writes CSS; the Metro config compiles it into this
// module, because Expo's transform worker turns a `.css` import into an empty module on native.
import tailwind from '../.solid-native/app.tailwind.js';

/**
 * The app's entry, rendered by Solid.
 */
registerPlatformComponents(Platform.OS);

// registerRunnable, not registerComponent: RN stores a raw mount callback and never renders it
// with its own renderer.
AppRegistry.registerRunnable('main', ({ rootTag }) => {
  mountNotes({
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
