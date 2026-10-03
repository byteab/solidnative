/**
 * A lesson, loaded: its steps, its files and its checks. The order and titles are in `outline.ts`.
 *
 * Each lesson is a directory under `lessons/`: `lesson.md` (an introduction, then one `##`
 * section per step), `starter/` (the files as the lesson starts), `steps/<n>/` (the files as step
 * n leaves them, for every step but the last), `solution/` (the files as the last step leaves
 * them) and `checks.ts` (what each step asks for, as tests; see `check.ts`).
 */
import { LESSONS, type CourseLesson } from './outline.ts';
import { findEntry, isTestFile } from './file-name.ts';
import type { Files } from './protocol.ts';
import type { DocModule } from '../content.ts';

/** A step of a lesson: a heading, and the instructions under it. */
export interface LessonStep {
  readonly title: string;
  readonly html: string;
}

export interface Lesson extends CourseLesson {
  readonly intro: string;
  readonly steps: readonly LessonStep[];
  readonly starter: Files;
  /**
   * The files as each step leaves them, one per step: what the Solution button puts in place.
   * The last is the lesson's `solution/`, which the checks type-check against.
   */
  readonly snapshots: readonly Files[];
  readonly checks: string;
  /** The file the preview mounts: the one exporting `App`. */
  readonly entry: string;
}

const pages = import.meta.glob<DocModule>('./lessons/*/lesson.md');
/** Every file of every lesson's starter, steps and solution, whatever its kind, as text. */
const lessonFiles = import.meta.glob<string>(
  ['./lessons/*/starter/**/*', './lessons/*/steps/*/**/*', './lessons/*/solution/**/*'],
  { query: '?raw', import: 'default' },
);
const checkFiles = import.meta.glob<string>('./lessons/*/checks.ts', {
  query: '?raw',
  import: 'default',
});

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

/** A heading's text as `marked` escaped it, back to the text: it is shown as text, not HTML. */
function decodeEntities(html: string): string {
  return html.replace(/&(amp|lt|gt|quot|#39);/g, (_, name: string) => ENTITIES[name]!);
}

/**
 * A lesson's page as an introduction and its steps. `build/markdown.ts` renders the whole file to
 * HTML with its headings given ids; a step is everything from one `<h2>` to the next.
 */
export function splitSteps(html: string): { intro: string; steps: LessonStep[] } {
  const [intro = '', ...sections] = html.split(/(?=<h2[\s>])/);
  const steps = sections.map((section) => {
    const heading = /^<h2[^>]*>([\s\S]*?)<\/h2>/.exec(section);
    return {
      title: decodeEntities((heading?.[1] ?? '').replace(/<[^>]+>/g, '')).trim(),
      html: heading ? section.slice(heading[0].length) : section,
    };
  });
  return { intro, steps };
}

/** Editor tab order: the entry first, test files last, the rest by name between. */
export function orderFiles(files: Files, entry = findEntry(files)): string[] {
  const rank = (name: string) => (name === entry ? 0 : isTestFile(name) ? 2 : 1);
  return Object.keys(files).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

async function filesIn(directory: string): Promise<Record<string, string>> {
  const entries = Object.entries(lessonFiles).filter(([path]) => path.startsWith(directory));
  const loaded = await Promise.all(entries.map(async ([path, load]) => [path, await load()]));
  return Object.fromEntries(loaded.map(([path, text]) => [path!.slice(directory.length), text!]));
}

export { COURSE_TITLE, LESSONS, type CourseLesson } from './outline.ts';

export async function loadLesson(slug: string): Promise<Lesson | undefined> {
  const entry = LESSONS.find((lesson) => lesson.slug === slug && !lesson.planned);
  const directory = `./lessons/${slug}/`;
  const page = pages[`${directory}lesson.md`];
  const checks = checkFiles[`${directory}checks.ts`];
  if (!entry || !page || !checks) return undefined;
  const [doc, starter, checkSource] = await Promise.all([
    page(),
    filesIn(`${directory}starter/`),
    checks(),
  ]);
  const html = doc.blocks.map((block) => (block.kind === 'html' ? block.html : '')).join('');
  const { intro, steps } = splitSteps(html);
  const snapshots = await Promise.all(
    steps.map((_, index) =>
      index === steps.length - 1
        ? filesIn(`${directory}solution/`)
        : filesIn(`${directory}steps/${index + 1}/`),
    ),
  );
  return {
    ...entry,
    intro,
    steps,
    starter,
    snapshots,
    checks: checkSource,
    entry: findEntry(starter) ?? orderFiles(starter)[0] ?? 'app.tsx',
  };
}
