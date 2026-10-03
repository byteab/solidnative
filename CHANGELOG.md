## 0.1.2 (2026-10-03)

### 🩹 Fixes

- The project is now solidnative, at github.com/byteab/solidnative. Package READMEs and homepages link to the documentation in the repository, and the web guide gives `.native.css` imports their own type.

## The move to SolidJS (first published as `@solidnative/*` 0.1.1, 2026-10-03)

### ⚠️ Breaking changes

- ng-native is now **solidnative**. The packages move from `@ng-native/*` to `@solidnative/*`
  (`@solidnative/platform`, `@solidnative/router`, ...), so update imports, `package.json`
  dependencies and Babel/Metro config requires to the new scope. Diagnostics are prefixed
  `[solidnative]`, generated files live in `.solidnative/`, and the example apps' bundle ids are
  `dev.solidnative.*`. The `@ng-native/*` packages already on npm are left as they are.
  solidnative builds on [ng-native](https://github.com/ng-native/ng-native) by Ashley Hunter.
- `@solidnative/icons` draws [Lucide](https://lucide.dev) icons from `lucide-static` instead of the
  Angular `@ng-icons/*` sets: `import { Flame } from 'lucide-static'` and pass it to `Icon`, which
  Metro still inlines at build time. `strokeWidth` replaces the icon's own `stroke-width`.
- solidnative renders Solid, and the Angular renderer is removed. Components are Solid functions
  compiled at build time by Solid's universal JSX transform onto the same retained Fabric engine,
  styled with scoped `.native.css` sheets; each package's root export is its Solid entry, with the
  `./solid*` subpaths kept as aliases. `@angular/*` is no longer a dependency of anything published.
  The Angular CLI schematics (`ng add`, `ng generate`) are retired with it: create an app with
  `create-expo-app --template @solidnative/template`, or add one to an Nx workspace with
  `nx add @solidnative/nx`. The template and the Nx generator test with `@solidnative/testing`'s
  `render`, `screen` and `userEvent`, compiled for Node by `@solidnative/testing/register`.

## 0.1.1 (2026-09-29)

### 🩹 Fixes

- An app from `ng add @ng-native/schematics` or `nx g @ng-native/nx:app` starts without warnings. ([#5](https://github.com/ng-native/ng-native/pull/5))
  Its `app.json` sets the router root, as the template's does, so Expo no longer prints "Using
  src/app as the root directory for Expo Router". In Nx, the app's `start` target runs `expo start`
  itself rather than through `@nx/expo:start`, whose deprecation notice Nx printed on every
  `nx start`, and `nx add @ng-native/nx` adds Babel 7's `@babel/runtime` at the root, so Metro no
  longer warns about `@babel/runtime/regenerator` in an `@nx/angular` workspace. For an app made
  before this release, add `"extra": { "router": { "root": "src/app" } }` to its `app.json`; in Nx,
  also add a `start` target running `expo start` in the app's directory and `@babel/runtime@^7.20.0`
  to the root `devDependencies`.

- The template targets iOS and Android only. ([#5](https://github.com/ng-native/ng-native/pull/5))
  Its `app.json` names both as its `platforms`, and the web favicon, its `web` settings and
  `web-build/` in `.gitignore` are gone. The Angular CLI and Nx generators name the same platforms.
  Angular Native components render in a browser through `@ng-native/web`, which is set up
  separately.

### ❤️ Thank You

- Ashley Hunter

## 0.1.0 (2026-09-29)

### 🚀 Features

- The first public release: Angular components as real native iOS and Android views, in an Expo app. ([8803fb6](https://github.com/ng-native/ng-native/commit/8803fb6))
  Angular Native is built on Expo and React Native's Fabric renderer, so an app is created, run, hot
  reloaded, built and shipped with the Expo tooling you already know, and Expo's modules - the photo
  picker, location, Face ID and fingerprint, sign-in through the system browser, pictures from the
  camera view, notifications, secure storage and the rest - are available as Angular services and
  directives. Alongside that: a CSS engine that compiles stylesheets and Tailwind at build time, a
  native stack and tab router over `@angular/router`, Signal Forms support, device services, and a
  testing library that runs components in Node against a fake Fabric.

### ❤️ Thank You

- Ashley Hunter
