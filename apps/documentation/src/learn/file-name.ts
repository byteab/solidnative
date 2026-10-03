/**
 * Lesson file names: which file the preview mounts, which are tests, how the editor highlights
 * each, and the name a learner types for a new file, checked.
 */

/** The file the preview mounts, the one exporting `App`: the first of these a lesson has. */
const ENTRIES = ['app.tsx', 'app.ts', 'src/app.tsx'];

export function findEntry(files: Readonly<Record<string, string>>): string | undefined {
  return ENTRIES.find((name) => name in files);
}

export function isTestFile(name: string): boolean {
  return /\.(spec|test)\.tsx?$/.test(name);
}

/** How the editor reads a file: `.css` and `.native.css` as CSS, everything else as TSX. */
export function languageOf(name: string): 'css' | 'tsx' {
  return name.endsWith('.css') ? 'css' : 'tsx';
}

/** Kebab-case, as the style guide names files: a component or test, or a stylesheet. */
const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:(?:\.spec|\.test)?\.tsx?|(?:\.native)?\.css)$/;

export type FileNameResult = { readonly name: string } | { readonly error: string };

/** A new file's name: kebab-case, `.tsx` when no extension is given, and not one already there. */
export function checkFileName(typed: string, existing: readonly string[]): FileNameResult {
  const trimmed = typed.trim();
  if (!trimmed) return { error: 'Type a name, such as new-habit.tsx.' };
  const name = /\.(tsx?|css)$/.test(trimmed) ? trimmed : `${trimmed}.tsx`;
  if (!KEBAB.test(name)) {
    return { error: 'Use lower case letters, digits and hyphens, as in new-habit.tsx.' };
  }
  if (existing.includes(name)) return { error: `There is already a file called ${name}.` };
  return { name };
}
