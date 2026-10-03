// `./native-entry.ts?learn-native`: the module, in the native renderer's module graph. See
// `build/learn-native.ts`. The importer casts it to `typeof import('./native-entry.ts')`.
declare module '*?learn-native' {
  const module: unknown;
  export default module;
}
