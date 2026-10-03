import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { libraries as nativeLibraries } from './native-entry.ts';
import { runChecks, runTestFile } from './test-runner.ts';

const libraries = nativeLibraries();
const { compileCss } = createRequire(import.meta.url)('@solid-native/metro/css/compile.cjs') as {
  compileCss: (css: string, context: string) => object;
};

const APP = `import { createSignal } from 'solid-js';
import { Pressable, Text } from '@solid-native/components/solid';

export function App() {
  const [count, setCount] = createSignal(0);
  return (
    <Pressable accessibilityRole="button" onPress={() => setCount(count() + 1)}>
      <Text>{count()} presses</Text>
    </Pressable>
  );
}
`;

const SPEC = `import { render, screen, userEvent } from '@solid-native/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

describe('App', () => {
  let calls = 0;
  beforeEach(() => { calls++; });

  it('starts at zero', async () => {
    render(App);
    expect(screen.getByText('0 presses')).toBeTruthy();
  });

  it('counts a press', async () => {
    render(App);
    await userEvent.press(screen.getByRole('button'));
    expect(screen.getByText('1 presses')).toBeTruthy();
    expect(calls).toBe(2);
  });

  it('fails where it is wrong', async () => {
    render(App);
    expect(screen.queryByText('9 presses')).not.toBeNull();
  });
});
`;

const CHECKS = `import { render, screen } from '@solid-native/testing';
import { expect } from 'vitest';
import { check } from '../../check.ts';
import { App } from './solution/app.tsx';

check(1, 'Shows the count', async () => {
  render(App);
  expect(screen.getByText('0 presses')).toBeTruthy();
});

check(1, 'Uses a signal', ({ file }) => {
  expect(file('app.tsx')).toContain('createSignal(');
});

check(2, 'Says hello', async () => {
  render(App);
  expect(screen.getByText('Hello')).toBeTruthy();
}, 'Add a text that says Hello.');

check(3, 'Not yet', () => {});
`;

describe('runTestFile', () => {
  it('runs each test in a learner test file and reports where one failed', async () => {
    const outcomes = await runTestFile(
      { files: { 'app.tsx': APP, 'app.spec.ts': SPEC }, libraries },
      'app.spec.ts',
    );
    expect(outcomes.map(({ name, ok }) => ({ name, ok }))).toEqual([
      { name: 'App > starts at zero', ok: true },
      { name: 'App > counts a press', ok: true },
      { name: 'App > fails where it is wrong', ok: false },
    ]);
    expect(outcomes[2]).toMatchObject({
      error: 'Expected not null to be null',
      file: 'app.spec.ts',
      line: 23,
    });
  });

  it('says so when a test file has nothing in it', async () => {
    const outcomes = await runTestFile({ files: { 'app.spec.ts': '' }, libraries }, 'app.spec.ts');
    expect(outcomes).toMatchObject([{ ok: false, error: 'app.spec.ts has no tests in it yet.' }]);
  });
});

describe('runChecks', () => {
  it('runs the checks up to the step, with the hint on a failure', async () => {
    const outcomes = await runChecks({ files: { 'app.tsx': APP }, libraries }, CHECKS, 2);
    expect(outcomes.map(({ name, ok, step, hint }) => ({ name, ok, step, hint }))).toEqual([
      { name: 'Shows the count', ok: true, step: 1, hint: undefined },
      { name: 'Uses a signal', ok: true, step: 1, hint: undefined },
      { name: 'Says hello', ok: false, step: 2, hint: 'Add a text that says Hello.' },
    ]);
  });

  it('fails every check with the problem when the learner code does not compile', async () => {
    const outcomes = await runChecks(
      { files: { 'app.tsx': APP.replace('createSignal(0);', 'createSignal(0;') }, libraries },
      CHECKS,
      1,
    );
    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((outcome) => !outcome.ok)).toBe(true);
    expect(outcomes[0]!.error).toMatch(/^Fix this first: app\.tsx:5: /);
  });

  it('asks for native styles only for a check that reads them, and only runs that one with them', async () => {
    const checks = `import { render, screen } from '@solid-native/testing';
import { expect } from 'vitest';
import { check } from '../../check.ts';
import { App } from './solution/app.tsx';

check(1, 'Reads text', async () => {
  render(App);
  expect(screen.getByText('0 presses').props['color']).toBeUndefined();
});

check(1, 'Reads a style', async () => {
  render(App);
  expect(screen.getByText('0 presses').props['color']).toBe('rgb(255, 0, 0)');
}, undefined, { readsStyles: true });
`;
    let asked = 0;
    const sheet = compileCss('text { color: red; }', 'test');
    const nativeStyles = async () => {
      asked++;
      return { libraries: nativeLibraries({ globalStyles: sheet as never }), sheets: {} };
    };
    const files = { 'app.tsx': APP };
    expect(await runChecks({ files, libraries, nativeStyles }, checks, 1)).toMatchObject([
      { name: 'Reads text', ok: true },
      { name: 'Reads a style', ok: true },
    ]);
    expect(asked).toBe(1);

    asked = 0;
    await runChecks({ files, libraries, nativeStyles }, CHECKS, 3);
    expect(asked).toBe(0);
  });

  it("gives a check that reads styles each .native.css file's compiled sheet", async () => {
    const app = `import { Text } from '@solid-native/components/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './app.native.css';

export function App() {
  return withNativeStyles(sheet, () => <Text class="title">Today</Text>);
}
`;
    const checks = `import { render, screen } from '@solid-native/testing';
import { expect } from 'vitest';
import { check } from '../../check.ts';
import { App } from './solution/app.tsx';

check(1, 'The title is large', async () => {
  render(App);
  expect(screen.getByText('Today').props['fontSize']).toBe(30);
}, undefined, { readsStyles: true });
`;
    const css = '.title { font-size: 30px; }';
    const files = { 'app.tsx': app, 'app.native.css': css };
    const nativeStyles = async () => ({
      libraries,
      sheets: { 'app.native.css': compileCss(css, 'app.native.css') },
    });
    expect(await runChecks({ files, libraries, nativeStyles }, checks, 1)).toMatchObject([
      { ok: true },
    ]);
    expect(await runChecks({ files, libraries }, checks, 1)).toMatchObject([{ ok: false }]);
  });

  it('fails only the checks about a file the learner has not written', async () => {
    const checks = `import { render, screen } from '@solid-native/testing';
import { expect } from 'vitest';
import { check } from '../../check.ts';
import { App } from './solution/app.tsx';
import { Later } from './solution/later.tsx';

check(1, 'Shows the count', async () => {
  render(App);
  expect(screen.getByText('0 presses')).toBeTruthy();
});

check(1, 'Has Later', () => {
  expect(Later).toBeDefined();
});
`;
    const outcomes = await runChecks({ files: { 'app.tsx': APP }, libraries }, checks, 1);
    expect(outcomes.map(({ name, ok }) => ({ name, ok }))).toEqual([
      { name: 'Shows the count', ok: true },
      { name: 'Has Later', ok: false },
    ]);
  });

  it('can run the learner tests against a component of its own', async () => {
    const checks = `import { Text } from '@solid-native/components/solid';
import { expect } from 'vitest';
import { check } from '../../check.ts';

const Broken = () => <Text>5 presses</Text>;

check(1, 'The tests notice a broken count', async ({ runTests }) => {
  const outcomes = await runTests('app.spec.ts', { replace: { 'app.tsx': { App: Broken } } });
  expect(outcomes.some((outcome) => !outcome.ok)).toBe(true);
});
`;
    const outcomes = await runChecks(
      { files: { 'app.tsx': APP, 'app.spec.ts': SPEC }, libraries },
      checks,
      1,
    );
    expect(outcomes).toMatchObject([{ ok: true }]);
  });
});
