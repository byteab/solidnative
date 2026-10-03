# Flock

A Twitter-style social app built with solid-native and Solid. Every control is the platform's own:
SwiftUI and UIKit on iOS, Material on Android.

| Screen                                                          | What it shows                                                                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Home (`src/app/home/home.solid.tsx`)                            | X-style underline feed tabs, photo avatars, pull to refresh, and a Liquid Glass compose button on iOS 26                   |
| Post row (`src/app/ui/post-row.solid.tsx`)                      | SF Symbols, haptics on like and repost, the native share sheet, and a SwiftUI `Menu` behind ⋯ (a native dialog on Android) |
| Compose (`src/app/compose/compose.solid.tsx`)                   | A form sheet with detents, a SwiftUI `Picker` for who can reply, and a SwiftUI `Gauge` as the character ring               |
| Explore (`src/app/explore/explore.solid.tsx`)                   | A native search field in the header, filtering people and posts as you type                                                |
| Notifications (`src/app/notifications/notifications.solid.tsx`) | A SwiftUI `List` with the system's swipe actions on iOS, and a tab bar badge that follows unread count                     |
| Profile (`src/app/profile/profile.solid.tsx`)                   | Pushed inside whichever tab opened it, with posts, replies and likes                                                       |
| Settings (`src/app/settings/settings.solid.tsx`)                | One SwiftUI `Form` on iOS (ColorPicker, Stepper, Toggles, Picker); Material switches and a Compose slider on Android       |

The accent color picked in Settings tints every header, tab bar and button live, and the text size
applies to every post as you change it.

## Run it

From the repository root, after `pnpm install`:

```sh
cd examples/flock
pnpm ios       # or: pnpm android
```

Flock needs a development build rather than Expo Go, for `expo-glass-effect` and `expo-symbols`.
`assets/generate-tabs.sh` draws the Android tab icons from Lucide; iOS uses SF Symbols.
