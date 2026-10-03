/**
 * The checks' and tests' side of the preview: everything that renders with the native renderer
 * over the fake Fabric, as a device build would, rather than with the browser host the phone uses.
 *
 * The frame imports this module as `./native-entry.ts?learn-native`, and `build/learn-native.ts`
 * carries the query on to every workspace module it imports and resolves
 * `@solid-native/platform/solid` to the real package for them, so this is a second copy of the
 * renderer, the components, the device services and `@solid-native/testing` beside the phone's.
 * `solid-js` is shared, so there is one reactive runtime. Under Node (`lessons.test.ts`) there is
 * only this copy.
 */
import * as solid from 'solid-js';
import * as store from 'solid-js/store';
import * as components from '@solid-native/components/solid';
import * as device from '@solid-native/device/solid';
import { registerPlatformComponents, type EngineOptions } from '@solid-native/fabric';
import * as platform from '@solid-native/platform/solid';
import * as testing from '@solid-native/testing';
import { vitest } from './vitest-api.ts';

export { runChecks, runTestFile, type NativeStyles, type RunnerOptions } from './test-runner.ts';

export type Platform = 'ios' | 'android';

let current: Platform = 'ios';

/**
 * The platform the fake Fabric commits for, in every render from here on. It cannot be changed
 * back within one module graph, because `registerPlatformComponents` cannot.
 */
export function usePlatform(next: Platform): void {
  current = next;
  registerPlatformComponents(next);
}

/**
 * `@solid-native/testing` as a learner's test or a lesson's check imports it: every render on the
 * preview's platform, and with `engineOptions` (Tailwind's sheet, as an app's own setup passes it).
 */
export function testingWith(engineOptions: EngineOptions = {}): typeof testing {
  const render: typeof testing.render = (component, options = {}) =>
    testing.render(component, {
      platform: current,
      ...options,
      engineOptions: { ...engineOptions, ...options.engineOptions },
    });
  return { ...testing, render };
}

/** What a learner's file, a test or a check may import, as this renderer has it. */
export function libraries(engineOptions?: EngineOptions): Record<string, unknown> {
  return {
    'solid-js': solid,
    'solid-js/store': store,
    '@solid-native/platform/solid': platform,
    '@solid-native/components/solid': components,
    '@solid-native/device/solid': device,
    '@solid-native/testing': testingWith(engineOptions),
    vitest,
  };
}

export const { cleanup } = testing;
