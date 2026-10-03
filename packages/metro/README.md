# @solid-native/metro

The build-time half of solid-native: a Metro config preset and Babel transformer that compiles Solid
JSX for the native host, turns each `.native.css` file into the rule set
[`@solid-native/fabric`](https://github.com/byteab/solid-native/blob/main/packages/fabric)
reads at runtime, inlines the `lucide-static` icons a file imports, and reloads cleanly on edits.

Alpha: APIs may change before 1.0.

## Install

Most apps start from `npx create-expo-app@latest my-app --template @solid-native/template`, which
already has this wired into `metro.config.js`. Otherwise:

```sh
npm install @solid-native/metro
npm install expo
```

## Example

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withSolidNative } = require('@solid-native/metro');

module.exports = withSolidNative(getDefaultConfig(__dirname));
```

No options in the common case. In a monorepo where the `@solid-native/*` packages live outside the
app's own `node_modules`, pass `{ workspaceRoot }`:

```js
module.exports = withSolidNative(getDefaultConfig(__dirname), {
  workspaceRoot: __dirname + '/../..',
});
```

## What's in the package

- `.` / `./solid-config.cjs` - `withSolidNative`, the Metro config preset.
- `./solid-babel.cjs` - `isSolidFile`, for the Babel override that turns React Refresh off for
  Solid files.
- `./solid-transformer.cjs`, `./solid-worker.cjs` - the Babel transformer and transform worker the
  preset wires in; `./solid-transform.cjs`, `./solid-css.cjs`, `./solid-runtime.cjs` - the
  compile stages, also used by test registers.
- `./css/*.cjs` - the build-time CSS compiler, also used by `@solid-native/tailwind`.
- `./inline-icons.cjs` - the build-time `lucide-static` import inliner.
- `./solid-lower.cjs` - compiles a `<View>` or `<Text>` from `@solid-native/components` whose
  props the component would forward unchanged (no spread, `ref`, alias, `aria-*`, press callback
  or `disabled`) to the `<view>` / `<text>` it renders, which mounts a third faster.
  A lowered element's children compile as any intrinsic's do, so a child `{f()}` hands `f` itself
  to `insert`: the same for a function, but a value that is not one renders instead of throwing.
  `transformSolid(..., { lowerPrimitives: false })` turns it off.

## Docs

- [Metro](https://solid-native.com/packages/metro)
- [Configuration](https://solid-native.com/packages/metro/configuration)
- [Root README](https://github.com/byteab/solid-native/blob/main/README.md) and
  [ARCHITECTURE.md](https://github.com/byteab/solid-native/blob/main/ARCHITECTURE.md)

## License

MIT
