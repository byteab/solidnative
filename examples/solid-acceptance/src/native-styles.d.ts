// A `.native.css` import is the stylesheet Metro compiled from it.
declare module '*.native.css' {
  const sheet: import('@solid-native/fabric').StyleSheet;
  export default sheet;
}

// The stylesheet the Metro config generates from `src/tailwind.css`.
declare module '*.tailwind.js' {
  const sheet: import('@solid-native/fabric').StyleSheet;
  export default sheet;
}
