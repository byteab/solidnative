---
title: Vibration
summary: The phone's motor - for an alarm, a timer or an incoming call, not for button feedback.
---

# Vibration

`Vibration` drives the phone's motor, for alarms and calls. Button feedback is haptics, in
`@solid-native/expo`.

```tsx
/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, Text } from '@solid-native/components/solid';
import { Vibration, useService } from '@solid-native/device/solid';

export function TimerAlarm() {
  const vibration = useService(Vibration);
  // Called when the timer runs out; the alarm buzzes until someone answers it.
  const ring = () => vibration.pattern([0, 500, 200, 500], { repeat: true });
  ring();
  return (
    <Pressable onPress={() => vibration.stop()}>
      <Text>Dismiss</Text>
    </Pressable>
  );
}
```

`buzz(durationMs?)` buzzes once (400ms default). `pattern(millis, options?)` alternates waits and
buzzes; `repeat: true` loops until `stop()`. Disposing the scope also stops it. iOS ignores the
durations.

## Off a device

Off a device every method does nothing.

## Reference

<!-- api: Vibration -->
