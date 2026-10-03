/** @jsxImportSource solid-js */
/**
 * The phone: a device drawn around the preview frame, the platform, colour scheme and X-ray
 * toggles above it, and what went wrong laid over the last app that worked.
 *
 * It runs the files it is given whenever they change, a moment after the typing stops, and says
 * how each run went through `onRan`. Checks and tests go through the same frame, so the lesson
 * page asks for them here, through `ref`.
 */
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { PreviewClient, type RunResult } from './preview-client.ts';
import type { CheckOutcome, Files, Platform, Problem, Scheme, TestOutcome } from './protocol.ts';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'learn-lesson-preview': HTMLAttributes<HTMLElement>;
    }
  }
}

/** The screens drawn: an iPhone 16 and a Pixel 9, in points. */
const SCREENS: Record<Platform, { width: number; height: number }> = {
  ios: { width: 393, height: 852 },
  android: { width: 412, height: 892 },
};

const BEZEL = 12;
const DEBOUNCE_MS = 350;

/** By kind; a kind without a title of its own is an error. */
export const PROBLEM_TITLES: Readonly<Record<string, string>> = {
  syntax: 'Syntax error',
  import: 'Import error',
  template: 'Template error',
  runtime: 'Error',
  css: 'Native build',
  device: 'On a device',
  console: 'Solid says',
};

const titleOf = (problem: Problem): string => PROBLEM_TITLES[problem.kind] ?? 'Error';

export function whereOf(problem: Problem): string {
  if (!problem.file) return '';
  return problem.line ? `${problem.file}:${problem.line}` : problem.file;
}

const PLATFORMS = [
  { value: 'ios' as const, label: 'iOS' },
  { value: 'android' as const, label: 'Android' },
];

/** What the lesson page can ask of the phone. */
export interface LessonPreviewApi {
  check(checks: string, step: number): Promise<readonly CheckOutcome[]>;
  test(file: string): Promise<readonly TestOutcome[]>;
}

export interface LessonPreviewProps {
  readonly files: Files;
  readonly entry: string;
  /** The files as the lesson started; see `baseline` in `protocol.ts`. */
  readonly baseline?: Files;
  readonly onRan?: (result: RunResult) => void;
  /** A problem's place in the files was chosen, to show it in the editor. */
  readonly onJump?: (problem: Problem) => void;
  /** Everything wrong right now, for the editor to mark: the last run's, and since. */
  readonly onProblems?: (problems: readonly Problem[]) => void;
  readonly ref?: (api: LessonPreviewApi) => void;
}

export function LessonPreview(props: LessonPreviewProps): JSX.Element {
  const [platform, setPlatform] = createSignal<Platform>('ios');
  const [scheme, setScheme] = createSignal<Scheme>('light');
  const [xray, setXray] = createSignal(false);

  /** What stopped the last run, or broke the app since. Shown over the phone. */
  const [runProblems, setRunProblems] = createSignal<readonly Problem[]>([]);
  const [laterProblems, setLaterProblems] = createSignal<readonly Problem[]>([]);
  const [deviceNotes, setDeviceNotes] = createSignal<readonly Problem[]>([]);
  /** Whether any run has put an app on screen, so an error can say it is over an older one. */
  const [everRan, setEverRan] = createSignal(false);
  /** Runs finished so far. See the `data-run-count` effect below. */
  const [runCount, setRunCount] = createSignal(0);

  const blocking = createMemo(
    () => runProblems()[0] ?? laterProblems().find((problem) => problem.kind !== 'console'),
  );
  const showingOld = () => runProblems().length > 0 && everRan();
  const notes = createMemo(() => [
    ...deviceNotes(),
    ...laterProblems().filter((problem) => problem.kind === 'console'),
  ]);

  const size = () => SCREENS[platform()];
  const [available, setAvailable] = createSignal({ width: 0, height: 0 });
  const scale = createMemo(() => {
    const { width, height } = available();
    const device = { width: size().width + BEZEL * 2, height: size().height + BEZEL * 2 };
    if (!width || !height) return 0.75;
    return Math.min(1, width / device.width, height / device.height);
  });

  let stage!: HTMLDivElement;
  let frame!: HTMLIFrameElement;
  let client: PreviewClient | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resize = new ResizeObserver(([entry]) => {
    if (entry) setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height });
  });

  function addLaterProblem(problem: Problem): void {
    setLaterProblems((problems) => [...problems, problem].slice(-20));
  }

  function schedule(delay: number): void {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), delay);
  }

  async function run(): Promise<void> {
    if (!client) return;
    let result: RunResult;
    try {
      result = await client.run(props.files, props.entry, props.baseline);
    } catch (error) {
      result = { ok: false, problems: [{ kind: 'runtime', message: (error as Error).message }] };
    }
    setRunProblems(result.problems);
    if (result.ok) {
      setLaterProblems([]);
      setEverRan(true);
    }
    props.onRan?.(result);
    setRunCount((count) => count + 1);
  }

  onMount(() => {
    resize.observe(stage);
    client = new PreviewClient(frame, platform(), {
      problem: addLaterProblem,
      notes: setDeviceNotes,
      reloaded: () => schedule(0),
    });
  });
  createEffect(() => {
    void props.files;
    void props.entry;
    schedule(DEBOUNCE_MS);
  });
  createEffect(() => props.onProblems?.([...runProblems(), ...laterProblems(), ...deviceNotes()]));
  createEffect(() => void client?.setPlatform(platform()));
  createEffect(() => client?.setAppearance({ scheme: scheme(), xray: xray() }));
  onCleanup(() => {
    clearTimeout(timer);
    resize.disconnect();
    client?.destroy();
  });

  props.ref?.({
    check: (checks, step) =>
      client ? client.check(props.files, checks, step) : Promise.resolve([]),
    test: (file) => (client ? client.test(props.files, file) : Promise.resolve([])),
  });

  const toggle = (on: boolean) =>
    on ? 'bg-surface-raised text-fg' : 'text-fg-tertiary hover:text-fg';

  const host = (
    <learn-lesson-preview class="flex min-h-0 flex-1 flex-col items-center gap-3">
      <div
        class="flex flex-wrap items-center justify-center gap-2"
        role="toolbar"
        aria-label="Preview"
      >
        <div
          class="flex rounded-lg border border-border-default p-0.5"
          role="group"
          aria-label="Platform"
        >
          <For each={PLATFORMS}>
            {(option) => (
              <button
                type="button"
                class={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                  platform() === option.value
                    ? 'bg-surface-raised text-fg shadow-sm'
                    : 'text-fg-tertiary hover:text-fg'
                }`}
                aria-pressed={platform() === option.value}
                onClick={() => setPlatform(option.value)}
              >
                {option.label}
              </button>
            )}
          </For>
        </div>
        <button
          type="button"
          class={`h-8 rounded-lg border border-border-default px-2.5 text-xs font-medium transition-colors ${toggle(scheme() === 'dark')}`}
          aria-pressed={scheme() === 'dark'}
          onClick={() => setScheme(scheme() === 'dark' ? 'light' : 'dark')}
        >
          Dark
        </button>
        <button
          type="button"
          class={`h-8 rounded-lg border border-border-default px-2.5 text-xs font-medium transition-colors ${toggle(xray())}`}
          aria-pressed={xray()}
          onClick={() => setXray(!xray())}
        >
          X-ray
        </button>
      </div>

      <div
        ref={stage}
        class="relative flex min-h-0 w-full flex-1 items-start justify-center overflow-hidden"
      >
        <div
          class="device relative shrink-0 origin-top"
          classList={{
            'device-android': platform() === 'android',
            'device-dark': scheme() === 'dark',
          }}
          style={{
            width: `${size().width + BEZEL * 2}px`,
            height: `${size().height + BEZEL * 2}px`,
            transform: `scale(${scale()})`,
            'margin-bottom': `${(size().height + BEZEL * 2) * (scale() - 1)}px`,
          }}
        >
          <div class="device-screen" style={{ inset: `${BEZEL}px` }}>
            <iframe
              ref={frame}
              title="Preview"
              sandbox="allow-scripts"
              class="block h-full w-full border-0"
            />
            <div class="device-status" aria-hidden="true">
              <span>9:41</span>
              <span class="device-status-icons">
                <svg viewBox="0 0 18 12" width="18" height="12">
                  <path fill="currentColor" d="M1 8h3v4H1zM6 6h3v6H6zM11 3h3v9h-3zM16 0h2v12h-2z" />
                </svg>
                <svg viewBox="0 0 26 12" width="25" height="12">
                  <rect
                    x=".5"
                    y=".5"
                    width="22"
                    height="11"
                    rx="3"
                    fill="none"
                    stroke="currentColor"
                    opacity=".4"
                  />
                  <rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor" />
                  <rect
                    x="24"
                    y="4"
                    width="1.5"
                    height="4"
                    rx=".75"
                    fill="currentColor"
                    opacity=".4"
                  />
                </svg>
              </span>
            </div>
            <div class="device-camera" aria-hidden="true" />
            <div class="device-home" aria-hidden="true" />

            <Show when={blocking()}>
              {(problem) => (
                <div
                  class="absolute inset-x-3 bottom-8 z-10 max-h-[55%] overflow-auto rounded-2xl bg-[#3b0a0f]/95 p-4 text-white shadow-2xl backdrop-blur"
                  role="alert"
                >
                  <div class="flex items-baseline justify-between gap-3">
                    <h3 class="text-sm font-semibold">{titleOf(problem())}</h3>
                    <Show when={whereOf(problem())}>
                      {(where) => (
                        <button
                          type="button"
                          class="font-mono text-xs text-white/80 underline underline-offset-2 hover:text-white"
                          onClick={() => props.onJump?.(problem())}
                        >
                          {where()}
                        </button>
                      )}
                    </Show>
                  </div>
                  <p class="mt-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-white/90">
                    {problem().message}
                  </p>
                  <Show when={showingOld()}>
                    <p class="mt-3 text-[11px] text-white/60">
                      The app behind this is the last version that ran.
                    </p>
                  </Show>
                </div>
              )}
            </Show>
          </div>
        </div>
      </div>

      <Show when={notes().length}>
        <ul class="flex w-full max-w-md flex-col gap-1.5" aria-label="Notes">
          <For each={notes()}>
            {(note) => (
              <li class="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-fg-secondary">
                <span class="font-medium text-fg">{titleOf(note)}</span>
                <Show when={whereOf(note)}>
                  {(where) => (
                    <button
                      type="button"
                      class="ml-1 font-mono text-fg-tertiary underline underline-offset-2 hover:text-fg"
                      onClick={() => props.onJump?.(note)}
                    >
                      {where()}
                    </button>
                  )}
                </Show>
                <span class="block font-mono text-[11px] break-words">{note.message}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </learn-lesson-preview>
  ) as HTMLElement;

  // How many runs have finished, on the host, so a caller - `e2e/learn.spec.ts`, chiefly - can
  // wait for the run started by a particular edit to have actually landed on the phone, instead
  // of guessing how long a debounce plus a round trip to the frame takes.
  createEffect(() => host.setAttribute('data-run-count', String(runCount())));

  return host;
}
