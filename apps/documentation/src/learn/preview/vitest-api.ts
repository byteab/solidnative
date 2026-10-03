/**
 * `import { describe, expect, it, vi } from 'vitest'`, as a learner's test file sees it in the
 * preview: the registration half of Vitest's API, and `expect.ts` for the assertions.
 */
import { expect, fn } from './expect.ts';

type Hook = () => unknown;

export interface RegisteredTest {
  readonly name: string;
  readonly run: () => unknown;
  readonly before: readonly Hook[];
  readonly after: readonly Hook[];
}

interface Scope {
  readonly name: string;
  readonly before: Hook[];
  readonly after: Hook[];
}

let collected: RegisteredTest[] | undefined;
let scopes: Scope[] = [];

function current(): RegisteredTest[] {
  if (!collected) throw new Error('Tests can only be declared at the top of a test file.');
  return collected;
}

function it(name: string, run: () => unknown): void {
  current().push({
    name: [...scopes.map((scope) => scope.name).filter(Boolean), name].join(' > '),
    run,
    before: scopes.flatMap((scope) => scope.before),
    after: scopes.flatMap((scope) => scope.after).reverse(),
  });
}

function describe(name: string, body: () => void): void {
  scopes.push({ name, before: [], after: [] });
  try {
    body();
  } finally {
    scopes.pop();
  }
}

const top = (): Scope => scopes.at(-1)!;

export const vitest = {
  describe,
  it,
  test: it,
  expect,
  beforeEach: (hook: Hook) => top().before.push(hook),
  afterEach: (hook: Hook) => top().after.push(hook),
  vi: { fn },
};

/** Run `load`, which evaluates a test file, and resolve with the tests it declared. */
export async function collectTests(load: () => Promise<void>): Promise<RegisteredTest[]> {
  collected = [];
  scopes = [{ name: '', before: [], after: [] }];
  try {
    await load();
    return collected;
  } finally {
    collected = undefined;
  }
}
