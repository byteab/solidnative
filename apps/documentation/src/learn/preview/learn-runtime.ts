/**
 * The loop watchdog: `compiler.ts` puts a call to it at the top of every loop in the learner's
 * code, so a loop that never ends is stopped with a message instead of freezing the preview.
 */

/** Thrown by the guard when one task has spent too long going round loops. */
export class RunawayLoop extends Error {
  constructor(seconds: number) {
    super(
      `A loop ran for more than ${seconds} seconds without finishing, so it was stopped. ` +
        'Check that its condition becomes false.',
    );
    this.name = 'RunawayLoop';
  }
}

/** A guard for one file: true every time, until a task has looped for longer than `budgetMs`. */
export function createGuard(budgetMs = 2000): () => boolean {
  let started: number | undefined;
  let passes = 0;
  return () => {
    if (started === undefined) {
      // The first pass in a task starts the clock, and the next task stops it. A loop that never
      // lets the task end never lets the clock stop.
      started = performance.now();
      setTimeout(() => (started = undefined));
      return true;
    }
    if (++passes % 1000 === 0 && performance.now() - started > budgetMs) {
      started = undefined;
      throw new RunawayLoop(budgetMs / 1000);
    }
    return true;
  };
}
