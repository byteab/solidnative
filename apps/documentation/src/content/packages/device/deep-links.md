---
title: Deep links
summary: The url an app was launched with, and every link that arrives while it runs, as paths.
---

# Deep links

`DeepLinks` delivers the launch URL (`initialUrl()`) and later links (`subscribe()`) as router
paths.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { View } from '@solidnative/components/solid';
import { DeepLinks, useService } from '@solidnative/device/solid';

export function Root(props: { navigate: (path: string) => void }) {
  const links = useService(DeepLinks);
  const path = links.initialUrl();
  if (path) props.navigate(path);
  // Unsubscribed automatically when this component is disposed.
  links.subscribe((next) => props.navigate(next));
  return <View />;
}
```

`myapp://settings` and `https://example.com/settings` both become `/settings`; `pathOf` does this
alone. Expo Go's `/--/` prefix is stripped and the development client's
`<scheme>://expo-development-client/?url=...` launch url is ignored.

The launch url may arrive through either `initialUrl()` or `subscribe()`, so call both. `ready`
settles once it has been read, even on failure.

`open(url)` opens a url in another app. `Linking` is an alias. Most apps just pass it to
`@solidnative/router`'s `bindNativeNavigation(navigation, { links: useService(DeepLinks) })`.

## Off a device and on the web

Off a device `initialUrl()` stays `null` and `subscribe()` never fires. The web reads the address
bar instead.

## Reference

<!-- api: DeepLinks -->
