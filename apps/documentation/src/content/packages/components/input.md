---
title: Text input
summary: TextInput, keyboards, forms, and the props a browser has no name for.
art: input
---

# Text input

`TextInput` is controlled as in React Native and works with Solid forms without adapters:
`createForm` builds fields and `bindFormField` turns one into `TextInput` props, so
`<TextInput {...bindFormField(form.fields.name)} />` is the whole integration. Without a form, use
`value` plus `onValueChange`.

```tsx
const profile = createForm({ name: '' }, { name: { validate: [formRequired()] } });

<TextInput placeholder="Name" {...bindFormField(profile.fields.name)} />;
```

## The forms contract

`TextInput` takes the whole contract `bindFormField` produces: `disabled` and `readOnly` turn
`editable` off (`disabled` also sets the announced accessibility state); `invalid` and `touched`
become `data-invalid` and `data-touched` for stylesheets; `onTouched` fires on native blur. The
bound `ref` lets `form.submit()` focus the first invalid field. Validators are `formRequired`,
`formMinLength`, `formMaxLength`, `formPattern`, `formEmail`, or any function returning a
`FormError`.

```css
.field {
  border-width: 1px;
  border-color: #3a3a42;
}
.field[data-invalid][data-touched] {
  border-color: #ff6b6b;
}
```

Pairing `data-invalid` with `data-touched` keeps untouched fields from looking broken.

## Controlled, as in React Native

With `value`, the field shows your state. A keystroke calls `onValueChange` and `onChangeText`; the
field then shows whatever your state holds. Accept, refuse or rewrite the text:

```tsx
// Digits only: anything else leaves the field as it was.
<TextInput value={pin()} onChangeText={(text) => isDigits(text) && setPin(text)} />

// Shows what is typed in capitals, as it is typed.
<TextInput value={code()} onChangeText={(text) => setCode(text.toUpperCase())} />
```

Accepted text is already on screen, so nothing is sent back. A refused or rewritten keystroke
leaves native showing text your state lacks, with no prop change to correct it, so after the next
commit `TextInput` compares `value` with native's text and, if they differ, sends React Native's
`setTextAndSelection`. A value set from code after typing goes the same way.

A defined `value` at creation makes the field controlled for good, so `value` with no change
handler cannot be typed into, as in React Native. Decide synchronously in the handler: a value
arriving after the commit is first treated as a refusal, then applied. Leave `value` undefined
(optionally with `defaultValue`) for an uncontrolled field. Form bindings are controlled but accept
every value, so nothing is sent back.

The command carries React Native's typing counter: native tags each change, the component echoes
the latest, and native ignores older ones, so fast typing never drops characters. Apps never manage
this; it makes binding `value` to a signal safe. `Switch`
([switch page](/packages/components/switch)) is controlled the same way.

## Keyboards and behavior

`keyboardType` picks the keyboard (`'email-address'`, `'number-pad'`, `'phone-pad'`, ...);
`returnKeyType` labels the return key and `submitBehavior` sets what it does (`'submit'`,
`'blurAndSubmit'`, or `'newline'`, the multiline default). `multiline`, `secureTextEntry`,
`autoCapitalize` and `autoCorrect` work as usual; `maxLength` is enforced natively, with no flicker.

The `ref` callback receives a `TextInputRef` with `focus()`, `blur()`, `clear()`,
`setSelection(start, end?)` and `isFocused()`. `onChangeText` gets the new string; `onChange`,
`onFocus`, `onBlur`, `onSubmitEditing`, `onEndEditing`, `onSelectionChange`, `onKeyPress`,
`onContentSizeChange` and `onScroll` get raw native events.

<!-- api: TextInput -->

## Props a browser has no name for

`textContentType` and `autoComplete` hint at autofill (passwords, one-time codes) with
platform-specific values; common web names given to `autoComplete` are translated. iOS only:
`passwordRules` constrains generated passwords; `dataDetectorTypes` makes links and phone numbers
tappable when `multiline` and not `editable`; `keyboardAppearance` sets the keyboard's light or dark
look. `showSoftInputOnFocus` lets a field take focus (for a caret and custom picker) without the
system keyboard.

## Input accessory view

`InputAccessoryView` docks a bar above the keyboard on iOS. Give it a `nativeID` and the input the
same string as `inputAccessoryViewID`. On Android it is a plain view and its content sits inert.

<!-- api: InputAccessoryView -->
