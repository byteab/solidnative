/** @jsxImportSource @solid-native/platform/solid */
import { createNativeRoot, type NativeRootOptions } from '@solid-native/platform/solid';
import {
  conditionSources,
  currentConditions,
  deviceTokens,
  watchConditions,
} from '@solid-native/device/solid';
import type { StyleSheet } from '@solid-native/fabric';
import { FlockApplication } from './app/app.solid.tsx';

export interface FlockMountOptions extends NativeRootOptions {
  readonly tailwind: StyleSheet;
}

export function mountFlock(options: FlockMountOptions) {
  const sources = conditionSources();
  const root = createNativeRoot({
    fabric: options.fabric,
    rootTag: options.rootTag,
    engineOptions: {
      ...options.engineOptions,
      globalStyles: options.tailwind,
      conditions: currentConditions(sources),
      tokens: deviceTokens(),
    },
  });
  root.render(() => {
    watchConditions(root.engine, { sources });
    return <FlockApplication />;
  });
  return root;
}
