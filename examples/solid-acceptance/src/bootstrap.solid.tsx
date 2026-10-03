/** @jsxImportSource @solidnative/platform/solid */
import { createNativeRoot, type NativeRootOptions } from '@solidnative/platform/solid';
import {
  ServiceScope,
  conditionSources,
  currentConditions,
  deviceTokens,
  watchConditions,
  type ConditionSources,
  type ServiceBinding,
} from '@solidnative/device';
import type { StyleSheet } from '@solidnative/fabric';
import type { NativeNavigation } from '@solidnative/router';
import { App } from './app/app.solid.tsx';

export interface AppMountOptions extends NativeRootOptions {
  /** The compiled Tailwind sheet, applied app-wide. */
  readonly tailwind?: StyleSheet;
  /** Where screen size and colour scheme come from: the device's own unless a test passes some. */
  readonly conditions?: ConditionSources;
  readonly services?: readonly ServiceBinding[];
  readonly onNavigation?: (navigation: NativeNavigation) => void;
}

/** Mounts the app. The entry passes the native pieces; a test passes fakes of the same shape. */
export function mountApp(options: AppMountOptions) {
  const sources = options.conditions ?? conditionSources();
  const root = createNativeRoot({
    fabric: options.fabric,
    rootTag: options.rootTag,
    clock: options.clock,
    engineOptions: {
      ...options.engineOptions,
      globalStyles: options.tailwind,
      // What `@media` and `dark:` resolve against.
      conditions: currentConditions(sources),
      // The hairline width and other values only the device knows.
      tokens: options.engineOptions?.tokens ?? deviceTokens(),
    },
  });
  root.render(() => {
    // Re-resolves the conditions when the device rotates or the theme changes. Owned by the root.
    watchConditions(root.engine, { sources });
    return (
      <ServiceScope services={options.services ?? []}>
        <App onNavigation={options.onNavigation} />
      </ServiceScope>
    );
  });
  return root;
}
