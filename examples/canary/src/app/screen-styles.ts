/**
 * Layout shared by the example pages, so each page is about its feature and not its chrome.
 *
 * Colours are not here: they follow the system appearance, so they live in the global sheet as
 * classes (`screen`, `heading`, `body`, `hint`, `strong`, `card`, `button`, `button-label`) over
 * a light and a dark palette. See global-styles.ts, and palette.ts for the colours TypeScript
 * binds.
 */
export const page = {
  content: { padding: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
};
