# @solidnative/nx

Nx generators for native SolidJS apps: `nx add @solidnative/nx`, and an app generator that adds an
Expo app project to the workspace, rendering Solid components as native views and able to import the
workspace's libraries.

Alpha: APIs may change before 1.0.

## Install

```sh
nx add @solidnative/nx
nx g @solidnative/nx:app apps/mobile
```

`nx add` adds `@nx/expo` at the workspace's Nx version and registers its plugin, which infers the
app's Expo targets. The generator writes the template's app, with a `metro.config.js` wrapped in
`withNxMetro` so workspace libraries resolve, and adds `typecheck` (`tsc`) and `test` (Node's test
runner) targets.

## Example

```sh
nx start mobile            # expo start
nx run mobile:run-ios      # expo run:ios
nx export mobile --platform ios
nx test mobile             # node --test, on a fake Fabric
nx typecheck mobile
```

In a workspace whose root package is scoped, the project is `@org/mobile`.

## What's in the package

- `generators.json` - `init`, which `nx add` runs, and `application` (alias `app`).
- `files/` - the template's source files, which a test keeps identical to `template/`.

## Docs

- [Nx](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/nx.md)
- [Root README](https://github.com/byteab/solidnative/blob/main/README.md)

## License

MIT
