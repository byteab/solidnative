---
title: Testing styles
summary: A component's own .native.css with nothing extra, and a global stylesheet passed through render()'s engineOptions.
---

# Testing styles

Continues from [Writing a test](/packages/testing/writing-a-test). A component's own `.native.css`,
applied with `withNativeStyles`, is compiled by the register hook with Metro's CSS compiler and needs
nothing extra. A global stylesheet (what Tailwind classes resolve against), compiled by the same
compiler, goes to `render()` as `engineOptions.globalStyles`, passed on to `createNativeRoot`:

```ts
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, test } from 'node:test';
import { cleanup, render, screen } from '@solid-native/testing';
import { Badge } from './badge.solid.tsx';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

afterEach(cleanup);

test('applies a global stylesheet', () => {
  render(Badge, {
    engineOptions: {
      globalStyles: compileCss('.badge { background-color: rgb(1, 2, 3) }', 'global'),
    },
  });

  assert.equal(screen.getByTestId('badge').props['backgroundColor'], 'rgb(1, 2, 3)');
});
```

where `Badge` is `<View testID="badge" class="badge"><Text>New</Text></View>` in a `.solid.tsx`
file. Styles flatten onto props, not a `style` key, so `backgroundColor` is exactly what the native
view paints. A small test-only stylesheet keeps the test about which rule wins, not about current
token values. `createRequire` is needed because the compiler is CommonJS.

The hook compiles `.native.css` for iOS, or Android with `SOLID_NATIVE_PLATFORM=android`; rules for
another platform or condition are absent from the sheet.
