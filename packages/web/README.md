# @solidnative/web

A browser host for solidnative: the same Solid `@solidnative/components`, rendered into the DOM instead
of native views. It implements the `HostEngine` seam the Fabric engine implements, so a `View`, a
`Pressable` or a `TextInput` behaves the same way in a browser as it does on a phone - which is what
the documentation site's live examples and this project's browser tests run on.

Alpha: APIs may change before 1.0.

## Install

```sh
npm install solid-js @solidnative/components @solidnative/web
npm install --save-dev vite typescript
```

A browser app builds with Vite. `solidNativeWeb()` compiles shared universal components for the
browser host, compiles `.native.css` sheets to scoped browser CSS, and rejects React Native imports
rather than bundling them:

```ts
// vite.config.ts
import { solidNativeWeb } from '@solidnative/web/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [solidNativeWeb()],
});
```

## Example

Mounting a component into a page:

```ts
import { mount } from '@solidnative/web';
import { App } from './app.solid.tsx';

const app = mount(document.getElementById('app')!, App, { inputs: { title: 'Hello' } });
app.setInputs({ title: 'Updated' });
app.dispose();
```

`mount` injects a reset stylesheet that gives elements React Native's layout defaults (border-box,
no flex shrinking, a full-height column root) unless `injectReset: false` is passed.

Inside a Solid DOM page you already have, place a shared component with `Island`. Passing the
page's owner shares its services and context, and disposes the island with it:

```tsx
import { Island } from '@solidnative/web';

<Island component={Wallet} inputs={{ accountId, onPaid }} />;
```

`@solidnative/web/web-view` mounts a Solid DOM component in the page a native web view loaded, and
talks to the app across the bridge.

## Docs

- [Web](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/web.md): setting up a browser app, with Tailwind
- [Native and web](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/guide/native-and-web.md)
- [Islands](https://github.com/byteab/solidnative/blob/main/apps/documentation/src/content/packages/web/islands.md)
- [Root README](https://github.com/byteab/solidnative/blob/main/README.md) and
  [ARCHITECTURE.md](https://github.com/byteab/solidnative/blob/main/ARCHITECTURE.md)

## License

MIT
