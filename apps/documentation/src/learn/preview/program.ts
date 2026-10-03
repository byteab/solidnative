/**
 * A learner's files, compiled and linked in the page.
 *
 * Each `.ts` or `.tsx` file goes through `compiler.ts` (Solid's universal JSX transform and
 * TypeScript, as Metro runs them, then CommonJS), and runs in a `Function` whose `require`
 * answers with the modules the page already has - `solid-js`, `@solidnative/platform/solid`,
 * `@solidnative/components/solid` and the rest, whichever renderer the caller chose - and with the
 * learner's other files, compiled the same way the first time something imports them. A
 * `.native.css` import is answered with the stylesheet `css` makes of the file.
 */
import { compileFile, GUARD, SyntaxProblem } from './compiler.ts';
import { createGuard } from './learn-runtime.ts';

export type ProblemKind = 'syntax' | 'import' | 'runtime' | 'css' | 'device' | 'console';

export interface Problem {
  readonly kind: ProblemKind;
  readonly message: string;
  readonly file?: string;
  /** 1-based. */
  readonly line?: number;
  /** 0-based. */
  readonly column?: number;
}

export class ProblemError extends Error {
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.message);
    this.problem = problem;
  }
}

export interface CompiledFile {
  readonly file: string;
  readonly exports: Record<string, unknown>;
}

type Module = Record<string, unknown>;

export interface ProgramOptions {
  /** The learner's files, by name: `app.tsx`, `habit-row.tsx`, `app.native.css`. */
  readonly files: Readonly<Record<string, string>>;
  /** Packages a file may import, by specifier. */
  readonly libraries: Readonly<Record<string, unknown>>;
  /** Files answered with a module object instead of being compiled, by name. */
  readonly overrides?: Readonly<Record<string, Module>>;
  /**
   * What a `.native.css` import is: the stylesheet the renderer's `withNativeStyles` takes, made
   * from the file. Without it, or when it answers `undefined`, the import is `null`, which
   * `withNativeStyles` takes as no styles at all.
   */
  readonly css?: (file: string, source: string) => unknown;
  /**
   * A file whose imports of files the learner has not written get an empty module rather than an
   * error. A lesson's checks import every file of its solution, and a check about a file that is
   * not there yet should fail on its own, not take the checks about the other files with it.
   */
  readonly missingIsEmptyIn?: string;
  readonly loopBudgetMs?: number;
}

export interface Program {
  /** A file's exports, compiling it and whatever it imports on first use. */
  load(file: string): Module;
  /** Every file compiled so far. */
  readonly compiled: ReadonlyMap<string, CompiledFile>;
}

const SOURCE_URL = 'learn:///';

/**
 * The file a relative import names: `./habit-row`, `./habit-row.tsx` and
 * `../solution/habit-row.tsx` all name `habit-row.tsx` when there is one, as a bundler resolves
 * an import without its extension.
 */
export function fileFor(specifier: string, exists: (file: string) => boolean): string {
  const base = specifier.split('/').pop() ?? specifier;
  return [base, `${base}.tsx`, `${base}.ts`].find(exists) ?? base;
}

const isStylesheet = (file: string) => file.endsWith('.css');

export function createProgram(options: ProgramOptions): Program {
  const compiled = new Map<string, CompiledFile>();
  const loading = new Map<string, Module>();
  const exists = (file: string) => file in options.files || !!options.overrides?.[file];

  const load = (file: string): Module => {
    const override = options.overrides?.[file];
    if (override) return override;
    // A file still being evaluated answers with what it has exported so far, as CommonJS does
    // for a cycle.
    const done = compiled.get(file)?.exports ?? loading.get(file);
    if (done) return done;
    const source = options.files[file];
    if (source === undefined)
      throw new ProblemError({ kind: 'import', message: `There is no file called ${file}.` });
    const exports: Module = {};
    loading.set(file, exports);
    try {
      compiled.set(file, evaluate(file, source, exports));
    } finally {
      loading.delete(file);
    }
    return exports;
  };

  const stylesheet = (file: string): Module => ({
    __esModule: true,
    default: options.css?.(file, options.files[file]!) ?? null,
  });

  const requireFrom =
    (from: string) =>
    (specifier: string): unknown => {
      if (specifier in options.libraries) return options.libraries[specifier];
      if (specifier.startsWith('.')) {
        const file = fileFor(specifier, exists);
        if (exists(file)) return isStylesheet(file) ? stylesheet(file) : load(file);
        if (from === options.missingIsEmptyIn) return {};
        throw new ProblemError({
          kind: 'import',
          file: from,
          message: `Cannot find "${specifier}". The files here are ${Object.keys(options.files).join(', ')}.`,
        });
      }
      throw new ProblemError({
        kind: 'import',
        file: from,
        message: `"${specifier}" is not available here. You can import from ${Object.keys(options.libraries).join(', ')}.`,
      });
    };

  const evaluate = (file: string, source: string, exports: Module): CompiledFile => {
    const code = compile(file, source);
    const module = { exports };
    try {
      new Function(
        'require',
        'module',
        'exports',
        GUARD,
        `${code}\n//# sourceURL=${SOURCE_URL}${file}`,
      )(requireFrom(file), module, exports, createGuard(options.loopBudgetMs));
    } catch (error) {
      throw error instanceof ProblemError ? error : new ProblemError(runtimeProblem(error, file));
    }
    return { file, exports: module.exports };
  };

  return { load, compiled };
}

function compile(file: string, source: string): string {
  try {
    return compileFile(file, source);
  } catch (error) {
    if (!(error instanceof SyntaxProblem)) throw error;
    throw new ProblemError({
      kind: 'syntax',
      file,
      message: error.message,
      line: error.line,
      column: error.column,
    });
  }
}

/**
 * How many lines `new Function` puts in front of the body, measured rather than assumed: Chrome
 * and Firefox wrap it in `function anonymous(...) {` on lines of their own, and a line in a stack
 * trace has to have that taken off to be a line in the editor.
 */
let wrapperLines: number | undefined;

function measureWrapper(): number {
  try {
    new Function(`throw new Error('probe');\n//# sourceURL=${SOURCE_URL}probe`)();
  } catch (error) {
    const line = new RegExp(`${SOURCE_URL}probe:(\\d+)`).exec(String((error as Error).stack));
    return line ? Number(line[1]) - 1 : 0;
  }
  return 0;
}

/** The first place in the learner's own files an error's stack passes through. */
export function locate(error: unknown): { file: string; line: number; column: number } | undefined {
  const stack = String((error as Error | undefined)?.stack ?? '');
  const at = /learn:\/\/\/([\w.-]+\.tsx?):(\d+):(\d+)/.exec(stack);
  if (!at) return undefined;
  wrapperLines ??= measureWrapper();
  return { file: at[1]!, line: Number(at[2]) - wrapperLines, column: Number(at[3]) - 1 };
}

export function runtimeProblem(error: unknown, file?: string): Problem {
  const where = locate(error);
  const message = error instanceof Error ? error.message : String(error);
  return {
    kind: 'runtime',
    message,
    file: where?.file ?? file,
    line: where?.line,
    column: where?.column,
  };
}
