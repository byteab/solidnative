/**
 * The course's second module graph: `?learn-native`.
 *
 * `solidNativeWeb()` resolves `@solid-native/platform/solid` to the browser host for the whole build,
 * which is what the phone in the preview frame renders with. The checks and the learner's tests
 * render with the native renderer instead, over a fake Fabric, as an app's tests do in Node. So
 * `src/learn/preview/frame.ts` imports `./native-entry.ts?learn-native`, and this plugin carries
 * the query on to every workspace module that graph imports - the components, the device
 * services, the engine - and resolves `@solid-native/platform/solid` there to the real package. The
 * result is a second copy of each of those, separate from the phone's.
 *
 * Modules from `node_modules` keep their ids, so the two graphs share one `solid-js`, as two
 * renderers in one app would. So do virtual modules and ids that already carry a query.
 *
 * Listed before `solidNativeWeb()`, so it sees `@solid-native/platform/solid` first.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'vite';

const QUERY = '?learn-native';
/** `solidNativeWeb()`'s stand-in for `@solid-native/device`'s lazy React Native lookup. */
const NATIVE_UNAVAILABLE = '\0solid-browser-native-unavailable';

const inGraph = (id: string | undefined): id is string => !!id?.endsWith(QUERY);
const tag = (id: string) => `${id}${QUERY}`;

export function learnNative(): Plugin {
  const platform = createRequire(import.meta.url).resolve('@solid-native/platform/solid');
  return {
    name: 'documentation:learn-native',
    enforce: 'pre',
    async resolveId(id, importer, options) {
      if (!inGraph(importer)) return null;
      const from = importer.slice(0, -QUERY.length);
      if (id === '@solid-native/platform/solid') return tag(platform);
      // The renderer's guarded `require`s of React Native's own modules, which answer nothing here
      // (see the `require` in `frame.ts`): left for run time, as Metro would leave them to the app.
      if (/^react-native(?:\/|$)/.test(id)) return { id, external: true };
      const resolved = await this.resolve(id, from, { ...options, skipSelf: true });
      if (!resolved || resolved.external) return resolved;
      // The device services' real lookup, which answers `null` off a device rather than throwing:
      // the fake Fabric is not a browser, and the browser's sources are the phone's.
      if (resolved.id === NATIVE_UNAVAILABLE) return tag(path.resolve(path.dirname(from), id));
      if (/^\0|\?|[\\/]node_modules[\\/]/.test(resolved.id)) return resolved;
      return { ...resolved, id: tag(resolved.id) };
    },
  };
}
