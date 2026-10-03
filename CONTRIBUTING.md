# Contributing

## Prerequisites

- Node 24 (see `.nvmrc`); the packages require at least the `engines.node` floor in `package.json`,
  `>=22.18`.
- pnpm, pinned by `packageManager` in `package.json` (currently `pnpm@10.28.1`). Enable it with
  `corepack enable` if you do not already have it. npm is not supported in this workspace - the
  packages resolve through pnpm workspace links.

## Getting set up

```sh
pnpm install
```

Nx sits on top of pnpm workspaces for task running, caching, and module-boundary enforcement, so
run these through the root scripts rather than calling the underlying tools directly:

```sh
pnpm lint          # boundaries and complexity, through Nx so the project graph exists
pnpm typecheck      # every project, against its own tsconfig
pnpm test           # the full seam against a fake Fabric, no simulator
pnpm coverage       # same, with a 95% coverage floor enforced
pnpm format         # prettier --write .
pnpm format:check   # prettier --check ., what CI runs
pnpm affected       # lint, typecheck and test for what a change can have broken
pnpm export         # a release bundle of every example for iOS and Android, one at a time
```

Lint must go through `nx run-many -t lint` (what `pnpm lint` does): `@nx/enforce-module-boundaries`
needs the project graph and silently enforces nothing without it, so running `eslint` bare will not
catch a boundary violation.

Run `pnpm export` after changing the CSS engine, the Metro transform or an example's styles. A
release bundle compiles every component in the app, lazily loaded screens included, so it fails on
any rule the compiler refuses.

A package resolves only what it declares: there is no hoisted root that answers everything, so an
import a package forgot to declare fails here rather than on someone else's machine.
`pnpm-workspace.yaml` pins the React Native native modules with `overrides`, because a native
module has to exist exactly once in a build: a second copy of Reanimated is a second copy of its
native side, and it silently does nothing. The versions are the ones Expo SDK 57 bundles, which
`npx expo install --check` verifies.

## Running the app and the docs site

```sh
pnpm --filter canary start     # the canary, in Expo Go or a simulator
pnpm --filter documentation dev  # the documentation site, on http://localhost:5201
```

## Where tests live

- `packages/integration-tests` exercises the engine, the CSS engine and the Metro transform
  together onto a fake Fabric, rather than one package in isolation.
- Each package and example keeps its Solid tests in `solid-tests/`, run by Node's test runner in
  both export-condition modes (the default, and `--conditions=worker --conditions=development`).
- `packages/web` has its own suites: `node:test` suites in `src/` and `solid-tests/`, and a
  Chromium suite (`pnpm --filter @solid-native/web test:browser`).
- `packages/testing` has tests of its own, for the fake Fabric and the Testing Library layer it
  ships to everyone else.

Most other packages carry `*.test.ts` files next to the source they test.

## CSS engine changes are test-first

The CSS engine does not fail the build on what it cannot express: an unsupported declaration is
dropped with a build warning, and a regression in the engine can drop one with no warning at all.
Write the test that pins down the expected behavior before changing
`packages/fabric`'s or `packages/metro`'s CSS code, and keep coverage high there - that is what
catches a regression this engine would otherwise hide.

Every Tailwind utility is checked too. `tailwind-sweep.test.ts` builds a stylesheet from every
utility Tailwind lists (a spread of the values of a scale, all of a handful), arbitrary values, the
values of an app's own theme (`fixtures/tailwind-sweep-theme.css`), `!`, every variant, the pairs
of utilities that build one value together (found from the CSS: one sets a `--tw-*` property the
other reads, or sets again one the other sets and reads) and a shorthand beside each of its sides,
and holds each case to:

- the build does not throw, and the case either takes effect or is refused with a warning;
- what it commits is a prop React Native declares, with a keyword it takes;
- what it resolves to agrees with what Chrome computes, on iOS and on the web host (the web preset
  and `@solid-native/web`'s reset); and each variant probe agrees again on Android, in dark mode, at
  two more widths and with every state an attribute sets, with the `android:` pairs on Android;
- what a view hands down to a text inside it agrees too;
- its transform comes to the matrix Chrome's does, and its animation paints what Chrome's does at
  points through its first cycle;
- its layout, by Yoga configured as React Native configures it, lands where the web host puts it;
- the module Metro writes holds exactly the sheet checked.

A difference that is a design decision, a known gap or Yoga's own behaviour is listed in the test
with its reason, and the test fails when one stops happening. Two fixtures record what it compares
against:

```sh
cd packages/integration-tests
pnpm tailwind-oracle                                   # Chrome's answers, after a Tailwind upgrade
TAILWIND_SWEEP_UPDATE=1 node --import @solid-native/testing/register --test tailwind-sweep.test.ts
```

Read the diff of the second before committing it: each line is a utility that is refused
differently.

What the sweep reads as props, the canary's Tailwind screen draws.
`examples/canary/.maestro/ios/visual/tailwind.yaml` compares it with a screenshot (`pnpm e2e:ios` in
`examples/canary`, against a release build; `pnpm e2e:ios:record` takes a new one), and the Android
release smoke opens it in CI. `pnpm bench:tailwind` in `packages/integration-tests` times a screen
of Tailwind cards through the engine.

## Architecture rules

[`ARCHITECTURE.md`](./ARCHITECTURE.md) lists the rules the design depends on (everything compiled at
build time, at most one commit per scheduler flush, scoped sheets, clean development reload, the
engine never importing a UI framework or React Native, and more). Each one is load-bearing - breaking it does not degrade the architecture, it invalidates
it - so a change that would cross one of these needs a different approach, not an exception.

## Checking distribution locally

Before a change that touches packaging, exports, or the release workflow, verify publishing works
end to end without touching npmjs.com:

```sh
npx verdaccio --config verdaccio.yaml   # a local registry, in one terminal
npm adduser --registry http://localhost:4873   # once: publishing needs a user, any name will do
node scripts/verify-publish.mjs         # publish, generate an app, bundle it
```

It publishes every package and the starter template to that registry, runs
`create-expo-app --template @solid-native/template`, installs from the registry so the packages
find each other **by version** rather than through workspace links, then typechecks and bundles the
result. Nothing reaches npmjs, and the registry has no uplink for `@solid-native/*` so a package
that failed to publish cannot be quietly satisfied by the real one.

See [RELEASING.md](./RELEASING.md) for how an actual release goes out.

## Pull requests

- CI must be green.
- Describe why the change is needed, not just what changed - the diff already says what.
- A change someone using the packages would notice comes with a version plan in
  `.nx/version-plans/` - `npx nx release plan` writes one. The release's `CHANGELOG.md` entry is
  made from them; see [RELEASING.md](./RELEASING.md#describing-changes).
- Commit messages here are sentence-case summaries of the change, often followed by a body
  explaining why (see `git log --oneline -20` for the style); there is no conventional-commits
  prefix convention (`feat:`, `fix:`, and so on) in use.

For maintainers cutting a release, see [RELEASING.md](./RELEASING.md).
