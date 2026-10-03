/**
 * Modules the build generates rather than files on disk, declared for the type checker.
 */

/**
 * The API extraction, served by `build/api.ts` as a virtual module. There is no file: the plugin
 * generates the module's source at build time from the workspace's own TypeScript.
 */
declare module 'virtual:solid-native/api' {
  import type { ApiEntry } from '../build/api.ts';
  /** Every declaration, keyed `@solid-native/components#Switch`. */
  export const API: Record<string, ApiEntry>;
  export default API;
}

/** A file's own source, read off disk and highlighted at build time by `build/source.ts`. */
declare module '*?source' {
  export const html: string;
  export const text: string;
  export default html;
}

/** Only the region a file marks with `excerpt:` markers; see `build/excerpt.ts`. */
declare module '*?excerpt' {
  export const html: string;
  export const text: string;
  export default html;
}

/** Every example app's source files, read out of its folder by `build/example-sources.ts`. */
declare module 'virtual:solid-native/example-sources' {
  export interface ExampleSourceFile {
    /** Relative to the app's folder, with forward slashes. */
    readonly path: string;
    /** The file, highlighted. */
    readonly load: () => Promise<string>;
  }
  /** Keyed by the app's slug. */
  export const EXAMPLE_SOURCES: Record<string, readonly ExampleSourceFile[]>;
}

/** A universal component's stylesheet, compiled at build time; see `solidNativeWeb()`. */
declare module '*.native.css' {
  const sheet: import('@solid-native/fabric').StyleSheet;
  export default sheet;
}
