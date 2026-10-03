import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { getFabricUIManager, registerPlatformComponents } from '@solidnative/fabric';
import { registerExpoUiViews } from '@solidnative/expo/views';
import { mountFlock } from './bootstrap.solid.tsx';
import tailwind from '../.solid-native/app.tailwind.js';

/** Flock's entry, rendered by Solid. */
registerPlatformComponents(Platform.OS);
// Menus, the settings form, the compose gauge and pickers are real SwiftUI / Compose views.
registerExpoUiViews(Platform.OS as 'ios' | 'android');

AppRegistry.registerRunnable('main', ({ rootTag }) => {
  mountFlock({
    fabric: getFabricUIManager(),
    rootTag: Number(rootTag),
    tailwind,
    engineOptions: {
      processColor,
      resolveAssetSource: (value: unknown) => Image.resolveAssetSource(value as never),
    },
  });
});
