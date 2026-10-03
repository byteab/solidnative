import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';

/**
 * Two rules earn their place here. The rest is deliberately absent: formatting is not enforced,
 * and stylistic rules are left to review.
 *
 * `@nx/enforce-module-boundaries` turns the layering in ARCHITECTURE.md into something checkable.
 * The engine is framework-agnostic, and without this nothing would say so but a comment: one
 * `import 'solid-js'` in `packages/fabric` would pass every test we have.
 *
 * `complexity` is a brake on sprawl. A function that grows another branch every time a case turns
 * up is how this codebase would rot, and it is the failure mode least visible in review.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      // Scratch apps the tailwind tests make and delete while lint may be walking the same folder.
      '**/.tailwind-*',
      '**/dist/**',
      '.claude/**',
      // The benchmark harness: probes run by hand against built bundles, not shipped code.
      'scripts/perf/**',
      'examples/*/.expo/**',
      // The published starters. Their files are an app's source, copied verbatim into someone
      // else's project, so this workspace's boundary rules do not apply to them. They are verified
      // by being used: `scripts/verify-publish.mjs` publishes to a local registry, generates an
      // app from each and bundles it, which is a stronger check than linting them in place.
      'template/**',
      // The generator's copies of the template's files, for the same reason. They are an app's
      // source, and a test in the package fails if they stop matching the template's.
      'packages/nx/files/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs', '**/*.cjs'],
    languageOptions: { parser: tseslint.parser, sourceType: 'module', ecmaVersion: 2023 },
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          // Off: `@solid-native/metro` and `@solid-native/tailwind` ship as the JavaScript they are
          // written in and have nothing to build, so a built package requiring them is correct.
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints: [
            {
              // Solid renderer adapters own the host context, without depending on public UI.
              sourceTag: 'layer:adapter',
              onlyDependOnLibsWithTags: ['layer:runtime', 'layer:device'],
              bannedExternalImports: ['lightningcss'],
            },
            {
              // The engine knows nothing about a UI framework or React Native:
              // the host passes in what it needs.
              sourceTag: 'layer:runtime',
              onlyDependOnLibsWithTags: [],
              bannedExternalImports: [
                'solid-js',
                'solid-js/*',
                'react',
                'react/*',
                'react-native',
                'react-native/*',
              ],
            },
            {
              // The build-time half runs in a Metro worker, never on a device. It must not be
              // reachable from anything that ships.
              sourceTag: 'layer:build',
              // Build-time packages may use each other - the Tailwind step chains onto the Metro
              // transformer - but nothing that ships may reach them, which is the half that matters.
              onlyDependOnLibsWithTags: ['layer:build'],
            },
            {
              // Platform capabilities: the keyboard, the screen, the OS, the user's settings.
              // Below the UI packages because both they and an app need them, and
              // the boundary below forbids those packages from reaching into each other.
              sourceTag: 'layer:device',
              onlyDependOnLibsWithTags: ['layer:runtime'],
              bannedExternalImports: ['lightningcss'],
            },
            {
              // The UI packages sit on the engine, on the platform capabilities, and on the Solid
              // adapter. They must not reach into each other: a component should not import the
              // router.
              sourceTag: 'layer:ui',
              onlyDependOnLibsWithTags: ['layer:runtime', 'layer:device', 'layer:adapter'],
              bannedExternalImports: ['lightningcss'],
            },
            {
              // Optional Expo/SVG native adapters reuse shared component prop/ref contracts.
              // They cannot depend on routing, other extensions or build-time tooling.
              sourceTag: 'layer:view-extension',
              onlyDependOnLibsWithTags: [
                'layer:runtime',
                'layer:device',
                'layer:adapter',
                'scope:components',
              ],
              bannedExternalImports: ['lightningcss'],
            },
            {
              // A test harness for apps, run by Node and never bundled. The fake Fabric needs the
              // engine's node shapes; `render()` mounts through the platform, the way an app
              // boots; and the runner hooks compile through Metro's transform, so a test runs
              // what the bundle would.
              sourceTag: 'layer:testing',
              onlyDependOnLibsWithTags: [
                'layer:runtime',
                'layer:ui',
                'layer:view-extension',
                'layer:adapter',
                'layer:build',
              ],
            },
            {
              // The integration suite mounts real components through the adapter onto the fake
              // Fabric, so it reaches into everything on purpose. That is what makes them
              // integration tests rather than unit tests, and why they are their own project.
              sourceTag: 'layer:tests',
              onlyDependOnLibsWithTags: ['*'],
            },
            {
              // The example app may use everything, which is the point of it.
              sourceTag: 'layer:app',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    /*
     * The only cross-project imports allowed to stay relative, and each has to be.
     *
     * Each is a test or test host that reaches a package's internals, which the entry points do
     * not export, or mounts real components onto the unshipped fake Fabric. Everything else in
     * this project imports through the package entry points, and the rule stays on to keep it
     * that way.
     */
    files: [
      'packages/integration-tests/fixtures/**/*.ts',
      // The renderer benchmark mounts the real components, for the same reason a fixture does.
      'packages/integration-tests/bench/**/*.ts',
      'packages/integration-tests/router-*.test.ts',
      'packages/integration-tests/device.test.ts',
      'packages/integration-tests/icons.test.ts',
      'packages/integration-tests/animation.test.ts',
      'packages/integration-tests/web-animation.test.ts',
      'packages/integration-tests/worklet-style.test.ts',
      'packages/integration-tests/gesture.test.ts',
      'packages/integration-tests/gesture-dispatch.test.ts',
      'packages/integration-tests/worklet-scroll.test.ts',
      'packages/integration-tests/css-index.test.ts',
      'packages/integration-tests/height-index.test.ts',
      'packages/integration-tests/css-scale.test.ts',
      'packages/integration-tests/tailwind.test.ts',
      'packages/integration-tests/tailwind-metro.test.ts',
      // Tests of internals the package entry points do not export, which have no other way in.
      'packages/integration-tests/css-cost.test.ts',
      'packages/integration-tests/dev-loading-view.test.ts',
      'packages/integration-tests/device-sources.test.ts',
      'packages/integration-tests/dialogs.test.ts',
      'packages/integration-tests/engine-commit.test.ts',
      'packages/integration-tests/expo.test.ts',
      'packages/integration-tests/fabric-facade.test.ts',
      'packages/integration-tests/host-primitives.test.ts',
      'packages/integration-tests/layout-animation.test.ts',
      'packages/integration-tests/native-props.test.ts',
      'packages/integration-tests/native-state.test.ts',
      'packages/integration-tests/web-parity.test.ts',
      // `@solid-native/web` is `layer:ui` and rightly cannot import `@solid-native/components` from its
      // own source. Its tests are a different matter: proving the seam holds means mounting real
      // components through it, and the browser tests compile the separate DOM page with the real
      // Metro DOM compiler.
      'packages/web/solid-tests/register.mjs',
      'packages/web/solid-tests/host-register.mjs',
      'packages/web/solid-tests/host.solid.tsx',
      'packages/web/solid-tests/host-browser.mjs',
      'packages/web/solid-tests/signature-browser.mjs',
      'packages/web/solid-tests/*.test.ts',
      'packages/web/solid-tests/*.tsx',
      // The Vite preset an app's build config imports: build tooling shipped beside the package,
      // which no file under `src` imports.
      'packages/web/solid-vite.mjs',
      // The other way round: `@solid-native/testing`'s own tests import the package by its name,
      // not by relative path, because they stand in for an app's tests and an app has no other
      // way in. A relative import would bypass the `exports` map those tests exist to prove.
      'packages/testing/src/**/*.test.{ts,tsx}',
      'packages/testing/src/**/*.vitest.tsx',
      // This test loader compiles native TSX through the build-time package. Shipped platform
      // source remains forbidden from reaching the compiler.
      'packages/platform/solid-tests/compiled-loader.mjs',
      'packages/platform/solid-tests/css-compiled-register.mjs',
      // Native API regressions share the unshipped immutable fake Fabric and TSX fixtures.
      'packages/components/solid-tests/*.test.ts',
      'packages/components/solid-tests/*.tsx',
      'packages/router/solid-tests/*.test.ts',
      'packages/router/solid-tests/*.tsx',
      'packages/device/solid-tests/*.test.ts',
      'packages/device/solid-tests/*.tsx',
      'packages/expo/solid-tests/*.test.ts',
      'packages/expo/solid-tests/*.tsx',
      'packages/icons/solid-tests/*.test.ts',
      'packages/icons/solid-tests/*.tsx',
      // Canary Solid regressions use the same unshipped immutable native test host.
      'examples/canary/solid-tests/*.test.ts',
      'examples/canary/solid-tests/consumer-harness.ts',
      'examples/canary/solid-tests/*.tsx',
      // The other example apps' Solid tests share the same host.
      'examples/{wallet,habits,music,runs,notes}/solid-tests/*.ts',
      'examples/{wallet,habits,music,runs,notes}/solid-tests/*.tsx',
    ],
    rules: { '@nx/enforce-module-boundaries': 'off' },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs', '**/*.cjs'],
    rules: {
      complexity: ['error', { max: 12 }],
    },
  },
);
