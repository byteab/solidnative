/**
 * Every lesson, checked the way the preview checks a learner: each step's checks pass against the
 * lesson's solution, and the first step's do not pass against its starter, so a lesson can be
 * neither impossible nor already done. Each step's snapshot, what its Solution button puts in
 * place, passes the checks up to that step and not the next step's, so it solves its own step and
 * gives away nothing after it.
 *
 * Run twice, by `lessons.test.ts` and `lessons.android.test.ts`, because the preview runs the
 * checks on whichever platform the phone is showing, and a check that only passes on iOS would
 * mark a finished step unfinished the moment the learner switched to Android. Each is a file of
 * its own because `registerPlatformComponents` changes a table for the life of the module graph,
 * as it does in the preview, where switching platform reloads the frame.
 *
 * The native CSS compiler here is the Node build of the one the preview runs on WebAssembly, and
 * Tailwind goes through the same `flattenTailwind` step, so a check that reads a style reads what
 * a device build would commit. As in the preview, only a check marked `readsStyles` gets them.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { LESSONS, loadLesson, type Lesson } from './course.ts';
import { libraries, usePlatform } from './preview/native-entry.ts';
import { tailwindCss } from './preview/tailwind.ts';
import { runChecks, runTestFile, type RunnerOptions } from './preview/test-runner.ts';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs') as {
  compileCss: (
    css: string,
    context: string,
    options?: { onUnsupported?: (message: string) => void },
  ) => object;
};
const { flattenTailwind } = require('@solid-native/tailwind/flatten.cjs') as {
  flattenTailwind: (css: string) => string;
};

const quiet = { onUnsupported: () => {} };
const stylesheets = (files: Readonly<Record<string, string>>) =>
  Object.entries(files).filter(([file]) => file.endsWith('.native.css'));

function options(files: Readonly<Record<string, string>>): RunnerOptions {
  return {
    files,
    libraries: libraries(),
    // As the preview does it: only for a check that says it reads styles, so one that forgets to
    // say so fails here too.
    nativeStyles: async () => {
      const tailwind = await tailwindCss(files);
      const globalStyles = tailwind.used
        ? compileCss(flattenTailwind(tailwind.css), 'Tailwind', quiet)
        : undefined;
      return {
        libraries: libraries({ globalStyles: globalStyles as never }),
        sheets: Object.fromEntries(
          stylesheets(files).map(([file, css]) => [file, compileCss(css, file, quiet)]),
        ),
      };
    },
  };
}

const failures = (outcomes: readonly { name: string; ok: boolean; error?: string }[]) =>
  outcomes.filter((outcome) => !outcome.ok).map(({ name, error }) => `${name}: ${error}`);

const written = LESSONS.filter((lesson) => !lesson.planned);

export function describeLessons(platform: 'ios' | 'android'): void {
  usePlatform(platform);

  describe.each(written)(`lesson $number, $title, on ${platform}`, ({ slug }) => {
    let lesson: Lesson;
    let solution: Lesson['starter'];

    it('loads, with a step for every check and a snapshot for every step', async () => {
      lesson = (await loadLesson(slug))!;
      expect(lesson).toBeDefined();
      expect(lesson.steps.length).toBeGreaterThan(0);
      expect(lesson.snapshots).toHaveLength(lesson.steps.length);
      solution = lesson.snapshots.at(-1)!;
      expect(lesson.entry).toBe('app.tsx');
      for (const files of [lesson.starter, ...lesson.snapshots])
        expect(files['app.tsx']).toBeDefined();
      const outcomes = await runChecks(options(solution), lesson.checks, 99);
      const steps = new Set(outcomes.map((outcome) => outcome.step));
      expect([...steps].sort()).toEqual(lesson.steps.map((_, index) => index + 1));
    });

    it('passes every check against its solution', async () => {
      const outcomes = await runChecks(options(solution), lesson.checks, lesson.steps.length);
      expect(failures(outcomes)).toEqual([]);
    });

    it("passes each step's checks, and those before it, against the step's snapshot", async () => {
      for (const [index, snapshot] of lesson.snapshots.entries()) {
        const outcomes = await runChecks(options(snapshot), lesson.checks, index + 1);
        expect({ step: index + 1, failures: failures(outcomes) }).toEqual({
          step: index + 1,
          failures: [],
        });
      }
    });

    it("does not pass the next step against a step's snapshot", async () => {
      for (const [index, snapshot] of lesson.snapshots.slice(0, -1).entries()) {
        const next = index + 2;
        const outcomes = await runChecks(options(snapshot), lesson.checks, next);
        const nextOutcomes = outcomes.filter((outcome) => outcome.step === next);
        expect(nextOutcomes.length).toBeGreaterThan(0);
        expect({
          step: index + 1,
          solvesNext: nextOutcomes.every((outcome) => outcome.ok),
        }).toEqual({ step: index + 1, solvesNext: false });
      }
    });

    it('does not pass its first step against its starter', async () => {
      const outcomes = await runChecks(options(lesson.starter), lesson.checks, 1);
      expect(outcomes.some((outcome) => !outcome.ok)).toBe(true);
    });

    it('starts with CSS a device build has nothing to say about', async () => {
      // The preview holds its native CSS notes back until a stylesheet or a class changes, so a
      // note the starter itself earned would never be shown.
      const said: string[] = [];
      const report = { onUnsupported: (message: string) => said.push(message) };
      for (const [file, css] of stylesheets(lesson.starter)) compileCss(css, file, report);
      const tailwind = await tailwindCss(lesson.starter);
      if (tailwind.used) {
        compileCss(flattenTailwind(tailwind.css), 'Tailwind', {
          onUnsupported: (message) => {
            if (!message.includes("dropped '--")) said.push(message);
          },
        });
      }
      expect(said).toEqual([]);
    });

    it("passes each snapshot's own tests", async () => {
      for (const snapshot of lesson.snapshots) {
        for (const file of Object.keys(snapshot).filter((name) => name.endsWith('.spec.ts'))) {
          expect(failures(await runTestFile(options(snapshot), file))).toEqual([]);
        }
      }
    });
  });
}
