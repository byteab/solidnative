export interface Feature {
  readonly path: string;
  readonly title: string;
  readonly blurb: string;
}

/** The complete canary feature index, shared during the consumer migration. */
export const features: readonly Feature[] = [
  {
    path: '/feed',
    title: 'Feed',
    blurb: 'self-sizing posts, galleries, paging, refresh, optimistic likes',
  },
  {
    path: '/chat',
    title: 'Chat',
    blurb: 'inverted transcript, composer on the keyboard, retries, history',
  },
  {
    path: '/world',
    title: 'Everywhere',
    blurb:
      'plurals with six forms, right-to-left cards, hard scripts, a screen reader, reduced motion',
  },
  {
    path: '/notes',
    title: 'Notes',
    blurb: 'a block editor: markdown shortcuts, lists that carry on, a toolbar on the keyboard',
  },
  {
    path: '/stories',
    title: 'Stories',
    blurb: 'progress bars on keyframes that advance on animationend, hold to pause, swipe to close',
  },
  {
    path: '/shop',
    title: 'Shop',
    blurb: 'a product grid in CSS, sale prices struck through, sizes, a basket with steppers',
  },
  {
    path: '/settings',
    title: 'Settings',
    blurb: 'grouped rows, tiles, switches, search, an appearance picker that themes the whole app',
  },
  {
    path: '/wallet',
    title: 'Wallet',
    blurb:
      'a hero played by the scroll on the native side, staggered bars, money in four currencies',
  },
  {
    path: '/calendar',
    title: 'Calendar',
    blurb: 'a month grid, a day timeline placed by CSS arithmetic, events drawn by dragging',
  },
  {
    path: '/kanban',
    title: 'Kanban',
    blurb: 'columns side by side, cards dragged between them, themed by relative colours',
  },
  {
    path: '/ride',
    title: 'Ride',
    blurb: 'a live map under a sheet with detents, search in it, fares, a driver on the way',
  },
  {
    path: '/player',
    title: 'Player',
    blurb:
      'covers drawn in CSS, keyframe equalisers, a page-sheet player with a hand-made scrubber',
  },
  {
    path: '/browse',
    title: 'Browse',
    blurb: 'shelves of horizontal lists, pinned headings, jumps, pull to refresh',
  },
  {
    path: '/inbox',
    title: 'Mail',
    blurb: 'rows that swipe inside a list inside a pager, tap, press and hold',
  },
  {
    path: '/orders',
    title: 'Orders',
    blurb: 'live status polled while in view, switched and cancelled mid-request',
  },
  {
    path: '/field-notes',
    title: 'Field notes',
    blurb: 'offline first: an outbox that survives restarts, retries and conflicts',
  },
  {
    path: '/stress',
    title: 'Stress list',
    blurb: 'ten thousand rows with images, live prices, filtering, and a cost readout',
  },
  {
    path: '/overlays',
    title: 'Overlays',
    blurb: 'a toast and a loading cover above every screen and sheet',
  },
  {
    path: '/account',
    title: 'Account',
    blurb: 'sign in with a code, then a session that expires from inside a sheet',
  },
  {
    path: '/photos',
    title: 'Photo viewer',
    blurb: 'swipe between photos, pinch and double-tap to zoom, swipe down to close',
  },
  {
    path: '/queue',
    title: 'Queue',
    blurb: 'inserts, deletes, moves between sections, sorts, bursts of changes',
  },
  {
    path: '/search-demo',
    title: 'Search',
    blurb: 'native search bar, live and debounced search, recents, scopes',
  },
  {
    path: '/projects',
    title: 'Task manager',
    blurb: 'master-detail editing, sheets, deep stacks, deep links',
  },
  {
    path: '/keyboard',
    title: 'Keyboard lab',
    blurb: 'bottom fields, carousels, keyboard types, a dock, a sheet',
  },
  {
    path: '/application',
    title: 'Application form',
    blurb: 'twenty-odd fields, pickers, async checks, rules between fields',
  },
  { path: '/primitives', title: 'Primitives', blurb: 'switch, text input, image, spinner' },
  {
    path: '/components',
    title: 'Components',
    blurb: 'presses, a refused switch, input events, modal events',
  },
  { path: '/text', title: 'Text nesting', blurb: 'spans, inheritance, baselines' },
  { path: '/css', title: 'CSS', blurb: 'selectors, specificity, cascade, inheritance' },
  { path: '/tailwind', title: 'Tailwind', blurb: 'utilities that combine, as Chrome draws them' },
  { path: '/layout', title: 'Layout', blurb: 'flexbox through Yoga, and its native defaults' },
  { path: '/typography', title: 'Typography', blurb: 'real text nodes, nesting, truncation' },
  { path: '/surfaces', title: 'Surfaces', blurb: 'borders, corners, shadows, transforms' },
  { path: '/scrolling', title: 'Scrolling', blurb: 'horizontal, paging, offsets, under load' },
  { path: '/verify', title: 'Verify', blurb: 'the features that fail silently, shown on screen' },
  {
    path: '/css-engine',
    title: 'CSS engine',
    blurb: 'units, tokens, media queries, transitions, keyframes',
  },
  {
    path: '/expo-ui',
    title: 'SwiftUI controls',
    blurb: '@expo/ui views, driven by the engine rather than React',
  },
  {
    path: '/native-views',
    title: 'Native views',
    blurb: 'Liquid Glass, SF Symbols and Sign in with Apple',
  },
  { path: '/forms', title: 'Signal forms', blurb: 'binding and validation over native controls' },
  { path: '/gestures', title: 'Gestures', blurb: 'responder system, capture, scroll blocking' },
  { path: '/list', title: 'Virtual list', blurb: '1000 rows, mixed heights, commit stats' },
  { path: '/modal', title: 'Modal', blurb: 'native presentation' },
  {
    path: '/regressions',
    title: 'Stress regressions',
    blurb: 'headers, same-route pushes, modals, failing pages, text size',
  },
  {
    path: '/navigation',
    title: 'Navigation',
    blurb: 'push, replace, sheets, reset',
  },
  { path: '/header', title: 'Navigation bar', blurb: 'inline and large titles, action items' },
  { path: '/animation', title: 'Animation', blurb: 'native driver, with the JS thread blocked' },
  { path: '/tabs', title: 'Tabs', blurb: 'a native tab bar, one tab with its own stack' },
  { path: '/icons', title: 'Icons', blurb: 'lucide-static, drawn as native svg shapes' },
  {
    path: '/device',
    title: 'Device',
    blurb: 'keyboard, screen, theme, app state, a11y settings',
  },
  { path: '/worklets', title: 'Worklets', blurb: 'reanimated, on the UI thread' },
  {
    path: '/native-gestures',
    title: 'Native gestures',
    blurb: 'a pan on the UI thread, and a tap on this one',
  },
  { path: '/expo', title: 'Expo modules', blurb: 'haptics, clipboard, files, and an Expo view' },
  { path: '/maps', title: 'Maps', blurb: 'expo-maps, with markers and a camera move' },
  {
    path: '/language-model',
    title: 'On-device AI',
    blurb: 'a prompt, and the answer streamed from the model on the phone',
  },
  {
    path: '/dom-components',
    title: 'DOM components',
    blurb: 'a Solid component for the browser, in a web view',
  },
];
