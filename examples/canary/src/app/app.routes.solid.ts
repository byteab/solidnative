import type { NativeRoute } from '@solidnative/router/solid';
import { signedIn, type Session } from './auth/session.solid.ts';

/**
 * Every feature on its own screen, behind `lazy`, which is what a real app does and what
 * this app exists to exercise.
 *
 * Worth knowing what that costs while developing, because it is easy to mistake for a slow app:
 * Metro serves every `import()` as its own bundle, built and fetched when the route is first
 * activated. That is a few hundred milliseconds of bundling plus an HTTP round-trip - over wifi
 * on a real phone - the first time each screen is opened, and nothing on later visits. A
 * production export is a single bundle regardless; Metro inlines async imports when it is not
 * serving them itself.
 */
export function createCanaryRoutes(session: () => Session): readonly NativeRoute[] {
  return [
    { path: '', lazy: () => import('./home/home.solid.tsx').then((m) => m.Home) },
    { path: 'feed', lazy: () => import('./feed/feed.solid.tsx').then((m) => m.FeedPage) },
    { path: 'chat', lazy: () => import('./chat/chat.solid.tsx').then((m) => m.ChatPage) },
    { path: 'world', lazy: () => import('./world/world-page.solid.tsx').then((m) => m.WorldPage) },
    { path: 'notes', lazy: () => import('./notes/notes-page.solid.tsx').then((m) => m.NotesPage) },
    {
      path: 'notes/:id',
      lazy: () => import('./notes/note-editor.solid.tsx').then((m) => m.NoteEditor),
    },
    {
      path: 'stories',
      lazy: () => import('./stories/stories-page.solid.tsx').then((m) => m.StoriesPage),
    },
    {
      path: 'stories/view',
      lazy: () => import('./stories/story-viewer.solid.tsx').then((m) => m.StoryViewer),
    },
    { path: 'shop', lazy: () => import('./shop/shop-page.solid.tsx').then((m) => m.ShopPage) },
    {
      path: 'shop/basket',
      lazy: () => import('./shop/basket-sheet.solid.tsx').then((m) => m.BasketSheet),
    },
    {
      path: 'shop/:id',
      lazy: () => import('./shop/product-page.solid.tsx').then((m) => m.ProductPage),
    },
    {
      path: 'settings',
      lazy: () => import('./settings/settings-page.solid.tsx').then((m) => m.SettingsPage),
    },
    {
      path: 'settings/:section',
      lazy: () => import('./settings/settings-detail.solid.tsx').then((m) => m.SettingsDetail),
    },
    {
      path: 'wallet',
      lazy: () => import('./wallet/wallet-page.solid.tsx').then((m) => m.WalletPage),
    },
    {
      path: 'calendar',
      lazy: () => import('./calendar/calendar-page.solid.tsx').then((m) => m.CalendarPage),
    },
    {
      path: 'kanban',
      lazy: () => import('./kanban/kanban-page.solid.tsx').then((m) => m.KanbanPage),
    },
    { path: 'ride', lazy: () => import('./ride/ride-page.solid.tsx').then((m) => m.RidePage) },
    {
      path: 'player',
      lazy: () => import('./player/player-page.solid.tsx').then((m) => m.PlayerPage),
    },
    {
      path: 'player/now',
      lazy: () => import('./player/now-playing.solid.tsx').then((m) => m.NowPlaying),
    },
    {
      path: 'ride/where',
      lazy: () => import('./ride/ride-sheet.solid.tsx').then((m) => m.RideSheet),
    },
    {
      path: 'browse',
      lazy: () => import('./browse/browse.solid.tsx').then((m) => m.Browse),
    },
    {
      path: 'inbox',
      lazy: () => import('./inbox/inbox.solid.tsx').then((m) => m.InboxPage),
    },
    {
      path: 'orders',
      lazy: () => import('./orders/orders-page.solid.tsx').then((m) => m.OrdersPage),
    },
    {
      path: 'orders/:id',
      lazy: () => import('./orders/order-page.solid.tsx').then((m) => m.OrderPage),
    },
    {
      path: 'field-notes',
      lazy: () => import('./offline/offline-notes.solid.tsx').then((m) => m.OfflineNotes),
    },
    {
      path: 'stress',
      lazy: () => import('./stress/stress-list.solid.tsx').then((m) => m.StressList),
    },
    {
      path: 'overlays',
      lazy: () => import('./overlays/overlays-page.solid.tsx').then((m) => m.OverlaysPage),
    },
    {
      path: 'overlays/sheet',
      data: { sheet: true },
      lazy: () => import('./overlays/overlays-page.solid.tsx').then((m) => m.OverlaysPage),
    },
    {
      path: 'auth/login',
      lazy: () => import('./auth/login-page.solid.tsx').then((m) => m.LoginPage),
    },
    { path: 'auth/code', lazy: () => import('./auth/code-page.solid.tsx').then((m) => m.CodePage) },
    {
      path: 'account',
      guard: (context) => signedIn(session())(context),
      lazy: () => import('./auth/account-page.solid.tsx').then((m) => m.AccountPage),
    },
    {
      path: 'account/settings',
      guard: (context) => signedIn(session())(context),
      data: { settings: true },
      lazy: () => import('./auth/account-page.solid.tsx').then((m) => m.AccountPage),
    },
    {
      path: 'account/orders',
      guard: (context) => signedIn(session())(context),
      lazy: () => import('./orders/orders-page.solid.tsx').then((m) => m.OrdersPage),
    },
    { path: 'photos', lazy: () => import('./viewer/gallery.solid.tsx').then((m) => m.Gallery) },
    {
      path: 'photos/:index',
      lazy: () => import('./viewer/photo-viewer.solid.tsx').then((m) => m.PhotoViewer),
    },
    {
      path: 'queue',
      lazy: () => import('./collections/playlist.solid.tsx').then((m) => m.Playlist),
    },
    {
      path: 'search-demo',
      lazy: () => import('./search/music-search.solid.tsx').then((m) => m.MusicSearch),
    },
    {
      path: 'search-demo/:id',
      lazy: () => import('./search/search-result.solid.tsx').then((m) => m.SearchResult),
    },
    {
      path: 'projects',
      lazy: () => import('./projects/projects-page.solid.tsx').then((m) => m.ProjectsPage),
    },
    {
      path: 'projects/:pid',
      lazy: () => import('./projects/project-page.solid.tsx').then((m) => m.ProjectPage),
    },
    {
      path: 'projects/:pid/new',
      lazy: () => import('./projects/task-editor.solid.tsx').then((m) => m.TaskEditor),
    },
    {
      path: 'projects/:pid/tasks/:tid',
      lazy: () => import('./projects/task-page.solid.tsx').then((m) => m.TaskPage),
    },
    {
      path: 'projects/:pid/tasks/:tid/edit',
      lazy: () => import('./projects/task-editor.solid.tsx').then((m) => m.TaskEditor),
    },
    {
      path: 'projects/:pid/tasks/:tid/comments/:cid',
      lazy: () => import('./projects/comment-page.solid.tsx').then((m) => m.CommentPage),
    },
    {
      path: 'people/:uid',
      lazy: () => import('./projects/person-page.solid.tsx').then((m) => m.PersonPage),
    },
    {
      path: 'keyboard',
      lazy: () => import('./keyboard/keyboard-lab.solid.tsx').then((m) => m.KeyboardLab),
    },
    {
      path: 'keyboard/sheet',
      lazy: () => import('./keyboard/note-sheet.solid.tsx').then((m) => m.NoteSheet),
    },
    {
      path: 'application',
      lazy: () => import('./forms/application.solid.tsx').then((m) => m.ApplicationPage),
    },
    {
      path: 'primitives',
      lazy: () => import('./components/primitives.solid.tsx').then((m) => m.Primitives),
    },
    { path: 'text', lazy: () => import('./css/text.solid.tsx').then((m) => m.TextNesting) },
    { path: 'css', lazy: () => import('./css/css.solid.tsx').then((m) => m.CssPage) },
    {
      path: 'tailwind',
      lazy: () => import('./tailwind/tailwind-page.solid.tsx').then((m) => m.TailwindPage),
    },
    { path: 'layout', lazy: () => import('./css/layout.solid.tsx').then((m) => m.LayoutPage) },
    {
      path: 'typography',
      lazy: () => import('./css/typography.solid.tsx').then((m) => m.TypographyPage),
    },
    {
      path: 'surfaces',
      lazy: () => import('./css/surfaces.solid.tsx').then((m) => m.SurfacesPage),
    },
    {
      path: 'scrolling',
      lazy: () => import('./lists/scrolling.solid.tsx').then((m) => m.ScrollingPage),
    },
    { path: 'verify', lazy: () => import('./device/verify.solid.tsx').then((m) => m.VerifyPage) },
    {
      path: 'css-engine',
      lazy: () => import('./css/css-engine.solid.tsx').then((m) => m.CssEnginePage),
    },
    {
      path: 'expo-ui',
      lazy: () => import('./expo/expo-ui.solid.tsx').then((m) => m.ExpoUiPage),
    },
    {
      path: 'native-views',
      lazy: () => import('./expo/native-views.solid.tsx').then((m) => m.NativeViewsPage),
    },
    { path: 'forms', lazy: () => import('./forms/forms.solid.tsx').then((m) => m.FormsPage) },
    {
      path: 'gestures',
      lazy: () => import('./gestures/gestures.solid.tsx').then((m) => m.Gestures),
    },
    { path: 'list', lazy: () => import('./lists/list.solid.tsx').then((m) => m.ListPage) },
    {
      path: 'components',
      lazy: () => import('./components/components.solid.tsx').then((m) => m.ComponentsPage),
    },
    { path: 'modal', lazy: () => import('./navigation/modal.solid.tsx').then((m) => m.ModalPage) },
    {
      path: 'navigation',
      lazy: () => import('./navigation/navigation.solid.tsx').then((m) => m.NavigationPage),
    },
    { path: 'detail', lazy: () => import('./navigation/detail.solid.tsx').then((m) => m.Detail) },
    { path: 'sheet', lazy: () => import('./navigation/sheet.solid.tsx').then((m) => m.Sheet) },
    { path: 'header', lazy: () => import('./navigation/header.solid.tsx').then((m) => m.Header) },
    {
      path: 'regressions',
      lazy: () => import('./navigation/regressions.solid.tsx').then((m) => m.Regressions),
    },
    {
      path: 'regressions/header',
      lazy: () => import('./navigation/regressions.solid.tsx').then((m) => m.RegressionHeader),
    },
    {
      path: 'regressions/item/:id',
      lazy: () => import('./navigation/regressions.solid.tsx').then((m) => m.RegressionItem),
    },
    {
      path: 'regressions/modal',
      lazy: () => import('./navigation/regressions.solid.tsx').then((m) => m.RegressionModal),
    },
    {
      path: 'regressions/broken',
      lazy: () => import('./navigation/regressions.solid.tsx').then((m) => m.RegressionBroken),
    },
    {
      path: 'regressions/text',
      lazy: () => import('./navigation/regressions.solid.tsx').then((m) => m.RegressionText),
    },
    {
      path: 'regressions/rtl',
      lazy: () => import('./navigation/regressions.solid.tsx').then((m) => m.RegressionRtl),
    },
    {
      path: 'regressions/dates',
      lazy: () => import('./navigation/regressions.solid.tsx').then((m) => m.RegressionDates),
    },
    {
      path: 'regressions/defer',
      lazy: () => import('./navigation/regressions.solid.tsx').then((m) => m.RegressionDefer),
    },
    {
      path: 'regressions/hidden-modal',
      lazy: () => import('./navigation/regressions.solid.tsx').then((m) => m.RegressionHiddenModal),
    },
    {
      path: 'animation',
      lazy: () => import('./components/animation.solid.tsx').then((m) => m.AnimationPage),
    },
    { path: 'icons', lazy: () => import('./components/icons.solid.tsx').then((m) => m.IconsPage) },
    { path: 'device', lazy: () => import('./device/device.solid.tsx').then((m) => m.DevicePage) },
    {
      path: 'native-gestures',
      lazy: () => import('./gestures/native-gestures.solid.tsx').then((m) => m.NativeGesturesPage),
    },
    {
      path: 'worklets',
      lazy: () => import('./gestures/worklets.solid.tsx').then((m) => m.WorkletsPage),
    },
    {
      // A tab bar. The bar itself is declared in the page's template; these are the routes its
      // items select. The library tab has a stack of its own, which is what makes pushing inside a
      // tab keep the bar.
      path: 'tabs',
      outlet: 'tabs',
      lazy: () => import('./tabs/tabs.solid.tsx').then((m) => m.TabsPage),
      children: [
        { path: '', pathMatch: 'full', redirectTo: 'library' },
        {
          path: 'library',
          lazy: () => import('./tabs/tab-library.solid.tsx').then((m) => m.TabLibrary),
          children: [
            {
              path: '',
              lazy: () => import('./tabs/tab-library.solid.tsx').then((m) => m.LibraryList),
            },
            {
              path: ':album',
              lazy: () => import('./tabs/tab-library.solid.tsx').then((m) => m.LibraryAlbum),
            },
          ],
        },
        {
          path: 'search',
          lazy: () => import('./tabs/tab-plain.solid.tsx').then((m) => m.TabSearch),
        },
        {
          path: 'profile',
          lazy: () => import('./tabs/tab-plain.solid.tsx').then((m) => m.TabProfile),
        },
      ],
    },
    { path: 'expo', lazy: () => import('./expo/expo.solid.tsx').then((m) => m.ExpoPage) },
    { path: 'maps', lazy: () => import('./expo/maps.solid.tsx').then((m) => m.MapsPage) },
    {
      path: 'language-model',
      lazy: () => import('./expo/language-model.solid.tsx').then((m) => m.LanguageModelPage),
    },
    {
      path: 'dom-components',
      lazy: () =>
        import('./dom-components/dom-components.solid.tsx').then((m) => m.DomComponentsPage),
    },
  ];
}
