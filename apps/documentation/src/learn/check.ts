/**
 * What a lesson's `checks.ts` imports: `check()`, which says what a step asks for as a test the
 * preview runs against the learner's code.
 *
 *     check(2, 'The list shows every habit', () => {
 *       render(App);
 *       expect(screen.getAllByRole('button')).toHaveLength(3);
 *     }, 'Put a <For> around the habit row.');
 *
 * A check file imports the learner's `app.tsx` as `./solution/app.tsx`. The preview answers that
 * import with the learner's own file, and the type checker answers it with the lesson's solution,
 * so a check that does not type-check against the solution fails the site's build rather than a
 * learner.
 *
 * The same module is the registry the preview's runner reads, so there is one definition of what
 * a check is.
 */
import type { FakeFabricNode } from '@solid-native/testing';

export interface TestOutcome {
  readonly name: string;
  readonly ok: boolean;
  readonly error?: string;
  /** Where in its file the failure was, when the stack reaches the learner's code. */
  readonly file?: string;
  readonly line?: number;
  readonly ms: number;
}

export interface CheckContext {
  /** A file's source as the learner has it, or an empty string if there is no such file. */
  file(name: string): string;
  /**
   * Run one of the learner's test files and resolve with each test's outcome. `replace` answers
   * an import of one of their files with a module of the check's own, so a check can hand their
   * tests a broken component and see whether they notice.
   */
  runTests(
    file: string,
    options?: { readonly replace?: Readonly<Record<string, Record<string, unknown>>> },
  ): Promise<readonly TestOutcome[]>;
}

export interface Check {
  /** The lesson step it belongs to, counting from 1. */
  readonly step: number;
  readonly name: string;
  /** What to try when it fails, in place of the assertion's own message. */
  readonly hint?: string;
  /** See `CheckOptions`. */
  readonly readsStyles: boolean;
  readonly run: (context: CheckContext) => unknown;
}

export interface CheckOptions {
  /**
   * The check reads a style the native CSS compiler resolves, such as a view's `backgroundColor`.
   * Only these checks render with the app's compiled styles, and the first one to run is what
   * downloads the compiler, which is too big to fetch for a check that only reads text. A check
   * that reads a style without saying so finds none, in the preview and in `lessons.test.ts` alike.
   */
  readonly readsStyles?: boolean;
}

/**
 * The node `node` is a child of, in a committed tree: the row a text sits in, for a check about
 * the row's layout. Testing Library queries find the text; its container is what has the style.
 */
export function parentOf(
  roots: readonly FakeFabricNode[],
  node: FakeFabricNode,
): FakeFabricNode | undefined {
  for (const root of roots) {
    if (root.children.some((child) => child.reactTag === node.reactTag)) return root;
    const found = parentOf(root.children, node);
    if (found) return found;
  }
  return undefined;
}

const registered: Check[] = [];

export function check(
  step: number,
  name: string,
  run: (context: CheckContext) => unknown,
  hint?: string,
  options: CheckOptions = {},
): void {
  registered.push({ step, name, run, hint, readsStyles: options.readsStyles ?? false });
}

/** The checks registered since the last call. */
export function takeChecks(): Check[] {
  return registered.splice(0);
}
