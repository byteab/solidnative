/**
 * A region of a file, marked in the file itself: `/* excerpt: css *\/` ... `/* excerpt end *\/`,
 * or the same in `<!-- -->` or `//` comments, or as a TSX comment, `{/* excerpt: tsx *\/}`. The landing page shows the few lines that carry a
 * feature rather than a whole screen nobody would read, and the lines stay the running code.
 */

const START = /excerpt:\s*(\w+)/;
const END = /excerpt end/;
const MARKER = /^\s*\{?\s*(?:\/\*|<!--|\/\/)\s*excerpt(?::\s*\w+| end)\s*(?:\*\/|-->)?\s*\}?\s*$/;

/** The file with its marker lines taken out, for a view of the whole thing. */
export function withoutMarkers(text: string): string {
  return text
    .split('\n')
    .filter((line) => !MARKER.test(line))
    .join('\n');
}

/** The marked region, dedented, and the language its start marker names. */
export function excerpt(text: string): { lang: string; text: string } {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => MARKER.test(line) && START.test(line));
  const end = lines.findIndex((line, i) => i > start && MARKER.test(line) && END.test(line));
  if (start < 0 || end < 0)
    throw new Error('No excerpt region: mark one with "excerpt: <lang>" and "excerpt end".');
  const body = lines.slice(start + 1, end);
  const indent = Math.min(
    ...body.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length),
  );
  return {
    lang: START.exec(lines[start]!)![1]!,
    text: body.map((line) => line.slice(indent)).join('\n') + '\n',
  };
}
