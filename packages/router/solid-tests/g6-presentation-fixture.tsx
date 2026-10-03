/** @jsxImportSource @solid-native/platform/solid */
import { onCleanup } from 'solid-js';
import { ServiceScope } from '@solid-native/device/solid';
import {
  createNativeNavigation,
  NativeStackOutlet,
  useRoute,
  type NativeNavigation,
  type NativeRoute,
} from '@solid-native/router/solid';
import { deferred } from './navigation-fixture.tsx';

export function createPresentationFixture() {
  let nav!: NativeNavigation;
  const guard = deferred<boolean | string>();
  const constructions: string[] = [];
  const cleanups: string[] = [];
  const errors: unknown[] = [];
  const signals: AbortSignal[] = [];
  function Page() {
    const route = useRoute();
    constructions.push(route.url);
    onCleanup(() => cleanups.push(route.url));
    return (
      <view testID={`page:${route.url}`}>
        <text>{route.url}</text>
      </view>
    );
  }
  function Layout() {
    const route = useRoute();
    constructions.push(`layout:${route.url}`);
    onCleanup(() => cleanups.push(`layout:${route.url}`));
    return <NativeStackOutlet testID="nested-stack" />;
  }
  const routes: NativeRoute[] = [
    { path: '', component: Page },
    { path: 'plain', component: Page },
    { path: 'denied', component: Page, guard: () => false },
    {
      path: 'redirect',
      component: Page,
      guard: () => '/sheet?returnUrl=%2Faccount%3Ftab%3Dprofile#code',
    },
    {
      path: 'guarded',
      component: Page,
      guard: ({ signal }) => {
        signals.push(signal);
        return guard.promise;
      },
    },
    {
      path: 'broken',
      lazy: async () => {
        throw new Error('presentation lazy failure');
      },
    },
    {
      path: 'sheet',
      component: Page,
      presentation: {
        stackPresentation: 'pageSheet',
        stackAnimation: 'fade',
        sheetGrabberVisible: true,
        sheetAllowedDetents: [0.25, 1],
        gestureResponseDistance: { top: 12 },
      },
    },
    {
      path: 'layout/:account',
      component: Layout,
      children: [
        { path: '', redirectTo: 'first', pathMatch: 'full' },
        { path: ':page', component: Page },
      ],
    },
  ];
  function Shell() {
    nav = createNativeNavigation(routes, { onError: (error) => errors.push(error) });
    return <NativeStackOutlet navigation={nav} testID="root-stack" />;
  }
  function View() {
    return (
      <ServiceScope>
        <Shell />
      </ServiceScope>
    );
  }
  return {
    View,
    get nav() {
      return nav;
    },
    constructions,
    cleanups,
    errors,
    guard,
    signals,
    routes,
  };
}
