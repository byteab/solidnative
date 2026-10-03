# Solid rules

This repo is solid-native: SolidJS components rendering native iOS/Android views on React Native's
Fabric renderer through `solid-js/universal`. No DOM, no browser, and React never renders.
General Solid knowledge applies to signals, stores and components; its DOM parts
(`solid-js/web`, `render()`, `<Portal>`, `onClick`, `<div>`) do not.

- **App code** (examples/, template/, docs samples): follow `template/AGENTS.md`. It covers
  `.solid.tsx` / the `@jsxImportSource @solidnative/platform/solid` pragma, native components,
  `<Text>`-only text, native event props, `withNativeStyles` + `.native.css`, `VirtualList`, the
  router and tests.
- **Toolkit code** (packages/): the rules in `ARCHITECTURE.md` are load-bearing; read it before
  changing the renderer, engine or Metro pipeline.

## Solid

- Components run once. Read signals inside JSX, `createMemo` or effects; never destructure
  `props` (use `splitProps`/`mergeProps`).
- Derive with `createMemo`; keep effects for side effects. Clean up with `onCleanup`.
- Keyed lists: `<For>`; index-stable lists: `<Index>`. Immutable list replacement through a store
  uses `reconcile(..., { key })`.
- Control flow comes from `@solidnative/platform/solid`, never `solid-js/web`.
- Shared services: `useService`/`ServiceScope` from `@solidnative/device`, not module singletons
  holding reactive state.
- Prefer `unknown` over `any`; let inference handle obvious types.

## Toolkit layering

- `@solidnative/fabric` (the engine) imports no UI framework and no React Native; the host
  injects what it needs. Lint through `pnpm run lint` (Nx), which enforces this; bare `eslint`
  cannot.
- No React in `packages/*/src`: Metro treats the toolkit's own sources as Solid (React Refresh
  off).
- Allocation per node matters on Hermes: avoid per-node closures, proxies and maps in hot render
  paths (see `docs/performance.md`).

## Naming and layout

- kebab-case files named after what they hold; no `utils.ts`/`helpers.ts`/`common.ts`.
- Solid sources live in `src/solid/` in packages, tests in `solid-tests/` (apps: `*.test.ts` beside
  the code). Organise by feature, not by code type.

## Checks

- Tests run in two condition modes; a change must pass both: `pnpm run test` in the package, and
  the same with `node --conditions=worker --conditions=development` (`test:worker` where defined).
- Root: `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run coverage`
  (min 95% lines).
- A change to rendering is checked on a device too: a Release build of
  `examples/solid-acceptance` or the canary, on iOS and Android.
