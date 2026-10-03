---
title: Nx
summary: nx add and an app generator for an Nx workspace, with Expo's targets inferred by @nx/expo's plugin.
---

# Nx

`@solid-native/nx` adds a solid-native app to an Nx workspace as an ordinary project:

```sh
nx add @solid-native/nx
nx g @solid-native/nx:app apps/mobile
nx start mobile
```

`nx start` runs Metro, like `npx expo start`. Workspace libraries opt into the native transform as
the app does, with the `@jsxImportSource @solid-native/platform/solid` pragma or a `.solid.tsx`
suffix. With a scoped root package (as the TypeScript preset makes), the project takes the scope:
`nx start @org/mobile`. The generators emit Solid only; there is no component generator.

## What nx add does

It adds `@nx/expo` at the workspace's Nx version and registers its plugin in `nx.json`, which
infers an Expo project's targets from `app.json`, `metro.config.js` and `package.json`.

It skips `@nx/expo:init`, which on Nx 23.2 installs SDK 56 with a `react-dom` wanting React 19.3;
npm refuses that beside solid-native's SDK 57 and React 19.2.3. It adds what the app needs from
`init` at the app's versions instead: `react-dom` (else `@nx/react`'s peer pulls 19.3 and later
installs fail) and `@expo/cli`, which `nx prebuild` loads from the root.

It also adds Babel 7's `@babel/runtime` at the root for Expo's Babel preset; otherwise an Angular
build's `@angular-devkit/build-angular` hoists Babel 8's (no `regenerator`) and Metro warns on
every `nx start`.

## The targets

| Command                 | From           | What runs                                                           |
| ----------------------- | -------------- | ------------------------------------------------------------------- |
| `nx start mobile`       | `project.json` | `expo start`                                                        |
| `nx run mobile:run-ios` | `@nx/expo`     | `expo run:ios`, and `run-android` likewise                          |
| `nx export mobile`      | `@nx/expo`     | `expo export`; `--platform ios` for one platform                    |
| `nx prebuild mobile`    | `@nx/expo`     | `expo prebuild`                                                     |
| `nx build mobile`       | `@nx/expo`     | an EAS build, on Expo's machines                                    |
| `nx test mobile`        | `project.json` | `node --test` over `src/**/*.test.ts`, with `@solid-native/testing` |
| `nx typecheck mobile`   | `project.json` | `tsc -p tsconfig.json --noEmit`                                     |

`@nx/expo` provides no `typecheck` (Expo's `tsconfig` sets `noEmit`, so `@nx/js` skips it) or
`test`, so the generator writes both. `test` is Node's test runner with
`@solid-native/testing/register` first, no simulator needed; see [Testing](/packages/testing).
`start` runs `expo start` directly because Nx 23 deprecates `@nx/expo:start`; `nx prebuild` and
`nx build` still use `@nx/expo`'s executors and print that warning.

## The files

The app is the template's: `src/main.solid.ts`, `src/app/app.solid.tsx`, `src/app/app.native.css`,
`src/app/app.test.ts`, `src/native-styles.d.ts` and `babel.config.js` unchanged, an `AGENTS.md`
with the workspace's commands, and an `app.json` named for the project that lists only `ios` and
`android` (Expo adds `web` whenever `react-dom` resolves, and Nx always installs it). Three files
differ because of Nx:

- **`metro.config.js`** wraps `@nx/expo`'s `withNxMetro` (which resolves and watches workspace
  libraries) in `withSolidNative`. Without it Metro cannot follow tsconfig path aliases and reports
  `Cannot resolve @org/ui`. The preset is outermost so it can resolve a library's `./lib/ui.js`
  import to `ui.ts`, as TypeScript does.
- **`tsconfig.json`** keeps the template's Solid settings (`jsx: preserve`,
  `jsxImportSource: @solid-native/platform/solid`). With a `tsconfig.base.json` it extends that
  after Expo's (for the path aliases) and restores the Expo settings the base overrides.
- **`test-register.mjs`** exists only when a workspace base provides path aliases. It imports
  `@solid-native/testing/register` and adds a resolve hook for the aliases, since Node's test
  runner ignores tsconfig; the `test` target imports it instead of the plain register.

## Where the dependencies go

With package-manager workspaces (Nx's default since 20), the app lists its own dependencies, and
the generator adds a workspace glob if needed (the TypeScript preset has only `packages/*`). In an
integrated workspace they go in the root `package.json`, existing versions untouched, with a
warning for any npm will not install beside solid-native. The app's `package.json` still names the
native modules at the root's ranges, because Expo links only those.

## Options

`nx g @solid-native/nx:app <directory>` takes `--name` (the directory's last segment by default),
`--tags` and `--skipInstall`.
