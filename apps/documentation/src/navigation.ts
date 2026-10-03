/**
 * The sidebar, written out rather than derived from the files on disk.
 *
 * Deriving it would mean loading every page's front matter to draw a list of links, and it would
 * put the order of the site in the order of the filenames. This is the one place that says what
 * the site is and in what sequence it should be read, which is worth being able to see in one
 * screen.
 *
 * `summary` is the one-line note under a package's name in the sidebar. It says what the package
 * is for, not how to use it - that is the overview page it links to.
 */
export interface NavItem {
  readonly path: string;
  readonly title: string;
  readonly summary?: string;
  /**
   * The pages beneath this one, shown indented under it in the sidebar.
   *
   * One level only, and deliberately. A package is a group of pages and each page answers one
   * question; a third level would be a page that needs its own table of contents, which is the
   * signal to split it rather than to nest it.
   */
  readonly children?: readonly NavItem[];
  /**
   * A label shown above this child in the sidebar, where a package's pages fall into groups.
   * Not a page and not a level: the pages stay one list, the label only says where a run starts.
   */
  readonly group?: string;
  /**
   * True for a page that is reachable from its parent - in the sidebar, in prose, and still
   * prerendered and in the sitemap like any other page - but is not the next step after it. The
   * "Next" pager in `doc-page.ts` skips a branch when choosing what comes after the page before
   * it; `flattenItems` and `READING_ORDER` do not, so a branch is still found by everything that
   * needs every page, prerendering included. [Adding it to an existing app](/guide/manual-setup)
   * is the case this exists for: reachable from [Getting started](/guide/getting-started), which
   * is written for the template, but the wrong thing to send a reader to next.
   */
  readonly branch?: boolean;
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

/**
 * Pages that are on the site but not in the sidebar, reached from the header and footer instead.
 * Listed so they are prerendered and in the sitemap like every other page.
 */
export const STANDALONE_PAGES: readonly NavItem[] = [{ path: 'sponsor', title: 'Sponsor' }];

/** Every page in a section, parents and children alike, in reading order. */
export function flattenItems(items: readonly NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...flattenItems(item.children ?? [])]);
}

/**
 * The beginner route, in the order the work happens: install, style the first screen, build
 * something with it, then ship it. How the renderer works, how it compares and where it stops are
 * in `CONCEPTS`, because a reader who has not yet run the app has no use for them.
 *
 * "Existing apps" is a `branch` of "Getting started" rather than the page after it:
 * it is where a reader with an Expo app already lands, not the next step for one who just ran the
 * template. See `NavItem.branch`.
 */
export const GUIDE: NavSection = {
  title: 'Guide',
  items: [
    {
      path: 'guide/getting-started',
      title: 'Getting started',
      children: [{ path: 'guide/manual-setup', title: 'Existing apps', branch: true }],
    },
    // Where a reader still deciding looks first, but not the next step for one who has just run it.
    { path: 'guide/comparison', title: 'How it compares', branch: true },
    { path: 'guide/theming', title: 'Theming and Tailwind' },
    { path: 'guide/forms', title: 'Build a form' },
    { path: 'guide/offline', title: 'Working offline' },
    {
      path: 'guide/localization',
      title: 'Localization',
      children: [
        { path: 'guide/localization-extraction', title: 'Extracting messages' },
        { path: 'guide/localization-loading', title: 'Loading a language' },
        { path: 'guide/localization-switching', title: 'Switching language' },
        { path: 'guide/localization-formatting', title: 'Formatting and RTL' },
      ],
    },
    { path: 'guide/deployment', title: 'Deployment' },
  ],
};

/** The background rather than the tasks: how it works, where it stops, and working with AI. */
export const CONCEPTS: NavSection = {
  title: 'Concepts',
  items: [
    { path: 'guide/architecture', title: 'Architecture' },
    { path: 'guide/native-and-web', title: 'Native and web' },
    { path: 'guide/limitations', title: 'Known limitations' },
    { path: 'guide/ai-assistants', title: 'AI' },
  ],
};

/**
 * One group per published package, each a short overview with pages beneath it.
 *
 * The overview says what the package is for, when you reach for it, and shows the smallest thing
 * that works. Everything else is a page of its own, because a page that answers one question can
 * be read in a couple of minutes and linked to directly, and a page that answers eight is one
 * nobody finishes.
 *
 * Ordered so that reading top to bottom answers the questions a reader building a screen has
 * first - the elements, navigation, the device and Expo's modules, testing what you built - before
 * the packages behind the scenes that make them work: the platform bootstrap, the Fabric renderer
 * and the Metro integration. Those still get their own pages; a reader who wants them is looking
 * for them by name, not browsing into them by accident.
 */
export const PACKAGES: NavSection = {
  title: 'Packages',
  items: [
    {
      path: 'packages/components',
      title: 'Components',
      summary: "React Native's own elements, as Solid components",
      children: [
        { path: 'packages/components/layout', title: 'Layout and views', group: 'Layout' },
        { path: 'packages/components/safe-area', title: 'Safe area' },
        { path: 'packages/components/scroll-view', title: 'Scroll view' },
        { path: 'packages/components/keyboard-avoiding-view', title: 'Keyboard-avoiding view' },
        { path: 'packages/components/lists', title: 'Lists' },
        { path: 'packages/components/text', title: 'Text', group: 'Content' },
        { path: 'packages/components/image', title: 'Image' },
        { path: 'packages/components/activity-indicator', title: 'Activity indicator' },
        { path: 'packages/components/input', title: 'Text input', group: 'Input' },
        { path: 'packages/components/switch', title: 'Switch' },
        { path: 'packages/components/pressable', title: 'Pressable' },
        { path: 'packages/components/gestures', title: 'Gestures' },
        { path: 'packages/components/modal', title: 'Modal', group: 'Presentation' },
        { path: 'packages/components/animation', title: 'Animation' },
      ],
    },
    {
      path: 'packages/router',
      title: 'Router',
      summary: 'A Solid router driving real native screen transitions',
      children: [
        { path: 'packages/router/screens', title: 'Screens and navigation' },
        { path: 'packages/router/header', title: 'The native header' },
        { path: 'packages/router/tabs', title: 'Tabs' },
      ],
    },
    {
      path: 'packages/device',
      title: 'Device',
      summary: "The screen, the color scheme, and the rest of the host's answers",
      children: [
        { path: 'packages/device/screen', title: 'Screen', group: 'Screen' },
        { path: 'packages/device/safe-area', title: 'Safe area' },
        { path: 'packages/device/color-scheme', title: 'Color scheme', group: 'Appearance' },
        { path: 'packages/device/accessibility', title: 'Accessibility' },
        { path: 'packages/device/direction', title: 'Direction' },
        { path: 'packages/device/status-bar', title: 'Status bar', group: 'System' },
        { path: 'packages/device/keyboard', title: 'Keyboard' },
        { path: 'packages/device/hardware-back', title: 'Hardware back' },
        { path: 'packages/device/app-state', title: 'App state' },
        { path: 'packages/device/deep-links', title: 'Deep links' },
        { path: 'packages/device/android-permissions', title: 'Android permissions' },
        { path: 'packages/device/layout-animation', title: 'Layout animation' },
        { path: 'packages/device/dialogs', title: 'Dialogs', group: 'Feedback' },
        { path: 'packages/device/sharing', title: 'Sharing' },
        { path: 'packages/device/vibration', title: 'Vibration' },
        { path: 'packages/device/dev-menu', title: 'Dev menu', group: 'Development' },
      ],
    },
    {
      path: 'packages/expo',
      title: 'Expo',
      summary: "Expo's native modules, as Solid services",
      children: [
        { path: 'packages/expo/using-a-module', title: 'Using a module', group: 'Basics' },
        { path: 'packages/expo/permissions', title: 'Permissions' },
        { path: 'packages/expo/battery', title: 'Battery', group: 'Device state' },
        { path: 'packages/expo/brightness', title: 'Brightness' },
        { path: 'packages/expo/network', title: 'Network' },
        { path: 'packages/expo/orientation', title: 'Device orientation' },
        { path: 'packages/expo/locale', title: 'Locale' },
        { path: 'packages/expo/sensors', title: 'Sensors' },
        { path: 'packages/expo/keep-awake', title: 'Keep awake' },
        { path: 'packages/expo/app-info', title: 'App info' },
        { path: 'packages/expo/haptics', title: 'Haptics', group: 'Feedback' },
        { path: 'packages/expo/clipboard', title: 'Clipboard' },
        { path: 'packages/expo/notifications', title: 'Notifications' },
        { path: 'packages/expo/store-review', title: 'Store review' },
        { path: 'packages/expo/storage', title: 'Storage', group: 'Storage and files' },
        { path: 'packages/expo/file-system', title: 'File system' },
        { path: 'packages/expo/database', title: 'Database' },
        { path: 'packages/expo/assets', title: 'Assets' },
        { path: 'packages/expo/image-picker', title: 'Image picker', group: 'Media and camera' },
        { path: 'packages/expo/document-picker', title: 'Document picker' },
        { path: 'packages/expo/image-editor', title: 'Image editor' },
        { path: 'packages/expo/media-library', title: 'Media library' },
        { path: 'packages/expo/camera', title: 'Camera' },
        { path: 'packages/expo/player', title: 'Video and audio player' },
        { path: 'packages/expo/location', title: 'Location', group: 'Location and identity' },
        { path: 'packages/expo/maps', title: 'Maps' },
        { path: 'packages/expo/biometrics', title: 'Biometrics' },
        { path: 'packages/expo/apple-sign-in', title: 'Sign in with Apple' },
        { path: 'packages/expo/tracking', title: 'Tracking' },
        { path: 'packages/expo/crypto', title: 'Crypto' },
        { path: 'packages/expo/screen-capture', title: 'Screen capture' },
        { path: 'packages/expo/browser', title: 'Browser' },
        { path: 'packages/expo/language-model', title: 'On-device AI', group: 'Intelligence' },
        { path: 'packages/expo/fonts', title: 'Fonts', group: 'App lifecycle' },
        { path: 'packages/expo/splash-screen', title: 'Splash screen' },
        { path: 'packages/expo/updates', title: 'Updates' },
        { path: 'packages/expo/background-task', title: 'Background task' },
        { path: 'packages/expo/native-views', title: 'Native views', group: 'Native views' },
        { path: 'packages/expo/expo-ui', title: 'Expo UI' },
        { path: 'packages/expo/dom-components', title: 'DOM components', group: 'Web interop' },
      ],
    },
    {
      path: 'packages/testing',
      title: 'Testing',
      summary: 'Testing Library for native components, with no device involved',
      children: [
        { path: 'packages/testing/setup', title: 'Setup' },
        { path: 'packages/testing/writing-a-test', title: 'Writing a test' },
        { path: 'packages/testing/testing-forms', title: 'Testing a form' },
        { path: 'packages/testing/testing-async', title: 'Testing async work' },
        { path: 'packages/testing/testing-services', title: 'Testing with services' },
        { path: 'packages/testing/testing-http', title: 'Testing HttpClient' },
        { path: 'packages/testing/testing-navigation', title: 'Testing the router' },
        { path: 'packages/testing/testing-styling', title: 'Testing styles' },
        { path: 'packages/testing/api', title: 'API reference' },
        { path: 'packages/testing/end-to-end', title: 'End-to-end tests' },
      ],
    },
    {
      path: 'packages/tailwind',
      title: 'Tailwind',
      summary: 'The presets, and the variants a touch device needs',
      children: [
        { path: 'packages/tailwind/variants', title: 'Variants' },
        { path: 'packages/tailwind/utilities', title: 'Safe area and hairlines' },
      ],
    },
    { path: 'packages/icons', title: 'Icons', summary: 'Icon sets, drawn as native SVG' },
    {
      path: 'packages/web',
      title: 'Web',
      summary: 'The same components in a browser, for previews and docs',
      children: [
        { path: 'packages/web/islands', title: 'Islands' },
        { path: 'packages/web/limits', title: 'Web limits' },
      ],
    },
    {
      path: 'packages/platform',
      title: 'Platform',
      summary: 'Bootstrapping a Solid application onto a device',
      children: [
        { path: 'packages/platform/bootstrapping', title: 'Bootstrapping' },
        { path: 'packages/platform/renderer', title: 'The renderer' },
      ],
    },
    {
      path: 'packages/fabric',
      title: 'Fabric',
      summary: 'The renderer, the CSS engine and the cascade behind them',
      children: [
        { path: 'packages/fabric/css-engine', title: 'The CSS engine' },
        { path: 'packages/fabric/supported-css', title: 'Supported CSS' },
        { path: 'packages/fabric/animation', title: 'Animations' },
      ],
    },
    {
      path: 'packages/metro',
      title: 'Metro',
      summary: 'The bundler integration, and what happens to CSS at build time',
      children: [{ path: 'packages/metro/configuration', title: 'Configuration' }],
    },
    {
      path: 'packages/nx',
      title: 'Nx',
      summary: 'nx add, and an app generator whose targets run Expo',
    },
  ],
};

export const SECTIONS: readonly NavSection[] = [GUIDE, CONCEPTS, PACKAGES];

/** The flat reading order, which is what the previous/next pager walks. */
export const READING_ORDER: readonly NavItem[] = SECTIONS.flatMap((section) =>
  flattenItems(section.items),
);

/** One step of a `BreadcrumbList`: a name, and a path if the step is itself a page. */
export interface Breadcrumb {
  readonly title: string;
  readonly path?: string;
}

/**
 * Home, its section and (for a child page) its parent, ending with the page itself - for
 * `seo.ts`'s structured data.
 *
 * Walked from `SECTIONS` rather than from `READING_ORDER`, because a breadcrumb needs to know
 * which group a page belongs to and `READING_ORDER` has already thrown that away by flattening
 * it. A path this site does not recognise (there should not be one; `doc-page` sends only paths
 * it just loaded a document for) gets no breadcrumbs rather than a guess.
 */
export function breadcrumbsFor(path: string): Breadcrumb[] {
  for (const section of SECTIONS) {
    for (const item of section.items) {
      if (item.path === path) {
        return [
          { title: 'Home', path: '/' },
          { title: section.title },
          { title: item.title, path: `/${item.path}` },
        ];
      }
      for (const child of item.children ?? []) {
        if (child.path === path) {
          return [
            { title: 'Home', path: '/' },
            { title: section.title },
            { title: item.title, path: `/${item.path}` },
            { title: child.title, path: `/${child.path}` },
          ];
        }
      }
    }
  }
  return [];
}
