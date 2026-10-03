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
import { NotesApplication, type NotesApplicationOptions } from './app/app.config.solid.tsx';

export interface NotesMountOptions extends NativeRootOptions, NotesApplicationOptions {
  readonly tailwind: StyleSheet;
  readonly conditions?: ConditionSources;
}

/** Native dependencies are injected by the entrypoint; every watcher belongs to this root. */
export function mountNotes(options: NotesMountOptions) {
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
    return <NotesApplication {...options} />;
  });
  return root;
}
