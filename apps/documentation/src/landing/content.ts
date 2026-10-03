/**
 * Every fact the landing page states, in one place.
 *
 * The page's sections are choreography; this file is the claims. A version, a command or a
 * capability changes here and nowhere else, so the copy cannot drift out of step with the
 * project the way prose scattered through templates does. Each entry was checked against the
 * repository when it was written - see the comment beside anything that was not.
 */
import { GITHUB_REPO, GITHUB_SPONSORS, SITE_NAME } from '../site.ts';

export const LINKS = {
  getStarted: '/guide/getting-started',
  docs: '/guide/getting-started',
  learn: '/learn',
  architecture: '/guide/architecture',
  limitations: '/guide/limitations',
  css: '/packages/fabric/css-engine',
  supportedCss: '/packages/fabric/supported-css',
  tailwind: '/packages/tailwind',
  router: '/packages/router',
  web: '/packages/web',
  testing: '/packages/testing',
  forms: '/guide/forms',
  expo: '/packages/expo',
  devLoop: '/guide/getting-started',
  expoModules: '/packages/expo/using-a-module',
  github: GITHUB_REPO,
  examples: '/examples',
  releases: `${GITHUB_REPO}/releases`,
  issues: `${GITHUB_REPO}/issues`,
  license: `${GITHUB_REPO}/blob/main/LICENSE`,
  sponsor: '/sponsor',
  sponsors: GITHUB_SPONSORS,
} as const;

/** The whole setup, as `guide/getting-started.md` gives it. */
export const CREATE_COMMAND = 'npx create-expo-app@latest my-app --template @solid-native/template';

/** The versions the alpha is built and verified against: `template/package.json` and the workspace's pins. */
export const STATUS = {
  stage: 'Alpha',
  solid: '1.9',
  expo: 'SDK 57',
  reactNative: '0.86',
  platforms: ['iOS', 'Android', 'Web'],
  license: 'MIT',
} as const;

/**
 * The landmark features, in the order the contents list shows them. `section` is the anchor
 * further down the page where it is shown working; a feature with no section of its own links
 * straight to `docs`.
 */
export const LANDMARKS: readonly {
  readonly title: string;
  readonly body: string;
  readonly section?: string;
  readonly docs: string;
}[] = [
  {
    title: 'Real native views',
    body: "Solid's universal renderer drawing UIView and android.view.View through Expo. No web view.",
    docs: '/guide/architecture',
  },
  {
    title: 'A real CSS engine',
    body: 'Selectors, the cascade, custom properties, media queries and transitions, compiled at build time.',
    section: 'css',
    docs: '/packages/fabric/css-engine',
  },
  {
    title: 'Tailwind CSS v4',
    body: 'Your Tailwind classes, plus ios:, android: and dark: variants.',
    section: 'tailwind',
    docs: '/packages/tailwind',
  },
  {
    title: 'Native navigation',
    body: 'A Solid router on native stacks, tabs and headers, with deep links and Android back.',
    section: 'navigation',
    docs: '/packages/router',
  },
  {
    title: 'A clean reload on save',
    body: 'Edits reload the app on the device, with every root disposed first.',
    section: 'hot-reload',
    docs: '/guide/getting-started',
  },
  {
    title: 'Native forms',
    body: 'createForm, bound to native text fields and switches, and validated as you type.',
    docs: '/guide/forms',
  },
  {
    title: 'Lists that scale',
    body: 'Virtual and section lists render visible rows and a surrounding buffer.',
    docs: '/packages/components/lists',
  },
  {
    title: 'SVG icons',
    body: 'Lucide or any SVG icon set, drawn as native vectors.',
    docs: '/packages/icons',
  },
  {
    title: 'Animation',
    body: 'Transitions, @keyframes, Presence for enter and leave, and Reanimated worklets.',
    docs: '/packages/components/animation',
  },
  {
    title: 'Device services as signals',
    body: 'Screen, theme, keyboard, safe areas, app state and accessibility settings, as signals.',
    docs: '/packages/device',
  },
  {
    title: 'Tests without a simulator',
    body: 'Render in Node, against a fake native layer. The starter app includes one.',
    section: 'testing',
    docs: '/packages/testing',
  },
  {
    title: 'End-to-end with Maestro',
    body: 'Maestro flows drive the real app through its accessibility tree.',
    docs: '/packages/testing/end-to-end',
  },
  {
    title: 'The same components on the web',
    body: 'Render them in a browser, or as islands in a Solid web app you already have.',
    docs: '/packages/web/islands',
  },
  {
    title: 'Ready for coding agents',
    body: 'New apps ship an AGENTS.md, and the docs are published as llms.txt.',
    docs: '/guide/ai-assistants',
  },
  {
    title: 'Built on Expo',
    body: "Expo Go, EAS, release builds, and Expo's modules as Solid services.",
    section: 'expo',
    docs: '/packages/expo',
  },
];

/** Expo modules as Solid services: what each is for, and the drawing on its card. */
export const EXPO_APIS = [
  {
    name: 'Haptics',
    body: 'The Taptic Engine and Android vibration.',
    glyph: 'haptics',
  },
  {
    name: 'Secure storage',
    body: 'The keychain and Android keystore, bound to a signal.',
    glyph: 'secure-storage',
  },
  {
    name: 'Notifications',
    body: 'Permissions, local notifications and the badge.',
    glyph: 'notifications',
  },
  {
    name: 'Over-the-air updates',
    body: 'Check for, download and apply EAS updates.',
    glyph: 'updates',
  },
  {
    name: 'File system',
    body: "Read and write files in the app's sandbox.",
    glyph: 'file-system',
  },
  {
    name: 'Network',
    body: 'Whether the device is online, as a signal.',
    glyph: 'network',
  },
  {
    name: 'Camera and photos',
    body: 'Pick from the library, shoot with the system camera, or capture from your own view.',
    glyph: 'camera',
  },
  {
    name: 'Location',
    body: 'Where the device is, as a signal that follows it until you stop.',
    glyph: 'location',
  },
  {
    name: 'Face ID and fingerprint',
    body: 'The system prompt, and which kind of biometrics the device has.',
    glyph: 'biometrics',
  },
  {
    name: 'Sign-in',
    body: "OAuth in the system's own browser session, redirected back to your app.",
    glyph: 'sign-in',
  },
  {
    name: 'Video and audio',
    body: 'Native players, released when the component that made them goes.',
    glyph: 'media',
  },
  {
    name: 'SQLite',
    body: 'A database on the device, opened on first use and migrated before any query.',
    glyph: 'database',
  },
] as const;

/** The conventional independence note: who the project is not, and whose marks it names. */
export const INDEPENDENCE_NOTE = `${SITE_NAME} is an independent open-source project, not affiliated with or endorsed by the Solid team or Expo. Expo is a trademark of 650 Industries, Inc.`;
