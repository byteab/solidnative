// A `.native.css` import is the stylesheet the build compiled from it, as in an app.
declare module '*.native.css' {
  const sheet: import('@solid-native/fabric').StyleSheet;
  export default sheet;
}
