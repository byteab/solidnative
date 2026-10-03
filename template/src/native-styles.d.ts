// A `.native.css` import is the stylesheet Metro compiled from it.
declare module '*.native.css' {
  const sheet: import('@solid-native/fabric').StyleSheet;
  export default sheet;
}
