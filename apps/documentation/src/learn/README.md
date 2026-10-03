# The course

`/learn` is an interactive course that builds a habit tracker. The learner writes Solid in an
editor and it runs beside them in a phone-shaped preview, compiled in the browser.

## Outline

| #   | Lesson                 | What it teaches                                                                                           |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Your first screen      | A component and its JSX; `<View>` and `<Text>`; imports; expressions in JSX.                              |
| 2   | Layout and style       | Flexbox as a phone does it; component CSS compiled to native; what fails.                                 |
| 3   | A list of habits       | `<For>` with a `fallback`, a derived count; `<ScrollView>` and `contentContainerStyle`.                   |
| 4   | State and components   | `createSignal`, `createMemo`; `<Pressable>`; `HabitRow` with props and callbacks.                         |
| 5   | Tailwind and platforms | Tailwind with the native preset; `pt-safe`, `active:`, `ios:`, `android:`, `dark:`.                       |
| 6   | A form for new habits  | `<TextInput>` bound to a signal: native blur, `maxLength`, the return key.                                |
| 7   | Testing                | `@solid-native/testing` with Vitest: `render`, `screen`, `userEvent.press`, `vi.fn`; what needs a device. |

Each lesson starts where the one before it ended.

## A lesson

A directory under `lessons/`, listed in `outline.ts`:

- `lesson.md`: an introduction, then one `##` section per step.
- `starter/`: the files as the lesson starts.
- `steps/<n>/`: every file as step n leaves it, for each step but the last, whose files are
  `solution/`. The Solve step button in the editor puts the current step's snapshot in place, and
  nothing further; there is no button for the whole lesson. All of them are type-checked with the
  rest of the site.
- `checks.ts`: `check(step, name, run, hint)` for each thing a step asks for, written as tests
  against the learner's files. See `check.ts`.

A learner can add files with the + after the file tabs and remove any but the entry file (the
first of `app.tsx`, `app.ts` or `src/app.tsx` the starter has; see `file-name.ts`), so a lesson
can ask for a new component file. A check that imports a file the learner has not written yet gets
an empty module, so it fails on its own rather than stopping every check.

`lessons.test.ts` runs every lesson's checks against its solution, where they must pass, and its
starter, where the first step's must not. Each step's snapshot must pass the checks of that step
and those before it, and fail at least one of the next step's, so solving a step never gives away
the one after. `lessons.android.test.ts` runs them again on the
Android engine: the preview checks on whichever platform the phone shows, so a check has to pass on
both. The suite itself is `lesson-suite.ts`. It also checks that a starter's CSS gives a device
build nothing to say, since the preview holds those notes back until a stylesheet changes.

## How the preview works

`learn-preview.html` is a page of its own, in a frame, so the learner's code and its styles cannot
reach the lesson page. `preview/frame.ts` is its entry point; `protocol.ts` is the messages both
ways; `preview-client.ts` is the lesson page's half.

The frame is sandboxed with `allow-scripts` and without `allow-same-origin`, so its origin is
opaque: the learner's code cannot read the site's cookies or storage, or touch the lesson page, and
messages are the only way between the two. Everything the frame loads is then a cross-origin
request, so `public/_headers` has Cloudflare Pages send `Access-Control-Allow-Origin: *` with
`/assets/*`, and `vite.config.ts` sends the same in development and `vite preview`. The course's
end-to-end tests check the opaque origin and that a message from any other window is ignored.

- `preview/program.ts` compiles each file (TypeScript and Solid's JSX) in the browser, adds a
  guard in every loop, and links the files.
- `preview/phone.ts` mounts the app with `@solid-native/web` and keeps the last good one on screen.
- `preview/tailwind.ts` runs Tailwind's compiler over the files with the native preset;
  `preview/native-css.ts` runs the native CSS compiler on lightningcss's WebAssembly build.
- The WebAssembly is 3.8 MB compressed, so it downloads only when something needs it: a check
  passed `{ readsStyles: true }`, a learner's test that reads `.props`, or the first run whose
  stylesheets or Tailwind classes differ from the lesson's starter, which is when the device
  build notes start. Checks without the flag render with no compiled styles, in the preview and in
  `lessons.test.ts`, so a check that forgets it fails in CI. Of the lessons now, 2, 3 and 5 have a
  first-step check that reads styles; the rest open without the download.
- `preview/test-runner.ts` runs the learner's tests and the lesson's checks with
  `@solid-native/testing`, against the fake Fabric.
- `preview/xray.ts` labels each element with the native view it becomes.

## Checking a deploy

The end-to-end tests run against `vite preview`, which imitates `public/_headers` rather than
reading it. Only Cloudflare Pages itself shows that the file is picked up and its rule matches, so
after a deploy that touches either, open a lesson on the deployed site and check that the phone
shows the app, and that `curl -sI <site>/assets/<any file>` answers with
`access-control-allow-origin: *`. A preview frame that stays blank, with CORS errors in the console,
is the header missing.
