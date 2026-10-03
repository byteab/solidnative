/**
 * Which palette the page is wearing.
 *
 * This owns the `dark` class on the document root, which is what every palette on the page is
 * selected by - the site's own chrome tokens in `styles.css`, and the same tokens a live example
 * reads through Tailwind's `dark:` variant. Setting the class here therefore themes the examples
 * too, without any of them being told.
 *
 * The preference is stored, because a reader who chose dark meant it for more than this page.
 * `index.html` reads the same key before first paint so the choice survives a reload without a
 * white flash.
 */
import { createSignal } from 'solid-js';

// `index.html` moves a choice stored under the site's previous key to this one before first paint.
const KEY = 'solidnative-docs-theme';

export type Scheme = 'light' | 'dark';

/**
 * The class `index.html` already put on the root, read back rather than recomputed.
 *
 * Recomputing it from `localStorage` and `prefers-color-scheme` would duplicate that script's
 * logic in a second place, and the two would eventually disagree about what happens when storage
 * throws. The class is the answer; this reads the answer.
 */
function read(): Scheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

const [current, setCurrent] = createSignal<Scheme>(read());

/** The palette showing now. Reactive. */
export const scheme = current;

export function toggleScheme(): void {
  const next: Scheme = current() === 'dark' ? 'light' : 'dark';
  setCurrent(next);
  document.documentElement.classList.toggle('dark', next === 'dark');
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private browsing refuses to store anything. The class is already set, so the choice holds
    // for this page; it just will not survive a reload, which is the most that can be offered.
  }
}
