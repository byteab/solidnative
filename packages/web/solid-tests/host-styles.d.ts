declare module '*.native.css' {
  const sheet: import('../src/solid/styles.ts').BrowserStyleSheet;
  export default sheet;
}
declare module '*/styles.css';
declare module '@solid-native/metro/solid-browser.cjs' {
  export function compileBrowserCss(
    source: string,
    filename: string,
  ): import('../src/solid/styles.ts').BrowserStyleSheet;
}
