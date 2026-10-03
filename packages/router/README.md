# @solidnative/router

Routing for Solid over `react-native-screens` instead of the DOM: a real native stack, tabs and
header, not something drawn to look like one, with route config, lazy routes and deep links.

Alpha: APIs may change before 1.0.

## Install

Most apps start from `npx create-expo-app@latest my-app --template @solidnative/template` and add
routing on top. Otherwise:

```sh
npm install @solidnative/router solid-js react-native-screens
```

## Example

```tsx
import { SafeAreaProvider } from '@solidnative/components';
import { NativeStackOutlet, createNativeNavigation, type NativeRoute } from '@solidnative/router';

const routes: readonly NativeRoute[] = [
  { path: '', lazy: () => import('./home.tsx').then((m) => m.Home) },
  { path: 'settings', lazy: () => import('./settings.tsx').then((m) => m.Settings) },
];

export function App() {
  const navigation = createNativeNavigation(routes);
  return (
    <SafeAreaProvider>
      <NativeStackOutlet navigation={navigation} />
    </SafeAreaProvider>
  );
}
```

## What's in the package

- `createNativeNavigation` / `bindNativeNavigation` - the navigation state, deep links and
  hardware back for one app scope.
- `NativeStackOutlet`, `NativeTabsOutlet` - the outlets.
- `NativeHeader`, `NativeHeaderItem`, `NativeSearchBar`, `NativeBarDefaults` - the native header
  and its slots.
- `useNavigation`, `useRoute` - the current navigation and route from inside a screen.
- Screen presentation (modal, sheet, transparent modal) - what a URL alone cannot express.

## Docs

- [Router](https://github.com/byteab/solid-native/blob/main/apps/documentation/src/content/packages/router.md)
- [Root README](https://github.com/byteab/solid-native/blob/main/README.md) and
  [ARCHITECTURE.md](https://github.com/byteab/solid-native/blob/main/ARCHITECTURE.md)

## License

MIT
