---
title: Sharing
summary: The system share sheet, and what its result does and does not confirm.
---

# Sharing

`Sharing` opens the system share sheet.

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, Text } from '@solid-native/components/solid';
import { Sharing, useService } from '@solid-native/device/solid';

export function ShareArticle(props: { onShared: () => void }) {
  const sharing = useService(Sharing);

  async function share() {
    const shared = await sharing.share({
      url: 'https://example.com/article',
      title: 'Article',
    });
    if (shared) props.onShared();
  }

  return (
    <Pressable onPress={share}>
      <Text>Share</Text>
    </Pressable>
  );
}
```

`share(request)` takes `message` and/or `url` (iOS prefers `url`), plus `title`; with neither it
resolves `false`. `dialogTitle` and `subject` are not exposed. On Android, `url` is appended to
`message`. It resolves `true` when the user picked a target, which does not confirm delivery, and
`false` on dismissal, failure or disposal.

## Off a device and on the web

Off a device `share()` resolves `false`. On the web, call `navigator.share` or override
`Sharing.SOURCE`.

## Reference

<!-- api: Sharing -->
