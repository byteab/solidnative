---
title: Switch
summary: Switch, a native toggle, controlled the way React Native's is.
art: switch
---

# Switch

`Switch` is a native toggle - `Switch` on iOS, `AndroidSwitch` on Android.

```tsx
const [enabled, setEnabled] = createSignal(false);

<Switch value={enabled()} onValueChange={setEnabled} />;
```

## Forms

`Switch` takes `disabled`, `invalid`, `touched` and `onTouched` (on blur), reflected as
`data-disabled`, `data-invalid` and `data-touched`. `bindFormField` produces these plus `value`,
`onValueChange` and `ref`, so a bound switch is
`<Switch {...bindFormField(form.fields.enabled)} />`; see [Input](/packages/components/input) for
the forms API.

## Colors on both platforms at once

iOS reads `onTintColor`, `tintColor` and `thumbTintColor`; Android reads `trackColorForTrue`,
`trackColorForFalse`, `trackTintColor`, `thumbTintColor` and `on` for the value. `Switch` sends
both, so `thumbColor` and `trackColor` (a `{ false?, true? }` pair) work on either platform.
`ios_backgroundColor` colours behind the off track on iOS, visible where the track is transparent.

## Controlled, as in React Native

With `value`, the switch shows your state. A flip calls `onValueChange` with the proposed value; if
your state keeps the old one, the switch flips back:

```tsx
// Always ends up off: the handler refuses every flip.
<Switch value={enabled()} onValueChange={() => setEnabled(false)} />

// Takes a flip only while unlocked.
<Switch value={enabled()} onValueChange={(next) => unlocked() && setEnabled(next)} />
```

A refusal produces no prop change, so after the next commit `Switch` compares `value` with native
and, if they differ, sends React Native's command: `setValue` on iOS, `setNativeValue` on Android.
An accepted flip or a value set from code needs no command; the prop carries it.

A defined `value` at creation makes the switch controlled for good, so `value` without
`onValueChange` cannot be flipped, as in React Native. Decide synchronously in the handler: a value
arriving after the commit is first treated as a refusal, then applied. Leave `value` undefined
(optionally with `defaultValue`) for an uncontrolled switch; `onValueChange` reports each flip.
`onChange` receives the raw native event. `disabled` ignores touches, greys the control and changes
the announced state.

<!-- api: @solid-native/components#Switch -->
