/**
 * The example apps: whole apps in `examples/`, each with a gallery card and a page of its own.
 *
 * An entry here is what lists an app on the site, so an app is not shown until its folder exists
 * and it has an entry. Adding one is an entry below and its screenshots under
 * `public/examples/<slug>/`, named `<screen>-<ios|android>-<light|dark>.webp` and 560 wide, taken
 * from the simulator or emulator as `landing/README.md` describes; the code browser reads the files out of `sourceRoot` at build time
 * (see `build/example-sources.ts`), so nothing else needs listing.
 *
 * Plain data with no Solid in it, because `build/prerender.ts` and `build/example-sources.ts`
 * read it in Node too. `examples/canary` is a test harness, not an example, and never goes here.
 */
import type { DevicePlatform } from '../landing/phone.tsx';

/** One thing the app shows, as a chip on its card and a line on its page. */
export interface ExampleFeature {
  /** The chip: a word or two. */
  readonly label: string;
  /** The line on the app's page: where in the app, and what it does. */
  readonly detail: string;
  /** The docs page that explains it. */
  readonly docs: string;
}

export interface ExampleScreenshot {
  /** A path under `public/`, as the site serves it. */
  readonly src: string;
  readonly platform: DevicePlatform;
  readonly scheme: 'light' | 'dark';
  /** Which screen it is, for its alt text and its caption. */
  readonly screen: string;
}

export interface ExampleApp {
  /** Its folder's name, and its URL: `/examples/<slug>`. */
  readonly slug: string;
  readonly title: string;
  /** One line, for the gallery card. */
  readonly pitch: string;
  /** A short paragraph, for the top of its own page. */
  readonly summary: string;
  /** The folder in the repository, from its root. */
  readonly sourceRoot: string;
  /** The file the code browser opens on, relative to `sourceRoot`. */
  readonly entry: string;
  readonly features: readonly ExampleFeature[];
  /** The first is the gallery card's. */
  readonly screenshots: readonly ExampleScreenshot[];
}

export const EXAMPLE_APPS: readonly ExampleApp[] = [
  {
    slug: 'wallet',
    title: 'Wallet',
    pitch: 'A banking app with native tabs, a searchable payment list and a money transfer form.',
    summary:
      "Five screens of a small banking app: a balance card, a week of spending, a few hundred payments to search through and a form to send money. Every screen is a native screen with the platform's own tab bar, header and transitions.",
    sourceRoot: 'examples/wallet',
    entry: 'src/app/home/home.solid.tsx',
    features: [
      {
        label: 'Router',
        detail:
          "@solidnative/router/solid on a native stack: a payment's id arrives through useRoute().",
        docs: '/packages/router/screens',
      },
      {
        label: 'Native tabs',
        detail: 'A UITabBarController on iOS and a bottom navigation bar on Android.',
        docs: '/packages/router/tabs',
      },
      {
        label: 'Native header',
        detail: "Activity's large title, with a search bar in the navigation bar.",
        docs: '/packages/router/header',
      },
      {
        label: 'Virtual list',
        detail: 'A few hundred payments, with only the rows on screen rendered.',
        docs: '/packages/components/lists',
      },
      {
        label: 'Forms',
        detail: 'Send money validates native text fields with createForm as you type.',
        docs: '/guide/forms',
      },
      {
        label: 'Tailwind',
        detail: 'Home is styled with Tailwind classes, gradient and dark mode included.',
        docs: '/packages/tailwind',
      },
      {
        label: 'Platform variants',
        detail: "Settings uses ios: and android: to follow each platform's own layout.",
        docs: '/packages/tailwind/variants',
      },
      {
        label: 'Secure storage',
        detail: 'Hiding the balance is remembered in the keychain or keystore.',
        docs: '/packages/expo/storage',
      },
      {
        label: 'Haptics',
        detail: 'Send money answers a quick amount, an error and a sent payment with haptics.',
        docs: '/packages/expo/haptics',
      },
    ],
    screenshots: [
      {
        src: '/examples/wallet/home-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Home',
      },
      {
        src: '/examples/wallet/activity-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Activity',
      },
      {
        src: '/examples/wallet/send-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Send money',
      },
      {
        src: '/examples/wallet/home-ios-dark.webp',
        platform: 'ios',
        scheme: 'dark',
        screen: 'Home',
      },
      {
        src: '/examples/wallet/settings-ios-dark.webp',
        platform: 'ios',
        scheme: 'dark',
        screen: 'Settings',
      },
    ],
  },
  {
    slug: 'habits',
    title: 'Habits',
    pitch: 'A habit tracker with a native tab bar, SQLite history and a daily reminder.',
    summary:
      'A small habit tracker: a checklist for today with a check-off and a long press to undo, a streak and a calendar grid for each habit, a native form to add one, and a daily local reminder. Habits and their history live in SQLite, seeded with a couple of months on first launch.',
    sourceRoot: 'examples/habits',
    entry: 'src/app/today/today.solid.tsx',
    features: [
      {
        label: 'Native tabs',
        detail: 'Today and Settings, each a UITabBarController tab with a stack of its own.',
        docs: '/packages/router/tabs',
      },
      {
        label: 'Native stack',
        detail: 'A habit pushes onto the stack with a native header and back button.',
        docs: '/packages/router/screens',
      },
      {
        label: 'Native header',
        detail: "Today's large title, with a + button for a new habit.",
        docs: '/packages/router/header',
      },
      {
        label: 'Database',
        detail: 'Habits and their completions persist through SQLite, opened on first use.',
        docs: '/packages/expo/database',
      },
      {
        label: 'Notifications',
        detail: 'A daily local reminder per habit, with the denied state handled in Settings.',
        docs: '/packages/expo/notifications',
      },
      {
        label: 'Haptics',
        detail: 'A haptic on every completion, undo and saved habit.',
        docs: '/packages/expo/haptics',
      },
      {
        label: 'Forms',
        detail: 'The new habit form validates a required, unique name as you type.',
        docs: '/guide/forms',
      },
      {
        label: 'Icons',
        detail:
          'Lucide icons through @solidnative/icons, drawn as native shapes for the checkmark, flame and more.',
        docs: '/packages/icons',
      },
      {
        label: 'Dialogs',
        detail: "Deleting a habit asks first, with the platform's own confirm dialog.",
        docs: '/packages/device/dialogs',
      },
    ],
    screenshots: [
      {
        src: '/examples/habits/today-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Today',
      },
      {
        src: '/examples/habits/habit-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Habit',
      },
      {
        src: '/examples/habits/new-habit-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'New habit',
      },
      {
        src: '/examples/habits/today-ios-dark.webp',
        platform: 'ios',
        scheme: 'dark',
        screen: 'Today',
      },
      {
        src: '/examples/habits/settings-ios-dark.webp',
        platform: 'ios',
        scheme: 'dark',
        screen: 'Settings',
      },
    ],
  },
  {
    slug: 'music',
    title: 'Music',
    pitch:
      'A music player with real audio playback, a mini player and a full-screen Now Playing sheet.',
    summary:
      'Albums in a horizontal row above a searchable song library, a pushed album screen with a play-all button, and a mini player that docks above the tab bar and opens into a full-screen player with a real seek slider.',
    sourceRoot: 'examples/music',
    entry: 'src/app/library/library.solid.tsx',
    features: [
      {
        label: 'Player',
        detail: 'audioPlayer() drives real playback, released automatically when a screen goes.',
        docs: '/packages/expo/player',
      },
      {
        label: 'Native tabs',
        detail: 'A UITabBarController on iOS and a bottom navigation bar on Android.',
        docs: '/packages/router/tabs',
      },
      {
        label: 'Screens and navigation',
        detail: 'Album pushes onto the library stack; Now Playing presents as a sheet.',
        docs: '/packages/router/screens',
      },
      {
        label: 'Virtual list',
        detail: "Every song, with the albums row riding as the list's own listHeader.",
        docs: '/packages/components/lists',
      },
      {
        label: 'Native header',
        detail: "The library's large title, with a search bar in the navigation bar.",
        docs: '/packages/router/header',
      },
      {
        label: 'Expo UI',
        detail: 'The seek bar in Now Playing is a real SwiftUI/Compose slider, not a drawn one.',
        docs: '/packages/expo/expo-ui',
      },
      {
        label: 'Keep awake',
        detail: 'The screen stays on while a track plays, and lets go the moment it stops.',
        docs: '/packages/expo/keep-awake',
      },
      {
        label: 'Color scheme',
        detail: "Now Playing's icons follow light and dark mode, not just its stylesheet.",
        docs: '/packages/device/color-scheme',
      },
    ],
    screenshots: [
      {
        src: '/examples/music/library-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Library',
      },
      {
        src: '/examples/music/album-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Album',
      },
      {
        src: '/examples/music/now-playing-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Now playing',
      },
      {
        src: '/examples/music/library-ios-dark.webp',
        platform: 'ios',
        scheme: 'dark',
        screen: 'Library',
      },
      {
        src: '/examples/music/now-playing-ios-dark.webp',
        platform: 'ios',
        scheme: 'dark',
        screen: 'Now playing',
      },
    ],
  },
  {
    slug: 'runs',
    title: 'Runs',
    pitch: 'A run tracker with a live map, GPS tracking, splits and a GPX export.',
    summary:
      'A small run tracker: a live map that follows the route as it is recorded, big numbers for time, distance and pace, a history of past runs, and a detail screen with per-kilometre splits and a GPX export shared through the system share sheet. A simulated route stands in for the GPS in development and in the screenshots below.',
    sourceRoot: 'examples/runs',
    entry: 'src/app/run/run.solid.tsx',
    features: [
      {
        label: 'Maps',
        detail: "The Run and detail screens draw the route as a live polyline on Apple's map.",
        docs: '/packages/expo/maps',
      },
      {
        label: 'Location',
        detail: 'Distance, pace and splits are all worked out from a position signal.',
        docs: '/packages/expo/location',
      },
      {
        label: 'Permissions',
        detail: 'Location access is asked for on the Run screen, with a denied state handled.',
        docs: '/packages/expo/permissions',
      },
      {
        label: 'Keep awake',
        detail: 'The screen stays on for as long as a run is recording, and no longer.',
        docs: '/packages/expo/keep-awake',
      },
      {
        label: 'File system',
        detail: 'A finished run is written to a GPX file before it is shared.',
        docs: '/packages/expo/file-system',
      },
      {
        label: 'Sharing',
        detail: "A run's GPX export opens the system share sheet.",
        docs: '/packages/device/sharing',
      },
      {
        label: 'Storage',
        detail: 'Kilometres or miles is remembered between launches.',
        docs: '/packages/expo/storage',
      },
      {
        label: 'Native tabs',
        detail: 'Run, History and Settings, each a UITabBarController tab.',
        docs: '/packages/router/tabs',
      },
      {
        label: 'Native stack',
        detail: 'A run pushes onto the stack with its own native header and back button.',
        docs: '/packages/router/screens',
      },
      {
        label: 'Icons',
        detail:
          'Lucide icons through @solidnative/icons, drawn as native shapes for every icon in the app.',
        docs: '/packages/icons',
      },
    ],
    screenshots: [
      {
        src: '/examples/runs/run-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Run',
      },
      {
        src: '/examples/runs/history-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'History',
      },
      {
        src: '/examples/runs/run-detail-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Run detail',
      },
      {
        src: '/examples/runs/run-ios-dark.webp',
        platform: 'ios',
        scheme: 'dark',
        screen: 'Run',
      },
      {
        src: '/examples/runs/settings-ios-dark.webp',
        platform: 'ios',
        scheme: 'dark',
        screen: 'Settings',
      },
    ],
  },
  {
    slug: 'notes',
    title: 'Notes',
    pitch: 'An offline-first notes app: write while offline, and it syncs once you are back.',
    summary:
      'A searchable list of notes, pinned ones first, with a sync status that reads synced, a ' +
      'count of what is still pending, or offline. Writes go through a queue in SQLite, flushed ' +
      'in order against a small in-process fake server with latency and the odd failure, so the ' +
      'offline pattern is something the app actually has to handle rather than something to ' +
      'imagine.',
    sourceRoot: 'examples/notes',
    entry: 'src/app/notes/notes-list.solid.tsx',
    features: [
      {
        label: 'Offline sync',
        detail:
          'A write queue ordered by seq, a serialized flush, and a merge that keeps pending notes.',
        docs: '/guide/offline',
      },
      {
        label: 'Database',
        detail: 'Notes and the write queue persist through SQLite, opened on first use.',
        docs: '/packages/expo/database',
      },
      {
        label: 'Network',
        detail: 'The sync status pill reads connected, not reachable, straight from the guide.',
        docs: '/packages/expo/network',
      },
      {
        label: 'Native tabs',
        detail: 'Notes and Settings, each a UITabBarController tab with a stack of its own.',
        docs: '/packages/router/tabs',
      },
      {
        label: 'Native header',
        detail: "The list's large title, with a search bar in the navigation bar.",
        docs: '/packages/router/header',
      },
      {
        label: 'Keyboard avoiding',
        detail: 'The editor keeps the text fields clear of the keyboard while typing.',
        docs: '/packages/components/keyboard-avoiding-view',
      },
      {
        label: 'Storage',
        detail: 'The last-synced time and the sync toggle persist between launches.',
        docs: '/packages/expo/storage',
      },
      {
        label: 'Dialogs',
        detail:
          "Deleting a note and clearing local data both ask first, with the platform's own confirm.",
        docs: '/packages/device/dialogs',
      },
      {
        label: 'Icons',
        detail:
          'Lucide icons through @solidnative/icons, drawn as native shapes for the pin, the sync status and more.',
        docs: '/packages/icons',
      },
    ],
    screenshots: [
      {
        src: '/examples/notes/notes-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Notes',
      },
      {
        src: '/examples/notes/note-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Note',
      },
      {
        src: '/examples/notes/settings-ios-light.webp',
        platform: 'ios',
        scheme: 'light',
        screen: 'Settings',
      },
      {
        src: '/examples/notes/notes-ios-dark.webp',
        platform: 'ios',
        scheme: 'dark',
        screen: 'Notes',
      },
      {
        src: '/examples/notes/settings-ios-dark.webp',
        platform: 'ios',
        scheme: 'dark',
        screen: 'Settings',
      },
    ],
  },
];

export function exampleApp(slug: string): ExampleApp | undefined {
  return EXAMPLE_APPS.find((app) => app.slug === slug);
}
