/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { ColorScheme, provideService, ServiceScope, type Scheme } from '@solidnative/device/solid';
import {
  createNativeNavigation,
  type NativeNavigation,
  type NativeRoute,
  type NativeRouteProps,
} from '../src/solid/native-navigation.ts';
import { NativeStackOutlet } from '../src/solid/native-stack-outlet.ts';
import { NativeHeader } from '../src/solid/native-header.ts';
import { NativeTabsOutlet } from '../src/solid/native-tabs-outlet.ts';
import { NativeBarDefaults } from '../src/solid/native-bar-defaults.ts';
import { useNavigation, useRoute } from '../src/solid/route-context.ts';
import {
  bindNativeNavigation,
  type NativeNavigationBinding,
  type NativeNavigationBindingOptions,
} from '../src/solid/native-links.ts';
import { deferred } from './navigation-fixture.tsx';

export function createShellFixture(bindingOptions?: NativeNavigationBindingOptions) {
  let nav!: NativeNavigation;
  let binding: NativeNavigationBinding | undefined;
  const constructions: string[] = [];
  const cleanups: string[] = [];
  const inputs: Record<string, unknown>[] = [];
  const errors: unknown[] = [];
  const [scheme, setScheme] = createSignal<Scheme>('light');
  const [badge, setBadge] = createSignal('1');
  const [signedIn, setSignedIn] = createSignal(false);
  const [title, setTitle] = createSignal('Title');
  const slow = deferred<boolean | string>();
  const signals: AbortSignal[] = [];
  function Page(props: NativeRouteProps) {
    const route = useRoute();
    if (route !== props.route || props.navigation !== useNavigation())
      throw new Error('Route context mismatch');
    constructions.push(route.url);
    inputs.push(route.inputs);
    onCleanup(() => cleanups.push(route.url));
    return (
      <view testID={`page:${route.pathname}`}>
        <NativeHeader title={title()} testID={`header:${route.pathname}`} />
        <text>{route.params['album'] ?? route.url}</text>
      </view>
    );
  }
  function Tabs() {
    constructions.push('tabs-layout');
    onCleanup(() => cleanups.push('tabs-layout'));
    return (
      <view>
        <NativeHeader hidden />
        <NativeTabsOutlet
          testID="tabs-host"
          tabs={[
            { path: 'library', title: 'Library', sfSymbol: 'books.vertical.fill' },
            {
              path: 'search',
              title: 'Search',
              icon: { template: { uri: 'search.png' } },
              selectedIcon: { template: { uri: 'search-selected.png' } },
            },
            {
              path: 'profile',
              title: 'Profile',
              get badge() {
                return badge();
              },
              standardAppearance: {
                stacked: {
                  selected: { tabBarItemTitleFontWeight: 600, tabBarItemIconColor: '#ff0000' },
                },
              },
            },
            { path: 'denied', title: 'Denied' },
          ]}
        />
      </view>
    );
  }
  function Library() {
    constructions.push('library-layout');
    onCleanup(() => cleanups.push('library-layout'));
    return (
      <NativeBarDefaults header={{ titleFontFamily: 'LayoutFont' }}>
        <NativeStackOutlet testID="library-stack" />
      </NativeBarDefaults>
    );
  }
  const routes: NativeRoute[] = [
    { path: '', component: Page },
    { path: 'plain', component: Page },
    { path: 'auth/login', component: Page },
    { path: 'account', component: Page, guard: () => signedIn() || '/auth/login' },
    { path: 'projects', component: Page },
    { path: 'projects/:pid', component: Page },
    { path: 'projects/:pid/tasks/:tid', component: Page },
    { path: 'projects/:pid/tasks/:tid/comments/:cid', component: Page },
    { path: 'sheet', component: Page, presentation: { stackPresentation: 'formSheet' } },
    {
      path: 'tabs',
      component: Tabs,
      outlet: 'tabs',
      data: { inherited: true, winner: 'outer' },
      children: [
        { path: '', redirectTo: 'library', pathMatch: 'full' },
        {
          path: 'library',
          component: Library,
          data: { winner: 'library' },
          children: [
            { path: '', component: Page },
            {
              path: ':album',
              component: Page,
              resolve: ({ to }) => ({ winner: to.params['album'] }),
            },
            {
              path: 'slow/guard',
              component: Page,
              guard: ({ signal }) => {
                signals.push(signal);
                return slow.promise;
              },
            },
            {
              path: 'broken/lazy',
              lazy: async () => {
                throw new Error('nested lazy failure');
              },
            },
          ],
        },
        { path: 'search', lazy: async () => Page },
        { path: 'profile', component: Page },
        { path: 'denied', component: Page, guard: () => false },
      ],
    },
  ];
  function Shell() {
    nav = createNativeNavigation(routes, { onError: (error) => errors.push(error) });
    if (bindingOptions) binding = bindNativeNavigation(nav, bindingOptions);
    return <NativeStackOutlet navigation={nav} testID="root-stack" />;
  }
  function View() {
    return (
      <ServiceScope
        services={[
          provideService(ColorScheme.SOURCE, () => ({
            current: scheme,
            subscribe: () => () => {},
          })),
        ]}
      >
        <NativeBarDefaults
          header={() => ({
            backgroundColor: scheme() === 'dark' ? '#101010' : '#eeeeee',
            color: '#00ff00',
          })}
          tabs={() => ({
            tintColor: scheme() === 'dark' ? '#ffffff' : '#000000',
            backgroundColor: '#111111',
          })}
        >
          <Shell />
        </NativeBarDefaults>
      </ServiceScope>
    );
  }
  return {
    View,
    get nav() {
      return nav;
    },
    get binding() {
      return binding;
    },
    constructions,
    cleanups,
    inputs,
    errors,
    setScheme,
    setBadge,
    setSignedIn,
    setTitle,
    slow,
    signals,
    routes,
  };
}

/** Canary's exact project ancestry policy, kept here as a source-independent behavior oracle. */
export function projectLinkParent(url: string): string | null {
  const segments = url.split(/[?#]/)[0]!.split('/').filter(Boolean);
  if (segments[0] !== 'projects' || segments.length < 2) return null;
  if (segments.length === 2) return '/projects';
  if (segments[2] === 'tasks' && segments.length === 4) return `/projects/${segments[1]}`;
  if (segments[4] === 'comments' && segments.length === 6)
    return `/projects/${segments[1]}/tasks/${segments[3]}`;
  return null;
}
