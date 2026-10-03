# Releasing

Every package in `nx.json`'s `release.projects`, and the starter template, is released together at
one version. `.github/workflows/release.yml` does it, run by hand from the Actions tab on `main`.

## Once, before the first release

1. **Own the npm scope.** Create the `solidnative` organization on npmjs.com. Every package publishes
   as `@solidnative/*`, and a publish to a scope you do not own fails.
2. **Publish each package once by hand.** npm only lets a trusted publisher be configured on a
   package that already exists. `0.1.1` went out this way, from a local build.
3. **Configure trusted publishing** on each package's settings page on npmjs.com: GitHub Actions,
   owner `byteab`, repository `solid-native`, workflow `release.yml`. The release publishes
   through OIDC and no npm token is stored anywhere.

## Describing changes

A change someone using the packages would notice comes with a **version plan**: a markdown file
in `.nx/version-plans/` saying what changed and how big a bump it is. `npx nx release plan` writes
one interactively, or write it by hand:

```md
---
__default__: minor
---

A virtual list recycles its rows when a template tracks them by slot.
```

`__default__` covers every package, which is right while they are released in lockstep. `minor` is
the bump for a breaking change under `0.x`, and `patch` for anything else. Each release turns the
plans it finds into its `CHANGELOG.md` entry and deletes them, so the changelog says what the
plans said, not what the commit messages did. Refactors, tests and docs need no plan.

## Each release

Run **Release** from the Actions tab, on `main`, once CI is green there. Its input is either an exact
version or a bump. Releases are plain `0.x` versions on npm's `latest` tag,
which is what `create-expo-app --template @solidnative/template` resolves: `minor` for a release with
a breaking change, since under `0.x` a minor is the breaking bump, and `patch` otherwise.

The workflow first builds the canary natively for iOS and Android (`native.yml`). Each release build
is then launched, iOS on a simulator and Android on an emulator, and driven through a short Maestro
flow (`examples/canary/.maestro/release`), so an app that builds but crashes at launch fails there,
as it does on every pull request. Beside it, the
`generators` job adds a native app to a fresh Nx workspace (the TypeScript preset) with
`nx add @solidnative/nx`, and tests and bundles it, installing with npm. Once all of those pass, it runs the same gate CI does, then:

- `nx release version` writes the version to every package and the template, and
  `nx release changelog` turns the version plans into the `CHANGELOG.md` entry, then commits both
  as `Release <version>` and tags it `v<version>`.
- `nx run-many -t build` compiles each package into its `dist` with `tsc`, without the Nx cache:
  JavaScript and declarations, which its `publishConfig.exports` point at.
- `pnpm pack` turns each `workspace:*` dependency into that exact version.
- A separate `publish` job, the only one allowed to mint npm's OIDC token, takes the tarballs and
  runs `npm publish` with provenance, on `latest`. It checks nothing out and installs nothing, so a
  compromised dependency in the build cannot publish. A version with a prerelease suffix
  (`0.2.0-rc.0`) would go out under that suffix's dist-tag instead, so `latest` never moves to it.
- The `push` job pushes the commit and tag, and creates a GitHub release with the changelog entry
  as its notes.

The documentation site is not part of a release: `docs.yml` builds it on every pull request and
deploys it to Cloudflare Pages only once the `CLOUDFLARE_ACCOUNT_ID` variable and
`CLOUDFLARE_API_TOKEN` secret are set.

If it fails before publishing, nothing has left the runner: fix it and run it again. If it fails part
way through publishing, run it again with the same exact version (not a bump): packages already on
npm at that version are skipped, and the rest are published.

## Checking distribution locally

`node scripts/verify-publish.mjs` publishes everything to a local Verdaccio, generates an app with
`create-expo-app --template @solidnative/template`, and bundles it. With `--web` it also sets up a
browser app on `@solidnative/web` as its documentation page does, builds it with Vite and checks it in
Chromium. CI runs both on every push. With `--generators` it also runs the Nx workspace check
above, which take several minutes, so only the release workflow does. `--scenario=web` runs the
browser check alone. The README has the local steps.

## The weekly check against the newest versions

This repository pins its dependencies, and a user's new workspace installs the newest versions our
ranges allow, so the two drift apart between releases: a minor release of a dependency can break
every new app while the tests here still pass. `.github/workflows/latest.yml` runs every Monday, and by hand
from the Actions tab, to catch that within a week. Each job runs one scenario of
`node scripts/verify-publish.mjs --scenario=<name>`: the template with npm and with pnpm, and
Nx's TypeScript preset with npm and with pnpm. Every scenario runs its install a second time and
bundles for iOS and Android. The job summary lists the Solid, Expo, React Native, Nx, TypeScript and
Vite each scenario resolved. A scheduled failure opens an issue
titled `Latest versions: <scenario> fails`, or comments on the one already open; close it once
the fix is in.
