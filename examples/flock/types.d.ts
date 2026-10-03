/** The stylesheet the Metro config generates from the Tailwind entry. */
declare module '*.tailwind.js' {
  const sheet: import('@solidnative/fabric').StyleSheet;
  export default sheet;
}
