import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { getFabricUIManager, registerPlatformComponents } from '@solidnative/fabric';
import { registerExpoUiViews, registerExpoView } from '@solidnative/expo/views';
import { mountMusic } from './bootstrap.solid.tsx';
// The generated stylesheet. The Tailwind CLI writes CSS; the Metro config compiles it into this
// module, because Expo's transform worker turns a `.css` import into an empty module on native.
import tailwind from '../.solid-native/app.tailwind.js';

/**
 * The music app's entry, rendered by Solid.
 */
registerPlatformComponents(Platform.OS);

// expo-image's Fabric view, under an element name of our choosing. Its React component is
// skipped entirely; the props the component would have computed are written in the screens.
registerExpoView('expo-image', 'ExpoImage');
// The seek slider on the Now Playing screen is a real SwiftUI/Compose control.
registerExpoUiViews(Platform.OS as 'ios' | 'android');

// registerRunnable, not registerComponent: RN stores a raw mount callback and never renders it
// with its own renderer.
AppRegistry.registerRunnable('main', ({ rootTag }) => {
  mountMusic({
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
