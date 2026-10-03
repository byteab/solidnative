---
title: Dialogs
summary: The platform's own alert, confirmation, prompt, action sheet and toast, as promises.
---

# Dialogs

`Dialogs` wraps the platform's alert, confirmation, prompt, action sheet and toast as promises.

```tsx
/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, Text } from '@solidnative/components/solid';
import { Dialogs, useService } from '@solidnative/device/solid';

export function NoteRow(props: { onDelete: () => void }) {
  const dialogs = useService(Dialogs);

  async function remove() {
    const sure = await dialogs.confirm('Delete this note?', { destructive: true });
    if (sure) props.onDelete();
  }

  return (
    <Pressable onPress={remove}>
      <Text>Delete</Text>
    </Pressable>
  );
}
```

`tell(title, message?, dismiss?)` resolves when dismissed. `confirm(title, options?)` resolves to
whether the user agreed; `destructive` makes the button red. Buttons keep platform order (iOS:
Cancel left, confirm right). `ask(title, options?)` resolves to a
line of text or `null`; it is iOS only and resolves `null` on Android.

`choose(title, choices)` takes `Choice`s (`{ label, style? }`, `style` one of
`'default' | 'cancel' | 'destructive'`) and resolves to an index or `null`: an action sheet on iOS,
a dialog on Android, with Cancel appended if missing. Android shows at most three buttons, so
longer lists log a console error. `notify(message, options?)` is an Android toast; no-op on iOS.

Open questions settle as canceled when their component is disposed, though the dialog stays.

## Off a device and on the web

Off a device everything resolves at once as canceled and `notify()` does nothing. For web
fallbacks, override `Dialogs.SOURCE` with `provideService`.

## Reference

<!-- api: Dialogs -->
