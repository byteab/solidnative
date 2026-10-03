import { createComponent, createContext, useContext } from 'solid-js';
import type { HostChild } from '@solid-native/platform/solid';
import type { HostNode } from '@solid-native/fabric';
import type { NativeNavigation, NativeRouteProps } from './native-navigation.ts';
import type { RouteMatch } from './route-match.ts';

interface RouteContextValue extends NativeRouteProps {
  readonly outlet: NativeNavigation | undefined;
  readonly screen?: HostNode;
}
const RouteContext = createContext<RouteContextValue>();

export function withRouteContext(value: RouteContextValue, render: () => HostChild): HostChild {
  const Provider = RouteContext.Provider as (props: {
    value: RouteContextValue;
    children: HostChild;
  }) => HostChild;
  const createHostComponent = createComponent as <P>(
    component: (props: P) => HostChild,
    props: P,
  ) => HostChild;
  return createHostComponent(Provider, {
    value,
    get children() {
      return render();
    },
  }) as HostChild;
}

export function useRoute(): RouteMatch {
  const context = useContext(RouteContext);
  if (!context) throw new Error('useRoute requires a native route owner.');
  return context.route;
}

export function useRouteScreen(): HostNode {
  const screen = useContext(RouteContext)?.screen;
  if (!screen) throw new Error('A dismissal guard requires a native stack screen.');
  return screen;
}

/** The root navigation accepts absolute app paths from any nested screen. */
export function useNavigation(): NativeNavigation {
  const context = useContext(RouteContext);
  if (!context) throw new Error('useNavigation requires a native route owner.');
  return context.navigation;
}

export function useRouteOutlet(): NativeNavigation {
  const navigation = useContext(RouteContext)?.outlet;
  if (!navigation) throw new Error('This route has no child navigation for an outlet.');
  return navigation;
}
