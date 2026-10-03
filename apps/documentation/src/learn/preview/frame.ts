/**
 * The preview frame, `learn-preview.html`: where the learner's code is compiled, mounted, styled
 * and tested. It is a frame of its own so that Tailwind's browser build, the platform and dark
 * classes and the learner's code cannot reach the lesson page around it.
 *
 * Two renderers live here. The phone mounts the app with the browser host, `@solidnative/web/solid`,
 * which is what `@solidnative/platform/solid` resolves to in this build. The checks, the learner's
 * tests and the engine's development notes render it with the native renderer over a fake Fabric,
 * from `native-entry.ts`, loaded through `?learn-native` the first time one is needed. Each
 * compiles the learner's files against its own packages.
 *
 * It answers the messages in `protocol.ts` one at a time, in the order they arrive.
 */
import * as solid from 'solid-js';
import * as store from 'solid-js/store';
import * as components from '@solidnative/components/solid';
import * as device from '@solidnative/device/solid';
import { registerPlatformComponents } from '@solidnative/fabric';
import * as browserHost from '@solidnative/platform/solid';
import type { BrowserComponent } from '@solidnative/web/solid';
import type { FromPreview, Platform, ToPreview } from '../protocol.ts';
import { browserSheet, type BrowserSheet } from './browser-css.ts';
import { compileNativeCss, compileNativeTailwind } from './native-css.ts';
import { Phone } from './phone.ts';
import { createProgram, ProblemError, runtimeProblem, type Problem } from './program.ts';
import { applyTailwind, tailwindCss, type TailwindOutput } from './tailwind.ts';
import { Xray } from './xray.ts';

type Files = Readonly<Record<string, string>>;
type Native = typeof import('./native-entry.ts');

const platform: Platform =
  new URLSearchParams(location.search).get('platform') === 'android' ? 'android' : 'ios';
registerPlatformComponents(platform);
// The engine's development checks, which a device build in development runs too. See `engineNotes`.
(globalThis as { __DEV__?: boolean }).__DEV__ = true;
const ENGINE = /^\[solid-native\]\s*/;

/**
 * `@solidnative/device` asks `require('react-native')` for each capability, and takes "no
 * `require`" or `null` to mean "not on a device". A production build can leave a `require`
 * behind anyway, the bundler's stand-in that throws when called and defers to a global one if
 * there is one; this is one, and it answers React Native with nothing, the off-device answer. The
 * phone never asks, because `mount` provides the browser's own sources; the fake Fabric does.
 */
(globalThis as { require?: (id: string) => unknown }).require = (id: string) => {
  if (id === 'react-native' || id.startsWith('react-native/') || id === 'expo') return null;
  throw new Error(`"${id}" is not available in the preview.`);
};

/** What the learner's files may import, as the phone's browser host has it. */
const PHONE_LIBRARIES: Readonly<Record<string, unknown>> = {
  'solid-js': solid,
  'solid-js/store': store,
  '@solidnative/platform/solid': browserHost,
  '@solidnative/components/solid': components,
  '@solidnative/device/solid': device,
};

let native: Promise<Native> | undefined;

/** The native renderer's side, downloaded the first time a check, a test or a note needs it. */
function loadNative(): Promise<Native> {
  native ??= (import('./native-entry.ts?learn-native') as unknown as Promise<Native>).then(
    (module) => {
      module.usePlatform(platform);
      return module;
    },
  );
  return native;
}

/**
 * `location.origin` is the site's, not this document's: the sandbox makes the frame's origin
 * opaque but leaves its URL alone, so this reaches the lesson page and nothing else.
 */
function post(message: FromPreview): void {
  parent.postMessage(message, location.origin);
}

let testsRunning = false;
const report = (problem: Problem) => {
  if (!testsRunning) post({ type: 'problem', problem });
};

const phone = new Phone(document.getElementById('screen')!, platform, (error) =>
  report(runtimeProblem(error)),
);
const xray = new Xray(() => phone.root);

function problemOf(error: unknown): Problem {
  return error instanceof ProblemError ? error.problem : runtimeProblem(error);
}

const stylesheetsIn = (files: Files) =>
  Object.entries(files)
    .filter(([file]) => file.endsWith('.css'))
    .sort(([a], [b]) => a.localeCompare(b));

function pickComponent(exports: Record<string, unknown>, entry: string): BrowserComponent<object> {
  const found = [exports['App'], exports['default'], ...Object.values(exports)].find(
    (value) => typeof value === 'function',
  );
  if (!found) {
    throw new ProblemError({
      kind: 'import',
      file: entry,
      message: `${entry} does not export a component. Export the function that returns the screen, as "export function App()".`,
    });
  }
  return found as BrowserComponent<object>;
}

/** Each `.native.css` file, scoped for the phone. */
const browserSheets = (files: Files): Record<string, BrowserSheet> =>
  Object.fromEntries(stylesheetsIn(files).map(([file, css]) => [file, browserSheet(css, file)]));

async function run(id: number, files: Files, entry: string, baseline: Files | undefined) {
  const started = performance.now();
  let component: BrowserComponent<object>;
  let styled: number;
  let compiled: number;
  try {
    const sheets = browserSheets(files);
    styled = performance.now();
    const program = createProgram({
      files,
      libraries: PHONE_LIBRARIES,
      css: (file) => sheets[file],
    });
    component = pickComponent(program.load(entry), entry);
    compiled = performance.now();
  } catch (error) {
    post({ type: 'ran', id, ok: false, problems: [problemOf(error)] });
    return;
  }
  const tailwind = await tailwindCss(files);
  const errors = phone.replace(component);
  if (errors.length) {
    post({ type: 'ran', id, ok: false, problems: errors.map((error) => runtimeProblem(error)) });
    return;
  }
  applyTailwind(tailwind.css);
  xray.refresh();
  const done = performance.now();
  post({
    type: 'ran',
    id,
    ok: true,
    problems: [],
    timings: {
      styles: styled - started,
      compile: compiled - styled,
      mount: done - compiled,
      total: done - started,
    },
  });
  // Awaited, so the next message waits: the engine check renders on the fake Fabric, as a check
  // does, and two renders at once would clean each other up.
  const notes = [
    ...((await stylesChanged(files, tailwind, baseline)) ? await cssNotes(files, tailwind) : []),
    ...(await engineNotes(files, entry)),
  ];
  post({ type: 'notes', notes });
}

/**
 * What the engine says in development about the app, once, on the fake Fabric: an element no
 * component claims, or a prop no native view reads. A browser renders both without a word, and a
 * phone renders them wrong.
 */
async function engineNotes(files: Files, entry: string): Promise<Problem[]> {
  const module = await loadNative();
  const testing = module.testingWith();
  const said = new Set<string>();
  const original = { error: console.error, warn: console.warn };
  const listen =
    (level: 'error' | 'warn') =>
    (...args: unknown[]) => {
      const message = args.map(String).join(' ');
      if (ENGINE.test(message)) said.add(message.replace(ENGINE, ''));
      else original[level](...args);
    };
  console.error = listen('error');
  console.warn = listen('warn');
  testsRunning = true;
  try {
    const program = createProgram({ files, libraries: module.libraries() });
    testing.render(pickComponent(program.load(entry), entry) as never);
  } catch {
    // The preview has already reported whatever this would throw.
  } finally {
    module.cleanup();
    Object.assign(console, original);
    testsRunning = false;
  }
  return [...said].map((message) => ({ kind: 'device', message }));
}

let baselineStyles: { key: string; sheets: string; tailwind: string } | undefined;

/**
 * Whether any stylesheet, or the CSS Tailwind writes for the classes, differs from the lesson's
 * starting point: the moment there can be something new for the native compiler to say.
 */
async function stylesChanged(
  files: Files,
  tailwind: TailwindOutput,
  baseline: Files | undefined,
): Promise<boolean> {
  if (!baseline) return true;
  const key = JSON.stringify(baseline);
  if (baselineStyles?.key !== key) {
    baselineStyles = {
      key,
      sheets: JSON.stringify(stylesheetsIn(baseline)),
      tailwind: (await tailwindCss(baseline)).css,
    };
  }
  return (
    JSON.stringify(stylesheetsIn(files)) !== baselineStyles.sheets ||
    tailwind.css !== baselineStyles.tailwind
  );
}

/** What a device build would say about each stylesheet, and about the Tailwind classes. */
async function cssNotes(files: Files, tailwind: TailwindOutput): Promise<Problem[]> {
  const notes: Problem[] = [];
  if (tailwind.used) {
    const { dropped, error } = await compileNativeTailwind(tailwind.css);
    for (const message of error ? [error] : dropped) notes.push({ kind: 'css', message });
  }
  for (const [file, css] of stylesheetsIn(files)) {
    const { dropped, error } = await compileNativeCss(css, file);
    for (const message of error ? [error] : dropped) notes.push({ kind: 'css', file, message });
  }
  return notes;
}

async function whileTesting<T>(
  files: Files,
  work: (native: Native, options: Parameters<Native['runChecks']>[0]) => Promise<T>,
): Promise<T> {
  const module = await loadNative();
  testsRunning = true;
  try {
    return await work(module, {
      files,
      libraries: module.libraries(),
      nativeStyles: async () => {
        const tailwind = await tailwindCss(files);
        const { sheet } = tailwind.used ? await compileNativeTailwind(tailwind.css) : {};
        const sheets: Record<string, unknown> = {};
        for (const [file, css] of stylesheetsIn(files)) {
          sheets[file] = (await compileNativeCss(css, file)).sheet;
        }
        return { libraries: module.libraries({ globalStyles: sheet as never }), sheets };
      },
    });
  } finally {
    testsRunning = false;
  }
}

async function handle(message: ToPreview): Promise<void> {
  switch (message.type) {
    case 'run':
      await run(message.id, message.files, message.entry, message.baseline);
      return;
    case 'appearance':
      phone.setScheme(message.appearance.scheme);
      xray.set(message.appearance.xray);
      return;
    case 'test': {
      const outcomes = await whileTesting(message.files, (module, options) =>
        module.runTestFile(options, message.file),
      );
      post({ type: 'tested', id: message.id, outcomes });
      return;
    }
    case 'check': {
      const outcomes = await whileTesting(message.files, (module, options) =>
        module.runChecks(options, message.checks, message.step),
      );
      post({ type: 'checked', id: message.id, outcomes });
    }
  }
}

let queue = Promise.resolve();
addEventListener('message', (event: MessageEvent<ToPreview>) => {
  if (event.source !== parent || event.origin !== location.origin) return;
  queue = queue.then(() => handle(event.data)).catch((error: unknown) => report(problemOf(error)));
});

addEventListener('error', (event) => report(runtimeProblem(event.error ?? event.message)));
addEventListener('unhandledrejection', (event) => report(runtimeProblem(event.reason)));

// What goes wrong at run time - a handler that throws inside the renderer, a development warning -
// is said on the console, where a learner would never look.
for (const level of ['error', 'warn'] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    original(...args);
    const message = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    report({ kind: 'console', message });
  };
}

post({ type: 'ready', platform });
setInterval(() => post({ type: 'alive' }), 1000);
