# @solid-native/testing

Runs an solid-native Solid component test in plain Node, in milliseconds, with no simulator and no
device: Testing Library's `render()` and `screen`, and React Native Testing Library's `fireEvent`
and `userEvent`, over a fake of the native side.

Alpha: APIs may change before 1.0.

## Install

Most apps start from `npx create-expo-app@latest my-app --template @solid-native/template`, which
already has this set up. Otherwise:

```sh
npm install --save-dev @solid-native/testing
```

## Example

```json
// package.json
{
  "scripts": { "test": "node --import @solid-native/testing/register --test \"src/**/*.test.ts\"" }
}
```

```ts
// app.test.ts
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, render, screen, userEvent } from '@solid-native/testing';
import { App } from './app.solid.tsx';

afterEach(cleanup);

test('counts taps', async () => {
  render(App);

  await userEvent.press(screen.getByRole('button'));

  assert.ok(screen.getByText('Tapped 1 times'));
});
```

The root, renderer, styling engine, responder system, and every component under test are the real
ones - only `nativeFabricUIManager` is faked, so a query reads what native would actually have been
sent.

## What's in the package

- `.` - `render(Component, { props, platform, engineOptions, clock })`, `renderWith(boot)` for an
  app's own entry, `screen`, `within`, `fireEvent`, `userEvent`, `waitFor`, `gestureOf`, `settle`,
  `cleanup()`, `createFakeFabric()` and `createClock()`.
- `./register` - a Node module hook for `node --import @solid-native/testing/register --test`: Solid
  TSX and `.native.css` compiled as Metro compiles them, `solid-js`'s client build, asset requires
  as `{ testUri }`, and stand-ins for the native gesture and animation libraries.
- `./vitest` - `solidNative()`, the same as a Vite plugin, for projects that would rather use Vitest.

## Docs

- [Testing](https://solid-native.com/packages/testing)
- [Setup](https://solid-native.com/packages/testing/setup),
  [writing a test](https://solid-native.com/packages/testing/writing-a-test) and the
  [API reference](https://solid-native.com/packages/testing/api)
- [Root README](https://github.com/byteab/solid-native/blob/main/README.md) and
  [ARCHITECTURE.md](https://github.com/byteab/solid-native/blob/main/ARCHITECTURE.md)

## License

MIT
