/**
 * The little of Babel's API the preview's compiler uses. The packages ship no types of their own
 * and the site installs none: they come from `@solid-native/metro`'s dependencies (see
 * `vite.config.ts`).
 */
declare module '@babel/core' {
  export interface TransformOptions {
    filename?: string;
    babelrc?: boolean;
    configFile?: boolean;
    sourceType?: 'module' | 'script';
    retainLines?: boolean;
    compact?: boolean;
    highlightCode?: boolean;
    presets?: unknown[];
    plugins?: unknown[];
  }
  export function transform(
    code: string,
    options: TransformOptions,
  ): { code?: string | null } | null;
}

declare module 'babel-preset-solid' {
  const preset: unknown;
  export default preset;
}

declare module '@babel/plugin-transform-typescript' {
  const plugin: unknown;
  export default plugin;
}
