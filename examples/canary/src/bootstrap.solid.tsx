/** @jsxImportSource @solid-native/platform/solid */
import { createNativeRoot, type NativeRootOptions } from '@solid-native/platform/solid';
import {
  conditionSources,
  currentConditions,
  deviceTokens,
  watchConditions,
  type ConditionSources,
} from '@solid-native/device/solid';
import type { StyleSheet } from '@solid-native/fabric';
import { CanaryApplication, type CanaryApplicationOptions } from './app/app.config.solid.tsx';
import { canaryStyles } from './app/global-styles.solid.ts';

export interface CanaryMountOptions extends NativeRootOptions, CanaryApplicationOptions {
  readonly tailwind: StyleSheet;
  readonly conditions?: ConditionSources;
}

/** Native dependencies are injected by the entrypoint; every watcher belongs to this root. */
export function mountCanary(options: CanaryMountOptions) {
  const sources = options.conditions ?? conditionSources();
  const root = createNativeRoot({
    fabric: options.fabric,
    rootTag: options.rootTag,
    clock: options.clock,
    engineOptions: {
      ...options.engineOptions,
      globalStyles: canaryStyles(options.tailwind),
      conditions: currentConditions(sources),
      tokens: options.engineOptions?.tokens ?? deviceTokens(),
    },
  });
  root.render(() => {
    watchConditions(root.engine, { sources });
    return <CanaryApplication {...options} />;
  });
  return root;
}
