/** The stylesheet the Metro config generates from the Tailwind entry. */
declare module '*.tailwind.js' {
  const sheet: import('@solid-native/fabric').StyleSheet;
  export default sheet;
}
