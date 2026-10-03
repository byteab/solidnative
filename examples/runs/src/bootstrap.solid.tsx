/** @jsxImportSource @solidnative/platform/solid */
import { createNativeRoot, type NativeRootOptions } from '@solidnative/platform/solid';
import {
  conditionSources,
  currentConditions,
  deviceTokens,
  watchConditions,
  type ConditionSources,
} from '@solidnative/device/solid';
import type { StyleSheet } from '@solidnative/fabric';
import { RunsApplication, type RunsApplicationOptions } from './app/app.solid.tsx';

export interface RunsMountOptions extends NativeRootOptions, RunsApplicationOptions {
  readonly tailwind: StyleSheet;
  readonly conditions?: ConditionSources;
}

/** Native dependencies are injected by the entrypoint; every watcher belongs to this root. */
export function mountRuns(options: RunsMountOptions) {
  const sources = options.conditions ?? conditionSources();
  const root = createNativeRoot({
    fabric: options.fabric,
    rootTag: options.rootTag,
    clock: options.clock,
    engineOptions: {
      ...options.engineOptions,
      globalStyles: options.tailwind,
      conditions: currentConditions(sources),
      tokens: options.engineOptions?.tokens ?? deviceTokens(),
    },
  });
  root.render(() => {
    // A theme switch changes what `dark:` matches, and nothing in the app is dirty when it happens.
    watchConditions(root.engine, { sources });
    return <RunsApplication {...options} />;
  });
  return root;
}
