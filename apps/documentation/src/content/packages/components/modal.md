---
title: Modal
summary: Modal, presented over everything else, shown and hidden with visible or Show.
art: modal
---

# Modal

`Modal` presents content over everything else, as `ModalHostView`.

```tsx
<Show when={showSettings()}>
  <Modal onRequestClose={() => setShowSettings(false)}>
    <Text>Settings</Text>
  </Modal>
</Show>
```

## Showing and hiding

`visible` (default `true`) shows and hides a modal that stays in the tree:

```tsx
<Modal visible={showSettings()} onRequestClose={() => setShowSettings(false)}>
  <Text>Settings</Text>
</Modal>
```

While hidden the native host leaves the tree, as in React Native, so the screen beneath takes
touches. On iOS it leaves after the dismissal animation, when `onDismiss` fires; on Android, at
once. `<Show>` (from `@solid-native/platform/solid`) also disposes the content while hidden.

## Transparency

`transparent` (default `false`) shows the screen behind, with no backdrop; otherwise
`backdropColor` sets it (default white). On iOS a transparent modal needs
`presentationStyle="overFullScreen"`, its default; any other style logs a warning. Otherwise
`presentationStyle` is `'fullScreen'`, `'pageSheet'` or `'formSheet'` on iOS.

## Other props

`animationType` is `'none'`, `'slide'` or `'fade'`. On iOS, `supportedOrientations` (default
portrait) limits rotation and `allowSwipeDismissal` lets a downward swipe dismiss via
`onRequestClose`. On Android, `statusBarTranslucent` draws under the status bar,
`navigationBarTranslucent` under the navigation bar too (requires `statusBarTranslucent`), and
`hardwareAccelerated` gives the window a hardware-accelerated surface.

## Events

`onRequestClose` fires for the Android back button or an iOS swipe-to-dismiss. `onShow`,
`onDismiss` and `onOrientationChange` are the others.

<!-- api: Modal -->
