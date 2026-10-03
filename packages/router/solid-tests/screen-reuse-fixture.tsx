/** @jsxImportSource @solid-native/platform/solid */
import { onCleanup } from 'solid-js';
import { ServiceScope } from '@solid-native/device/solid';
import {
  createNativeNavigation,
  type NativeNavigation,
  type NativeRoute,
} from '../src/solid/native-navigation.ts';
import { NativeStackOutlet } from '../src/solid/native-stack-outlet.ts';
import { NativeTabsOutlet } from '../src/solid/native-tabs-outlet.ts';
import { useRoute } from '../src/solid/route-context.ts';

/** Screens, layouts and tabs whose constructions and cleanups are counted per route pattern. */
export function createScreenReuseFixture() {
  let nav!: NativeNavigation;
  const created: Record<string, number> = {};
  const live: Record<string, number> = {};
  const errors: unknown[] = [];
  const count = (name: string) => {
    created[name] = (created[name] ?? 0) + 1;
    live[name] = (live[name] ?? 0) + 1;
    onCleanup(() => live[name]!--);
  };
  const page = (name: string) => () => {
    count(name);
    const route = useRoute();
    return (
      <view testID={`${name}`}>
        <text testID={`text:${name}`}>
          {route.pathname}|{String(route.params['index'] ?? '')}|{String(route.query['tab'] ?? '')}|
          {String(route.state?.['from'] ?? '')}
        </text>
      </view>
    );
  };
  const layout = (name: string) => () => {
    count(name);
    return <NativeStackOutlet testID={`stack:${name}`} />;
  };
  function Tabs() {
    count('tabs');
    return (
      <NativeTabsOutlet
        testID="tabs-host"
        tabs={[
          { path: 'library', title: 'Library' },
          { path: 'other', title: 'Other' },
        ]}
      />
    );
  }
  const routes: NativeRoute[] = [
    { path: '/', component: page('home') },
    { path: '/users/:id', component: page('user') },
    { path: '/photo/:index', component: page('photo'), reuseScreen: true },
    { path: '/a', component: layout('a'), children: [{ path: ':id', component: page('a-leaf') }] },
    { path: '/b', component: layout('b'), children: [{ path: ':id', component: page('b-leaf') }] },
    { path: '/seg/:id', component: page('seg-one') },
    { path: '/seg/a/b', component: page('seg-two') },
    {
      path: '/tabs',
      component: Tabs,
      outlet: 'tabs',
      children: [
        {
          path: 'library',
          component: layout('library'),
          children: [{ path: '', component: page('list') }],
        },
        { path: 'other', component: page('other') },
      ],
    },
    { path: '/sheet', component: page('sheet'), presentation: { stackPresentation: 'formSheet' } },
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
    created,
    live,
    errors,
    get nav() {
      return nav;
    },
  };
}
