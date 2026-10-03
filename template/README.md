# My native Solid app

A SolidJS app rendering real native views, created from `@solidnative/template`.

```sh
npm start          # Metro; scan the QR code with Expo Go, or press i / a for a simulator
npm run ios        # straight to the iOS simulator
npm run android    # straight to the Android emulator
npm test           # the example test in src/app/app.test.ts, in Node with no simulator
npm run typecheck
```

`src/app/app.solid.tsx` is the root component, styled by `src/app/app.native.css`, and
`src/main.solid.ts` mounts it. Expo Go is enough for development; a release build or a native
module Expo Go does not include needs a development build (`npx expo run:ios`). The tests use
Node's own test runner and need Node 24.

The app targets iOS and Android, so there is no `npm run web`, whatever `create-expo-app` suggests
as it finishes.

`AGENTS.md` tells a coding agent how this framework differs from the web Solid and the React Native
it knows (Claude Code reads it through `CLAUDE.md`). Add your own conventions to it as the app
grows.

Docs: https://github.com/byteab/solidnative/tree/main/apps/documentation/src/content
