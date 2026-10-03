# @solidnative/fabric

The framework-agnostic engine underneath solidnative's Solid renderer: a retained view tree, a commit
step into React Native's Fabric, and a CSS engine with a real cascade. No UI-framework import
anywhere in it - that boundary is enforced by lint, not just convention.

Alpha: APIs may change before 1.0.

## Install

Most apps never depend on this directly; `@solidnative/platform` and `@solidnative/components` pull it
in. Install it explicitly only to call `nativePlatform()` or `registerViewName()` yourself:

```sh
npm install @solidnative/fabric
```

## Example

Registering a third-party Fabric component that ships no solidnative bindings of its own:

```ts
import { registerViewName } from '@solidnative/fabric';

registerViewName('rns-screen', 'RNSScreen');
```

Reading the platform in a component that needs to answer differently per platform:

```ts
import { nativePlatform } from '@solidnative/fabric';

const platform = nativePlatform(); // 'ios' | 'android'
```

## What's in the package

- `getFabricUIManager()` - reads `global.nativeFabricUIManager`, passed to `mount()`.
- `registerViewName()` / `registerPlatformComponents()` - map element and third-party component
  names onto Fabric's native components.
- `nativePlatform()` - the current platform, without importing `react-native`'s `Platform`.
- The CSS engine that `@solidnative/metro` compiles component styles for, and that
  `@solidnative/tailwind` compiles utility classes for.

## Docs

- [Fabric](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/fabric.md)
- [The CSS engine](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/fabric/css-engine.md),
  [what CSS reaches a device](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/fabric/supported-css.md) and
  [animation](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/fabric/animation.md)
- [Root README](https://github.com/byteab/solidnative/blob/main/README.md) and
  [ARCHITECTURE.md](https://github.com/byteab/solidnative/blob/main/ARCHITECTURE.md)

## License

MIT
