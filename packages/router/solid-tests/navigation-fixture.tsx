/** @jsxImportSource @solidnative/platform/solid */
import { createRenderEffect, createSignal, onCleanup } from 'solid-js';
import {
  ServiceScope,
  useService,
  SCREEN_IN_FRONT,
  provideService,
} from '@solidnative/device/solid';
import {
  createNativeNavigation,
  type NativeNavigation,
  type NativeRoute,
  type NativeRouteProps,
  NativeStackOutlet,
  NativeHeader,
} from '@solidnative/router/solid';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

export function createNavigationFixture() {
  const [label, setLabel] = createSignal('title');
  const [ancestorFront, setAncestorFront] = createSignal(true);
  const headerChildren: string[] = [];
  const [value, setValue] = createSignal(0);
  const cleanups: string[] = [];
  const constructions: string[] = [];
  const effects: string[] = [];
  const fronts: string[] = [];
  const errors: unknown[] = [];
  const guard = deferred<boolean | string>();
  const resolve = deferred<Record<string, unknown>>();
  const lazy = deferred<(props: NativeRouteProps) => ReturnType<typeof Page>>();
  const signals: AbortSignal[] = [];
  let navigation!: NativeNavigation;
  function HeaderChild(props: { path: string }) {
    headerChildren.push(props.path);
    return null;
  }
  function Page(props: NativeRouteProps) {
    constructions.push(`${props.route.url}:${value()}`);
    const front = useService(SCREEN_IN_FRONT);
    createRenderEffect(() => effects.push(`${props.route.url}:${value()}`));
    createRenderEffect(() => fronts.push(`${props.route.url}:${front()}`));
    onCleanup(() => cleanups.push(props.route.url));
    const node = (
      <view testID={`page:${props.route.url}`}>
        <text>
          {String(props.route.inputs['id'] ?? '')}:{props.route.fragment ?? '-'}:{value()}
        </text>
        <NativeHeader
          title={`${label()}:${props.route.pathname}`}
          testID={`header:${props.route.url}`}
        >
          <HeaderChild path={props.route.url} />
        </NativeHeader>
      </view>
    );
    if (props.route.pathname === '/render-error') throw new Error('render failure');
    return node;
  }
  const routes: NativeRoute[] = [
    { path: '/', component: Page },
    {
      path: '/item/:id',
      component: Page,
      data: { id: 'static', fixed: true },
      resolve: ({ to }) => ({ id: `resolved:${to.params['id']}` }),
    },
    { path: '/item/new', component: Page },
    { path: '/plain/:id', component: Page },
    { path: '/denied', component: Page, guard: () => false },
    { path: '/redirect', component: Page, guard: () => '/plain/login?reason=auth' },
    { path: '/loop', component: Page, guard: () => '/loop' },
    {
      path: '/guarded',
      component: Page,
      guard: ({ signal }) => {
        signals.push(signal);
        return guard.promise;
      },
    },
    {
      path: '/resolved',
      component: Page,
      resolve: ({ signal }) => {
        signals.push(signal);
        return resolve.promise;
      },
    },
    {
      path: '/lazy',
      lazy: ({ signal }) => {
        signals.push(signal);
        return lazy.promise;
      },
    },
    {
      path: '/resolver-error',
      component: Page,
      resolve: () => {
        throw new Error('resolver failure');
      },
    },
    {
      path: '/lazy-error',
      lazy: async () => {
        throw new Error('lazy failure');
      },
    },
    { path: '/render-error', component: Page },
    {
      path: '/presentation-error',
      component: Page,
      presentation: {
        get stackAnimation(): never {
          throw new Error('presentation failure');
        },
      },
    },
    {
      path: '/sheet',
      component: Page,
      presentation: {
        stackPresentation: 'formSheet',
        fullScreenSwipeEnabled: true,
        sheetAllowedDetents: [0.5, 1],
      },
    },
  ];
  function View() {
    return (
      <ServiceScope services={[provideService(SCREEN_IN_FRONT, () => ancestorFront)]}>
        {(() => {
          navigation = createNativeNavigation(routes, { onError: (error) => errors.push(error) });
          return <NativeStackOutlet navigation={navigation} testID="native-stack" />;
        })()}
      </ServiceScope>
    );
  }
  return {
    View,
    get navigation() {
      return navigation;
    },
    Page,
    cleanups,
    constructions,
    effects,
    fronts,
    errors,
    signals,
    guard,
    resolve,
    lazy,
    setLabel,
    setAncestorFront,
    headerChildren,
    setValue,
  };
}
