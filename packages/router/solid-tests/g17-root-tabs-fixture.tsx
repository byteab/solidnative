/** @jsxImportSource @solidnative/platform/solid */
import { ServiceScope } from '@solidnative/device/solid';
import {
  createNativeNavigation,
  type NativeNavigation,
  type NativeRoute,
  type NativeRouteProps,
} from '../src/solid/native-navigation.ts';
import { NativeStackOutlet } from '../src/solid/native-stack-outlet.ts';
import { NativeTabsOutlet } from '../src/solid/native-tabs-outlet.ts';
import { useRoute } from '../src/solid/route-context.ts';
import { TabSafeAreaView } from '../src/solid/tab-safe-area-view.ts';

/** The example apps' shape: tabs at the empty root path with a relative default redirect. */
export function createRootTabsFixture() {
  let nav!: NativeNavigation;
  const errors: unknown[] = [];
  function Page(_props: NativeRouteProps) {
    const route = useRoute();
    return (
      <view testID={`page:${route.pathname}`}>
        <TabSafeAreaView testID={`inset:${route.pathname}`} class="inset" edges={['bottom']} />
      </view>
    );
  }
  function Tabs() {
    return (
      <NativeTabsOutlet
        testID="tabs-host"
        tabs={[
          { path: 'notes', title: 'Notes' },
          { path: 'settings', title: 'Settings' },
        ]}
      />
    );
  }
  const routes: NativeRoute[] = [
    {
      path: '',
      component: Tabs,
      outlet: 'tabs',
      children: [
        { path: '', redirectTo: 'notes', pathMatch: 'full' },
        { path: 'notes', component: Page },
        { path: 'settings', component: Page },
      ],
    },
  ];
  function Shell() {
    nav = createNativeNavigation(routes, { onError: (error) => errors.push(error) });
    return <NativeStackOutlet navigation={nav} testID="root-stack" />;
  }
  function View() {
    return (
      <ServiceScope services={[]}>
        <Shell />
      </ServiceScope>
    );
  }
  return {
    View,
    errors,
    get nav() {
      return nav;
    },
  };
}
