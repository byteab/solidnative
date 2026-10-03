# Wallet

A small banking app built with solidnative and Solid: the example to read when you want to see what a
real app looks like, rather than one feature at a time.

| Screen                                                | What it shows                                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Home (`src/app/home/home.solid.tsx`)                  | Tailwind classes, a gradient, `createMemo()` values, a preference kept in the keychain with `SecureStorage`                         |
| Activity (`src/app/activity/activity.solid.tsx`)      | A tab with its own native stack, a large title, a search bar in the navigation bar, and a `<VirtualList>` of a few hundred payments |
| Payment (`src/app/payments/payment-detail.solid.tsx`) | A pushed screen that reads its route param through `useRoute()`                                                                     |
| Send money (`src/app/send/send.solid.tsx`)            | A validated form over native text fields, presented as a modal, styled with a scoped `.native.css`, with haptics on success         |
| Settings (`src/app/settings/settings.solid.tsx`)      | `ios:`, `android:` and `dark:` variants: one screen, each platform's own look                                                       |

The tab bar (`src/app/tabs.solid.tsx`) is a real `UITabBarController` on iOS and a bottom navigation bar on
Android, and every screen is a real native screen with the platform's own transitions.

## Run it

From the repository root, after `pnpm install`:

```sh
cd examples/wallet
pnpm start     # press i or a, or scan the QR code with Expo Go
pnpm test      # Solid tests in Node against a fake Fabric, no simulator
```

`solid-tests/app.test.ts` drives the whole app the way a person would: hides the balance, sends money,
searches the activity list. It runs in about a second, against a fake of the native side.
