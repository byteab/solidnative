/** @jsxImportSource @solid-native/platform/solid */
import {
  createComponent,
  catchError,
  createContext,
  createRenderEffect,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
  useContext,
  type Owner,
} from 'solid-js';
import { afterHostCommit, onHostCleanup, type HostChild } from '@solid-native/platform/solid';
import {
  createRetainedStack,
  createRouteOwner,
  type RetainedStack,
  type RouteOwner,
} from '@solid-native/router/solid';
import type { HostNode } from '@solid-native/fabric';

const RouteContext = createContext('missing');

export interface FixtureRouteOptions {
  readonly failRender?: boolean;
  readonly throwCleanup?: boolean;
  readonly throwReporter?: boolean;
}

export function createRouteFixture() {
  const [value, setValue] = createSignal(0);
  const cleanups: string[] = [];
  const resources: string[] = [];
  const events: string[] = [];
  const reports: unknown[] = [];
  const effects: string[] = [];
  const commits: string[] = [];
  const nodes = new Map<string, HostNode>();
  const routes = new Map<string, RouteOwner>();
  let parent: Owner | null = null;
  let stack!: RetainedStack;

  function Page(props: { name: string; options: FixtureRouteOptions }) {
    const context = useContext(RouteContext);
    createRenderEffect(() => effects.push(`${props.name}:first:${value()}`));
    createRenderEffect(() => {
      effects.push(`${props.name}:second:${value()}`);
      if (props.options.throwCleanup)
        onCleanup(() => {
          throw new Error(`cleanup:${props.name}`);
        });
    });
    onCleanup(() => cleanups.push(props.name));
    afterHostCommit(() => commits.push(props.name));
    const node = (
      <view
        testID={props.name}
        ref={(node) => {
          nodes.set(props.name, node);
          onHostCleanup(node, () => resources.push(props.name));
        }}
        onTouchEnd={() => events.push(props.name)}
      >
        <text>
          {context}:{value()}
        </text>
      </view>
    );
    if (props.options.failRender) throw new Error(`render:${props.name}`);
    return node;
  }

  function create(name: string, options: FixtureRouteOptions = {}): RouteOwner {
    if (!parent) throw new Error('Mount the route fixture before creating routes.');
    const route = runWithOwner(parent, () =>
      createRouteOwner(name, () => <Page name={name} options={options} />, {
        onError(error) {
          reports.push(error);
          if (options.throwReporter) throw new Error('reporter');
        },
      }),
    )!;
    routes.set(name, route);
    return route;
  }

  function View() {
    let output: HostChild;
    createComponent(RouteContext.Provider, {
      value: 'inherited',
      get children() {
        parent = getOwner();
        stack = createRetainedStack([create('a')]);
        output = <view testID="stack">{stack.children()}</view>;
        return undefined;
      },
    });
    return output;
  }

  return {
    View,
    create,
    get stack() {
      return stack;
    },
    otherStack: (initial: readonly RouteOwner[] = []) =>
      runWithOwner(parent, () => createRetainedStack(initial))!,
    handledFailure: () =>
      runWithOwner(parent, () =>
        catchError(
          () =>
            createRouteOwner(
              'handled',
              () => <Page name="handled" options={{ failRender: true, throwCleanup: true }} />,
              { onError: (error) => reports.push(error) },
            ),
          (error) => reports.push(error),
        ),
      ),
    value,
    setValue,
    cleanups,
    resources,
    events,
    effects,
    reports,
    commits,
    nodes,
    routes,
  };
}
