import { AppRegistry, Image, Platform, processColor } from 'react-native';
import { createNativeRoot } from '@solidnative/platform/solid';
import {
  conditionSources,
  currentConditions,
  deviceTokens,
  watchConditions,
} from '@solidnative/device/solid';
import { getFabricUIManager, registerPlatformComponents } from '@solidnative/fabric';
import { App } from './app/app.solid.tsx';

// The `.solid.ts` suffix gives this file Metro's clean reload in development: an edit disposes the
// root and reloads the JS VM, where React Refresh would patch components in place.
registerPlatformComponents(Platform.OS);

// registerRunnable, not registerComponent: React Native keeps the mount callback and never renders
// anything with its own renderer.
AppRegistry.registerRunnable('main', ({ rootTag }: { rootTag: number | string }) => {
  const sources = conditionSources();
  const root = createNativeRoot({
    fabric: getFabricUIManager(),
    rootTag: Number(rootTag),
    engineOptions: {
      // Colours, as the integers the platform wants.
      processColor,
      // What `@media` resolves against. Without it every media query is false and a responsive
      // layout renders as its smallest case.
      conditions: currentConditions(sources),
      // Values only the device knows - the hairline width, which is a third of a point on a 3x
      // screen. Without it `1px` is what you get, and that is a visibly fat divider.
      tokens: deviceTokens(),
      // Turns a `require('./x.png')` into something native can load. Without it images are blank.
      resolveAssetSource: (value) => Image.resolveAssetSource(value as never),
    },
  });
  root.render(() => {
    // Re-resolves the conditions when the device rotates or the theme changes, so `@media` and
    // `dark:` follow. Owned by the root, so it stops when the root is disposed.
    watchConditions(root.engine, { sources });
    return App();
  });
});
