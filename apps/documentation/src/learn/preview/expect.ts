/**
 * Enough of Vitest's `expect` and `vi.fn` for a learner's tests and a lesson's checks, small
 * enough to load into the preview and with messages written for someone new to testing.
 *
 * The matchers are Vitest's names with Vitest's meaning, so a test written here runs unchanged in
 * an app with Vitest installed. Anything outside this set is a clear error rather than a silent
 * pass: `expect(x).toBeSorted()` fails with "toBeSorted is not available here".
 */

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

/** A value as a message shows it: strings quoted, nodes by their text, the rest as JSON. */
export function describeValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'function') return value.name ? `function ${value.name}` : 'a function';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number' || typeof value === 'boolean' || value === null)
    return String(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    const json = JSON.stringify(value, (_key, inner: unknown) =>
      typeof inner === 'object' && inner !== null && 'parent' in inner ? '[node]' : inner,
    );
    return json.length > 120 ? `${json.slice(0, 117)}...` : json;
  } catch {
    return String(value);
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  const keysA = Object.keys(a).filter((key) => (a as Record<string, unknown>)[key] !== undefined);
  const keysB = Object.keys(b).filter((key) => (b as Record<string, unknown>)[key] !== undefined);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

export interface Mock {
  (...args: unknown[]): unknown;
  readonly mock: { readonly calls: unknown[][] };
  mockReturnValue(value: unknown): Mock;
  mockImplementation(implementation: (...args: unknown[]) => unknown): Mock;
}

const MOCK = Symbol('mock');

export function fn(implementation?: (...args: unknown[]) => unknown): Mock {
  let impl = implementation;
  const calls: unknown[][] = [];
  const mock = ((...args: unknown[]) => {
    calls.push(args);
    return impl?.(...args);
  }) as Mock & { [MOCK]: true };
  Object.assign(mock, {
    [MOCK]: true,
    mock: { calls },
    mockReturnValue(value: unknown) {
      impl = () => value;
      return mock;
    },
    mockImplementation(next: (...args: unknown[]) => unknown) {
      impl = next;
      return mock;
    },
  });
  return mock;
}

function callsOf(value: unknown): unknown[][] {
  if (typeof value === 'function' && MOCK in value) return (value as unknown as Mock).mock.calls;
  throw new AssertionError(`Expected a function made with vi.fn(), got ${describeValue(value)}`);
}

type Check = (actual: unknown, ...expected: unknown[]) => { pass: boolean; message: string };

const length = (value: unknown): number | undefined =>
  (value as { length?: unknown } | null)?.length as number | undefined;

function threw(actual: unknown): { threw: boolean; error?: unknown } {
  if (typeof actual !== 'function') {
    throw new AssertionError('toThrow needs a function: expect(() => ...).toThrow()');
  }
  try {
    actual();
    return { threw: false };
  } catch (error) {
    return { threw: true, error };
  }
}

function matchesThrown(error: unknown, expected: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (expected === undefined) return true;
  if (typeof expected === 'string') return message.includes(expected);
  if (expected instanceof RegExp) return expected.test(message);
  return typeof expected === 'function' && error instanceof expected;
}

const compare =
  (label: string, test: (a: number, b: number) => boolean): Check =>
  (actual, expected) => ({
    pass: test(actual as number, expected as number),
    message: `Expected ${describeValue(actual)} to be ${label} ${describeValue(expected)}`,
  });

const MATCHERS: Record<string, Check> = {
  toBe: (actual, expected) => ({
    pass: Object.is(actual, expected),
    message: `Expected ${describeValue(actual)} to be ${describeValue(expected)}`,
  }),
  toEqual: (actual, expected) => ({
    pass: deepEqual(actual, expected),
    message: `Expected ${describeValue(actual)} to equal ${describeValue(expected)}`,
  }),
  toBeTruthy: (actual) => ({
    pass: !!actual,
    message: `Expected ${describeValue(actual)} to be truthy`,
  }),
  toBeFalsy: (actual) => ({
    pass: !actual,
    message: `Expected ${describeValue(actual)} to be falsy`,
  }),
  toBeNull: (actual) => ({
    pass: actual === null,
    message: `Expected ${describeValue(actual)} to be null`,
  }),
  toBeUndefined: (actual) => ({
    pass: actual === undefined,
    message: `Expected ${describeValue(actual)} to be undefined`,
  }),
  toBeDefined: (actual) => ({
    pass: actual !== undefined,
    message: 'Expected a value, got undefined',
  }),
  toContain: (actual, expected) => ({
    pass:
      typeof actual === 'string' || Array.isArray(actual)
        ? actual.includes(expected as never)
        : false,
    message: `Expected ${describeValue(actual)} to contain ${describeValue(expected)}`,
  }),
  toHaveLength: (actual, expected) => ({
    pass: length(actual) === expected,
    message: `Expected a length of ${describeValue(expected)}, got ${describeValue(length(actual))}`,
  }),
  toMatch: (actual, expected) => ({
    pass:
      typeof actual === 'string' &&
      (expected instanceof RegExp ? expected.test(actual) : actual.includes(expected as string)),
    message: `Expected ${describeValue(actual)} to match ${String(expected)}`,
  }),
  toBeGreaterThan: compare('greater than', (a, b) => a > b),
  toBeGreaterThanOrEqual: compare('at least', (a, b) => a >= b),
  toBeLessThan: compare('less than', (a, b) => a < b),
  toBeLessThanOrEqual: compare('at most', (a, b) => a <= b),
  toBeInstanceOf: (actual, expected) => ({
    pass: actual instanceof (expected as new () => unknown),
    message: `Expected ${describeValue(actual)} to be an instance of ${(expected as { name?: string }).name}`,
  }),
  toHaveProperty: (actual, key, value) => {
    const has = actual !== null && actual !== undefined && (key as string) in Object(actual);
    const inner = has ? (actual as Record<string, unknown>)[key as string] : undefined;
    return {
      pass: has && (value === undefined || deepEqual(inner, value)),
      message: `Expected ${describeValue(actual)} to have property ${describeValue(key)}`,
    };
  },
  toThrow: (actual, expected) => {
    const result = threw(actual);
    return {
      pass: result.threw && matchesThrown(result.error, expected),
      message: result.threw
        ? `Expected an error matching ${describeValue(expected)}, got ${describeValue(result.error)}`
        : 'Expected the function to throw, and it did not',
    };
  },
  toHaveBeenCalled: (actual) => ({
    pass: callsOf(actual).length > 0,
    message: 'Expected the function to have been called',
  }),
  toHaveBeenCalledTimes: (actual, times) => ({
    pass: callsOf(actual).length === times,
    message: `Expected ${String(times)} calls, got ${callsOf(actual).length}`,
  }),
  toHaveBeenCalledWith: (actual, ...args) => ({
    pass: callsOf(actual).some((call) => deepEqual(call, args)),
    message: `Expected a call with ${describeValue(args)}, got ${describeValue(callsOf(actual))}`,
  }),
};

MATCHERS['toStrictEqual'] = MATCHERS['toEqual']!;

type Matchers = Record<string, (...expected: unknown[]) => unknown>;

function matchers(actual: unknown, negate: boolean): Matchers {
  return new Proxy({} as Matchers, {
    get(_target, name: string) {
      if (name === 'then') return undefined;
      const matcher = MATCHERS[name];
      if (!matcher) throw new AssertionError(`${name} is not available here.`);
      return (...expected: unknown[]) => {
        const { pass, message } = matcher(actual, ...expected);
        if (pass === negate) {
          throw new AssertionError(negate ? message.replace(/^Expected/, 'Expected not') : message);
        }
      };
    },
  });
}

export type Expectation = Matchers & {
  readonly not: Matchers;
  readonly resolves: Matchers;
  readonly rejects: Matchers;
};

/** `resolves` and `rejects`: the same matchers, run on what the promise settles to. */
function settled(actual: unknown, rejects: boolean): Matchers {
  const later = (run: (value: unknown) => void) =>
    Promise.resolve(actual).then(
      (value) => {
        if (rejects) throw new AssertionError(`Expected a rejection, got ${describeValue(value)}`);
        run(value);
      },
      (error: unknown) => {
        if (!rejects) throw error;
        run(error);
      },
    );
  return new Proxy({} as Matchers, {
    get:
      (_target, name: string) =>
      (...expected: unknown[]) =>
        later((value) => matchers(value, false)[name]!(...expected)),
  });
}

export function expect(actual: unknown): Expectation {
  const direct = matchers(actual, false);
  const modifiers: Record<string, () => Matchers> = {
    not: () => matchers(actual, true),
    resolves: () => settled(actual, false),
    rejects: () => settled(actual, true),
  };
  return new Proxy({} as Expectation, {
    get: (_target, name: string) => modifiers[name]?.() ?? direct[name],
  });
}
