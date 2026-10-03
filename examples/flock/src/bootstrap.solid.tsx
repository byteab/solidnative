/** @jsxImportSource @solidnative/platform/solid */
import { createNativeRoot, type NativeRootOptions } from '@solidnative/platform/solid';
import {
  conditionSources,
  currentConditions,
  deviceTokens,
  watchConditions,
} from '@solidnative/device/solid';
import type { StyleSheet } from '@solidnative/fabric';
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
