/** @jsxImportSource solid-js */
/**
 * A lesson: the steps on the left, the editor in the middle and the phone on the right.
 *
 * The files are the learner's own from the moment the lesson opens, and are saved as they change.
 * Every time the preview runs them successfully, the checks for the step they are on run too,
 * and a step whose checks all pass is marked done.
 */
import { batch, createEffect, createMemo, createSignal, For, on, onCleanup, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { CodeEditor, type CodeEditorApi } from './code-editor.tsx';
import { COURSE_TITLE, LESSONS, loadLesson, orderFiles, type Lesson } from './course.ts';
import { checkFileName, isTestFile } from './file-name.ts';
import { LessonPreview, type LessonPreviewApi } from './lesson-preview.tsx';
import type { RunResult } from './preview-client.ts';
import { getProgress, saveProgress } from './progress.ts';
import type { CheckOutcome, Files, Problem, TestOutcome } from './protocol.ts';
import { applyNotFound, applySeo } from '../seo.ts';
import { SITE_NAME } from '../site.ts';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'learn-lesson-page': HTMLAttributes<HTMLElement>;
    }
  }
}

type CheckState = 'waiting' | 'running' | 'stale' | 'done';

const firstLine = (text: string | undefined): string => (text ?? '').split('\n')[0] ?? '';

const passed = (outcomes: readonly TestOutcome[]): number =>
  outcomes.filter((outcome) => outcome.ok).length;

export function LessonPage(props: { slug: string }): JSX.Element {
  /** The lesson on screen, and whether the slug names none. */
  const [lesson, setLesson] = createSignal<Lesson>();
  const [missing, setMissing] = createSignal(false);

  const [files, setFiles] = createSignal<Files>({});
  const [activeFile, setActiveFile] = createSignal('');
  const [step, setStep] = createSignal(0);
  const [done, setDone] = createSignal<readonly number[]>([]);
  const [problems, setProblems] = createSignal<readonly Problem[]>([]);
  const [checks, setChecks] = createSignal<readonly CheckOutcome[]>([]);
  const [checkState, setCheckState] = createSignal<CheckState>('waiting');
  const [tests, setTests] = createSignal<readonly TestOutcome[]>();
  /** Whether the new file's name is being typed, and what is wrong with the last one tried. */
  const [naming, setNaming] = createSignal(false);
  const [nameError, setNameError] = createSignal('');

  let editor: CodeEditorApi | undefined;
  let preview: LessonPreviewApi | undefined;
  let newName: HTMLInputElement | undefined;
  let checkRun = 0;

  const fileNames = createMemo(() => orderFiles(files(), lesson()?.entry));
  const specFile = createMemo(() => fileNames().find(isTestFile));
  const currentStep = () => lesson()?.steps[step()];
  const stepChecks = createMemo(() => checks().filter((outcome) => outcome.step === step() + 1));
  const stepPassed = () => done().includes(step());
  const nextLesson = createMemo(() => {
    const at = LESSONS.findIndex((entry) => entry.slug === props.slug);
    return LESSONS.slice(at + 1).find((entry) => !entry.planned);
  });

  // The same page is kept from one lesson to the next, so a new slug opens its lesson afresh.
  createEffect(
    on(
      () => props.slug,
      (slug) => {
        let current = true;
        onCleanup(() => (current = false));
        void loadLesson(slug).then((loaded) => {
          if (!current) return;
          batch(() => {
            if (loaded) open(loaded);
            setMissing(!loaded);
            setLesson(loaded);
          });
        });
      },
    ),
  );

  createEffect(() => {
    const shown = lesson();
    if (missing()) applyNotFound();
    else if (shown) {
      applySeo({
        title: `${shown.title} - Learn ${SITE_NAME}`,
        description: shown.summary,
        path: `/learn/${shown.slug}`,
        type: 'article',
      });
    }
  });

  function stepClass(index: number): string {
    if (done().includes(index)) return 'bg-emerald-600';
    return index === step() ? 'bg-fg' : 'bg-border-strong hover:bg-fg-quaternary';
  }

  function errorsIn(file: string): boolean {
    return problems().some((problem) => problem.file === file && problem.kind !== 'css');
  }

  function goToStep(index: number): void {
    const shown = lesson();
    if (!shown) return;
    setStep(Math.max(0, Math.min(index, shown.steps.length - 1)));
    save();
    void runChecks();
  }

  function edit(file: string, text: string): void {
    setFiles((current) => ({ ...current, [file]: text }));
    save();
  }

  function startNaming(): void {
    setNameError('');
    setNaming(true);
  }

  function stopNamingIfEmpty(typed: string): void {
    if (!typed.trim()) setNaming(false);
  }

  function addFile(event: Event): void {
    event.preventDefault();
    const result = checkFileName(newName?.value ?? '', fileNames());
    if ('error' in result) {
      setNameError(result.error);
      return;
    }
    setNaming(false);
    edit(result.name, '');
    setActiveFile(result.name);
  }

  function removeFile(name: string): void {
    const empty = !files()[name]?.trim();
    if (!empty && !confirm(`Remove ${name}? What is in it will be lost.`)) return;
    setFiles(({ [name]: _removed, ...rest }) => rest);
    if (activeFile() === name) setActiveFile(lesson()?.entry ?? '');
    save();
  }

  function reset(shown: Lesson): void {
    if (!confirm('Put this lesson back to how it started? Your changes to it will be lost.'))
      return;
    setFiles(shown.starter);
    setTests(undefined);
    save();
  }

  /** Puts the files as this step leaves them in place; the checks run once the preview has. */
  function solveStep(shown: Lesson): void {
    const at = step();
    const question = `Replace your files with the solution to step ${at + 1}? Your changes to them will be lost.`;
    if (!confirm(question)) return;
    setFiles(shown.snapshots[at]!);
    setTests(undefined);
    save();
  }

  async function runTests(file: string): Promise<void> {
    setTests(await (preview?.test(file) ?? Promise.resolve([])));
  }

  function onRan(result: RunResult): void {
    if (result.ok) void runChecks();
    else if (checkState() === 'done') setCheckState('stale');
  }

  function jumpTo(problem: Problem): void {
    if (!problem.file || !(problem.file in files())) return;
    setActiveFile(problem.file);
    // After the editor has swapped to the file.
    setTimeout(() => editor?.goTo(problem.line ?? 1, problem.column ?? 0));
  }

  function open(shown: Lesson): void {
    const saved = getProgress(shown.slug);
    setFiles(saved?.files ?? shown.starter);
    setStep(Math.min(saved?.step ?? 0, shown.steps.length - 1));
    setDone(saved?.done ?? []);
    setActiveFile(shown.entry);
    setChecks([]);
    setCheckState('waiting');
    setTests(undefined);
    setProblems([]);
  }

  async function runChecks(): Promise<void> {
    const shown = lesson();
    if (!shown || !preview) return;
    const run = ++checkRun;
    setCheckState('running');
    const outcomes = await preview.check(shown.checks, step() + 1).catch(() => []);
    if (run !== checkRun) return;
    setChecks(outcomes);
    setCheckState('done');
    const steps = new Set(outcomes.map((outcome) => outcome.step - 1));
    const passedSteps = [...steps].filter((at) =>
      outcomes.filter((outcome) => outcome.step - 1 === at).every((outcome) => outcome.ok),
    );
    setDone((current) => [...new Set([...current.filter((at) => !steps.has(at)), ...passedSteps])]);
    save();
  }

  function save(): void {
    const shown = lesson();
    if (!shown) return;
    saveProgress(shown.slug, { files: files(), step: step(), done: done() });
  }

  return (
    <learn-lesson-page class="block">
      <Show
        when={!missing()}
        fallback={
          <div class="prose mx-auto max-w-2xl py-16">
            <h1>No such lesson</h1>
            <p>
              <a href="/learn">Back to the course</a>
            </p>
          </div>
        }
      >
        {/* Keyed: a new lesson gets a new editor and phone, as each lesson starts afresh. */}
        <Show when={lesson()} keyed>
          {(shown) => (
            <div class="learn-workspace">
              <aside class="learn-steps flex min-h-0 flex-col border-border-subtle">
                <div class="shrink-0 border-b border-border-subtle px-5 py-4">
                  <a href="/learn" class="text-xs font-medium text-fg-tertiary hover:text-fg">
                    {COURSE_TITLE}
                  </a>
                  <h1 class="mt-1 font-display text-xl font-semibold tracking-tight text-fg">
                    <span class="text-fg-tertiary">{shown.number}.</span> {shown.title}
                  </h1>
                  <ol class="mt-3 flex gap-1.5" aria-label="Steps">
                    <For each={shown.steps}>
                      {(item, index) => (
                        <li class="flex-1">
                          <button
                            type="button"
                            class={`h-1.5 w-full rounded-full transition-colors ${stepClass(index())}`}
                            aria-label={`Step ${index() + 1}: ${item.title}`}
                            aria-current={index() === step() ? 'step' : undefined}
                            onClick={() => goToStep(index())}
                          />
                        </li>
                      )}
                    </For>
                  </ol>
                </div>

                <div class="min-h-0 flex-1 overflow-auto px-5 py-5">
                  <Show when={step() === 0}>
                    <div class="prose learn-prose mb-6" innerHTML={shown.intro} />
                  </Show>
                  <Show when={currentStep()}>
                    {(current) => (
                      <>
                        <p class="text-xs font-medium tracking-wide text-fg-tertiary uppercase">
                          Step {step() + 1} of {shown.steps.length}
                        </p>
                        <h2 class="mt-1 font-display text-lg font-semibold text-fg">
                          {current().title}
                        </h2>
                        <div class="prose learn-prose mt-3" innerHTML={current().html} />
                      </>
                    )}
                  </Show>

                  <section class="mt-6" aria-label="Checks">
                    <ul class="flex flex-col gap-2">
                      <For each={stepChecks()}>
                        {(outcome) => (
                          <li
                            class="flex gap-2.5 rounded-lg border border-border-subtle px-3 py-2.5 text-sm"
                            classList={{ 'opacity-60': checkState() === 'stale' }}
                          >
                            <span
                              class={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                                outcome.ok ? 'bg-emerald-600' : 'bg-fg-quaternary'
                              }`}
                              aria-hidden="true"
                            >
                              {outcome.ok ? '✓' : ''}
                            </span>
                            <div class="min-w-0">
                              <p class="text-fg" data-check={outcome.ok ? 'pass' : 'fail'}>
                                {outcome.name}
                              </p>
                              <Show when={!outcome.ok && checkState() === 'done'}>
                                <p class="mt-1 text-xs text-fg-tertiary">
                                  {outcome.hint ?? firstLine(outcome.error)}
                                </p>
                              </Show>
                            </div>
                          </li>
                        )}
                      </For>
                    </ul>
                    <Show when={checkState() === 'stale'}>
                      <p class="mt-2 text-xs text-fg-tertiary">
                        These are from the last version that ran.
                      </p>
                    </Show>
                  </section>
                </div>

                <div class="flex shrink-0 items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
                  <button
                    type="button"
                    class="learn-button"
                    disabled={step() === 0}
                    onClick={() => goToStep(step() - 1)}
                  >
                    Back
                  </button>
                  <Show
                    when={step() < shown.steps.length - 1}
                    fallback={
                      <Show
                        when={nextLesson()}
                        fallback={
                          <a class="learn-button" href="/learn">
                            All lessons
                          </a>
                        }
                      >
                        {(next) => (
                          <a
                            class="learn-button"
                            classList={{ 'learn-button-primary': stepPassed() }}
                            href={`/learn/${next().slug}`}
                          >
                            Next lesson
                          </a>
                        )}
                      </Show>
                    }
                  >
                    <button
                      type="button"
                      class="learn-button"
                      classList={{ 'learn-button-primary': stepPassed() }}
                      onClick={() => goToStep(step() + 1)}
                    >
                      Next step
                    </button>
                  </Show>
                </div>
              </aside>

              <section class="learn-editor flex min-h-0 min-w-0 flex-col" aria-label="Code">
                <div class="flex shrink-0 items-center gap-1 border-b border-border-subtle px-2">
                  <div
                    class="flex min-w-0 flex-1 gap-0.5 overflow-x-auto"
                    role="tablist"
                    aria-label="Files"
                  >
                    <For each={fileNames()}>
                      {(name) => (
                        <div class="relative flex shrink-0 items-center">
                          <button
                            type="button"
                            role="tab"
                            class="h-10 px-3 font-mono text-[13px] transition-colors"
                            classList={{
                              'pr-1': name !== shown.entry,
                              'text-fg': name === activeFile(),
                              'text-fg-tertiary hover:text-fg': name !== activeFile(),
                            }}
                            aria-selected={name === activeFile()}
                            onClick={() => setActiveFile(name)}
                          >
                            {name}
                            <Show when={errorsIn(name)}>
                              <span
                                class="ml-1 inline-block size-1.5 rounded-full bg-red-500 align-middle"
                                aria-label="has an error"
                              />
                            </Show>
                          </button>
                          <Show when={name !== shown.entry}>
                            <button
                              type="button"
                              class="mr-1 flex size-5 items-center justify-center rounded text-fg-quaternary hover:bg-surface-raised hover:text-fg"
                              aria-label={`Remove ${name}`}
                              onClick={() => removeFile(name)}
                            >
                              ×
                            </button>
                          </Show>
                          <Show when={name === activeFile()}>
                            <span class="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />
                          </Show>
                        </div>
                      )}
                    </For>
                    <Show
                      when={naming()}
                      fallback={
                        <button
                          type="button"
                          class="flex h-10 w-8 shrink-0 items-center justify-center text-base text-fg-tertiary hover:text-fg"
                          aria-label="New file"
                          onClick={startNaming}
                        >
                          +
                        </button>
                      }
                    >
                      <form class="flex shrink-0 items-center gap-2 px-1" onSubmit={addFile}>
                        <input
                          ref={(element) => {
                            newName = element;
                            // Once it is in the page: a ref runs before the element is inserted.
                            queueMicrotask(() => element.focus());
                          }}
                          class="h-7 w-40 rounded-md border bg-surface-page px-2 font-mono text-[13px] text-fg outline-none"
                          classList={{
                            'border-red-500': !!nameError(),
                            'border-border-default focus:border-brand': !nameError(),
                          }}
                          aria-label="New file name"
                          placeholder="new-habit.tsx"
                          autocomplete="off"
                          spellcheck={false}
                          aria-invalid={nameError() ? true : undefined}
                          aria-describedby={nameError() ? 'learn-file-name-error' : undefined}
                          onInput={() => setNameError('')}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') setNaming(false);
                          }}
                          onBlur={(event) => stopNamingIfEmpty(event.currentTarget.value)}
                        />
                        <Show when={nameError()}>
                          {(error) => (
                            <span
                              id="learn-file-name-error"
                              class="text-xs text-red-600"
                              role="alert"
                            >
                              {error()}
                            </span>
                          )}
                        </Show>
                      </form>
                    </Show>
                  </div>
                  <Show when={specFile()}>
                    {(spec) => (
                      <button
                        type="button"
                        class="learn-button learn-button-small"
                        onClick={() => void runTests(spec())}
                      >
                        Run tests
                      </button>
                    )}
                  </Show>
                  <button
                    type="button"
                    class="learn-button learn-button-small"
                    onClick={() => reset(shown)}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    class="learn-button learn-button-small"
                    onClick={() => solveStep(shown)}
                  >
                    Solve step {step() + 1}
                  </button>
                </div>
                <CodeEditor
                  ref={(api) => (editor = api)}
                  files={files()}
                  file={activeFile()}
                  problems={problems()}
                  onEdited={(change) => edit(change.file, change.text)}
                />
                <Show when={tests()}>
                  {(outcomes) => (
                    <section
                      class="max-h-[40%] shrink-0 overflow-auto border-t border-border-subtle px-4 py-3"
                      aria-label="Test results"
                    >
                      <p class="text-xs font-medium text-fg-secondary">
                        {passed(outcomes())} of {outcomes().length} tests passed
                      </p>
                      <ul class="mt-2 flex flex-col gap-1.5">
                        <For each={outcomes()}>
                          {(outcome) => (
                            <li class="text-sm">
                              <span class={outcome.ok ? 'text-emerald-600' : 'text-red-600'}>
                                {outcome.ok ? 'Pass' : 'Fail'}
                              </span>
                              <span class="ml-2 text-fg">{outcome.name}</span>
                              <Show when={!outcome.ok}>
                                <pre class="mt-1 overflow-x-auto rounded-md bg-surface-sunken p-2 font-mono text-[11px] whitespace-pre-wrap text-fg-secondary">
                                  {outcome.error}
                                </pre>
                              </Show>
                            </li>
                          )}
                        </For>
                      </ul>
                    </section>
                  )}
                </Show>
              </section>

              <section class="learn-phone flex min-h-0 flex-col px-4 py-4" aria-label="Preview">
                <LessonPreview
                  ref={(api) => (preview = api)}
                  files={files()}
                  entry={shown.entry}
                  baseline={shown.starter}
                  onRan={onRan}
                  onJump={jumpTo}
                  onProblems={setProblems}
                />
              </section>
            </div>
          )}
        </Show>
      </Show>
    </learn-lesson-page>
  );
}
