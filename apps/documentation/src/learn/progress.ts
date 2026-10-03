/**
 * Where a learner is in each lesson: their files, the step they are on and the steps they have
 * finished, kept in `localStorage` so closing the tab loses nothing.
 */
import { createSignal } from 'solid-js';
import { findEntry } from './file-name.ts';
import type { Files } from './protocol.ts';

export interface LessonProgress {
  readonly files: Files;
  /** Counting from 0. */
  readonly step: number;
  /** Every step whose checks have all passed, counting from 0. */
  readonly done: readonly number[];
}

/** Versioned, so a change to the lessons can leave old progress behind. */
const KEY = 'solid-native-learn:v2:';

const isStep = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

/** Files that are all text, and include the entry file every lesson starts from. */
function isFiles(value: unknown): value is Files {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const files = value as Record<string, unknown>;
  return (
    Object.values(files).every((contents) => typeof contents === 'string') &&
    findEntry(files as Files) !== undefined
  );
}

/**
 * Stored progress, if it is in a shape a lesson can open: files that are all text and include the
 * entry file every lesson starts from, and steps as counts from 0. Anything else - progress an earlier
 * version of the site saved, or storage something else wrote to - starts the lesson afresh rather
 * than leaving a page that cannot render.
 */
export function parseProgress(stored: string | null): LessonProgress | undefined {
  if (!stored) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const { files, step, done } = value as Record<string, unknown>;
  if (!isFiles(files)) return undefined;
  if (!isStep(step) || !Array.isArray(done) || !done.every(isStep)) return undefined;
  return { files, step, done };
}

function read(slug: string): LessonProgress | undefined {
  try {
    return parseProgress(localStorage.getItem(KEY + slug));
  } catch {
    // Storage refused: start the lesson afresh.
    return undefined;
  }
}

/** Bumped on every save, so a list of lessons can show what changed. */
const [version, setVersion] = createSignal(0);

export function getProgress(slug: string): LessonProgress | undefined {
  version();
  return read(slug);
}

export function saveProgress(slug: string, progress: LessonProgress): void {
  try {
    localStorage.setItem(KEY + slug, JSON.stringify(progress));
  } catch {
    // Private browsing, or a full quota. The lesson still works; it just will not be remembered.
  }
  setVersion((n) => n + 1);
}
