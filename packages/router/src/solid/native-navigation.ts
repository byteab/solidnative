import {
  batch,
  createComponent as createSolidComponent,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
  type Accessor,
} from 'solid-js';
import { useHostAdapter, type HostChild } from '@solid-native/platform/solid';
import {
  provideService,
  SCREEN_IN_FRONT,
  useService,
  withServiceScope,
} from '@solid-native/device/solid';
import { createRouteOwner, type RouteOwner } from './route-owner.ts';
import { createRetainedStack, type StackTransition } from './retained-stack.ts';
import { ActivityState, registerScreenComponents } from './screens.ts';
import { withRouteContext } from './route-context.ts';
import { hasNativeDismissGuard } from './native-dismiss.ts';
import { selectRouteTree } from './route-tree.ts';
import type { ScreenPresentation, StackPresentation } from './screen-presentation.ts';
import {
  createRouteMatch,
  parseRouteLocation,
  type RouteData,
  liveRouteMatch,
  type RouteMatch,
} from './route-match.ts';

// The real Solid component boundary, with the portable host return type in place of DOM JSX.
const createHostComponent = createSolidComponent as <P>(
  component: (props: P) => HostChild,
  props: P,
) => HostChild;

export interface NativeRouteProps {
  readonly route: RouteMatch;
  readonly navigation: NativeNavigation;
}
export type NativeRouteComponent = (props: NativeRouteProps) => HostChild;
export interface NavigationContext {
  readonly from: NativeRouteEntry | undefined;
  readonly to: RouteMatch;
  readonly signal: AbortSignal;
}
export interface NativeRoute {
  readonly path: string;
  readonly component?: NativeRouteComponent;
  readonly lazy?: (context: NavigationContext) => Promise<NativeRouteComponent>;
  readonly data?: RouteData;
  /** Return an app path to redirect; redirect cycles fail after sixteen hops. */
  readonly guard?: (context: NavigationContext) => boolean | string | Promise<boolean | string>;
  readonly resolve?: (context: NavigationContext) => RouteData | Promise<RouteData>;
  readonly presentation?: ScreenPresentation;
  readonly children?: readonly NativeRoute[];
  /** Child outlet kind. Stack is the default; tabs keep each visited child owner. */
  readonly outlet?: 'stack' | 'tabs';
  readonly redirectTo?: string;
  readonly pathMatch?: 'full';
  /**
   * Keep one screen for this route whatever its params: a push or replace that lands on it again
   * while it is the top screen updates that screen's route in place (no new screen, no native
   * transition) instead of stacking another, as every route already does when only the query or
   * fragment changes. For a param that picks what one screen shows - a pager - rather than naming
   * another screen. Leaf routes only; present() and reset() still mount.
   */
  readonly reuseScreen?: boolean;
}
export interface NativeRouteEntry {
  readonly key: string;
  readonly owner: RouteOwner;
  readonly route: RouteMatch;
  readonly inFront: Accessor<boolean>;
  readonly children?: NativeNavigation;
  readonly definition: NativeRoute;
}
export interface NativeNavigationOptions {
  readonly onError?: (error: unknown) => void;
}
export interface NativeNavigationActionOptions {
  /** Shallow immutable snapshot owned by this retained route instance. */
  readonly state?: RouteData;
  /** Per-instance overrides of the destination route's native presentation defaults. */
  readonly presentation?: ScreenPresentation;
}
export interface PresentOptions extends NativeNavigationActionOptions {
  /** Shorthand for presentation.stackPresentation. Defaults to modal. */
  readonly as?: StackPresentation;
}
export interface NativeNavigation {
  readonly entries: Accessor<readonly NativeRouteEntry[]>;
  readonly kind: 'stack' | 'tabs';
  readonly basePath: string;
  readonly url: Accessor<string>;
  readonly busy: Accessor<boolean>;
  canGoBack(): boolean;
  back(): Promise<boolean>;
  /** Select a tab, returning to its retained leaf URL when it was visited. */
  selectTab(path: string): Promise<boolean>;
  /** Outlet declaration order defines the first tab for back behavior. */
  configureTabs(paths: readonly string[]): void;
  readonly current: Accessor<NativeRouteEntry | undefined>;
  /** Guard/resolver/lazy work; false once the native transition has been staged. */
  readonly pending: Accessor<boolean>;
  readonly error: Accessor<unknown>;
  readonly transition: Accessor<StackTransition | null>;
  readonly disposed: boolean;
  /** Resolves true when staged. Native completion controls final outgoing-owner disposal. */
  push(path: string, options?: NativeNavigationActionOptions): Promise<boolean>;
  /** Present a fresh destination over the current stack, including a fresh nested layout. */
  present(path: string, options?: PresentOptions): Promise<boolean>;
  /** Atomically prepare/stage an ancestry chain without early native acknowledgments. */
  pushStack(paths: readonly string[]): Promise<boolean>;
  replace(path: string): Promise<boolean>;
  reset(paths: string | readonly string[]): Promise<boolean>;
  pop(count?: number): Promise<boolean>;
  /** Pop to an existing URL in a visible stack; never creates a destination. */
  popTo(path: string): Promise<boolean>;
  /** Pop the innermost visible stack to its first screen, preserving tab selection. */
  popToRoot(): Promise<boolean>;
  /** Adapter acknowledgment that native has settled; calling early cannot cancel native work. */
  complete(token: StackTransition): boolean;
  /** Roll back after native cancellation acknowledgment, preserving the previous owners. */
  cancel(token: StackTransition): boolean;
  /** Bind once per transition. Callbacks close over their token, never a future transition. */
  nativeEvents(token: StackTransition | null): NativeStackEvents;
  /** Internal outlet ownership: one stable native stack per navigation. */
  attachOutlet(): () => void;
  dispose(): void;
}
export interface NativeStackEvents {
  finish(): boolean;
  dismissed(key: string, count?: number): boolean;
  cancelled(key: string): boolean;
}

const CANCELLED = Symbol('cancelled navigation');

/** Resolve cancellation even if application work ignores AbortSignal or never settles. */
function interruptible<T>(
  value: T | Promise<T>,
  signal: AbortSignal,
): Promise<T | typeof CANCELLED> {
  return new Promise((resolve, reject) => {
    const abort = () => resolve(CANCELLED);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    Promise.resolve(value).then(
      (result) => {
        signal.removeEventListener('abort', abort);
        resolve(result);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

type Intent = 'push' | 'present' | 'replace' | 'reset';
interface Request {
  readonly controller: AbortController;
  readonly id: number;
}
interface PreparedRoute {
  readonly definition: NativeRoute;
  readonly match: RouteMatch;
  readonly component?: NativeRouteComponent;
  readonly child?: PreparedRoute;
}
interface NavigationInternals {
  stage(
    route: PreparedRoute,
    intent: Intent,
    active?: () => boolean,
    presentation?: ScreenPresentation,
  ): void;
}
const internals = new WeakMap<NativeNavigation, NavigationInternals>();
interface NestedOptions {
  readonly root?: NativeNavigation;
  readonly seed?: PreparedRoute;
  readonly kind?: 'stack' | 'tabs';
  readonly basePath?: string;
  readonly definitions?: readonly NativeRoute[];
}

/** `/` + `x` is `/x`: a doubled slash would read as a protocol-relative external URL. */
function joinPath(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path}`;
}

function redirectLocation(target: string, source: string, parent: string): string {
  const [sourcePath, sourceFragment] = source.split('#');
  const query = sourcePath!.indexOf('?');
  const absoluteTarget = target.startsWith('/') ? target : joinPath(parent, target);
  const [targetPath, targetFragment] = absoluteTarget.split('#');
  const querySuffix = !targetPath!.includes('?') && query >= 0 ? sourcePath!.slice(query) : '';
  const fragment = targetFragment ?? sourceFragment;
  return targetPath + querySuffix + (fragment === undefined ? '' : `#${fragment}`);
}

function screenProps(presentation: ScreenPresentation, key: string): Record<string, unknown> {
  const distance = presentation.gestureResponseDistance;
  return {
    ...presentation,
    // These transforms mirror the installed RN Screens wrapper/codegen interface.
    fullScreenSwipeEnabled:
      presentation.fullScreenSwipeEnabled === undefined
        ? 'undefined'
        : String(presentation.fullScreenSwipeEnabled),
    gestureResponseDistance: {
      start: distance?.start ?? -1,
      end: distance?.end ?? -1,
      top: distance?.top ?? -1,
      bottom: distance?.bottom ?? -1,
    },
    activityState: ActivityState.Active,
    screenId: key,
    style: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  };
}

/** Snapshot caller-owned arrays/objects before asynchronous guards and resolvers can yield. */
function copyPresentation(presentation: ScreenPresentation): ScreenPresentation {
  return {
    ...presentation,
    ...(presentation.sheetAllowedDetents && {
      sheetAllowedDetents: [...presentation.sheetAllowedDetents],
    }),
    ...(presentation.gestureResponseDistance && {
      gestureResponseDistance: { ...presentation.gestureResponseDistance },
    }),
  };
}

function actionPresentation(intent: Intent, action?: PresentOptions): ScreenPresentation {
  return copyPresentation({
    ...(intent === 'present' && { stackPresentation: action?.as ?? 'modal' }),
    ...action?.presentation,
  });
}

function actionState(action?: NativeNavigationActionOptions): RouteData | undefined {
  return action?.state === undefined ? undefined : Object.freeze({ ...action.state });
}
function preparedChain(prepared: PreparedRoute[]): PreparedRoute | null {
  return (
    prepared.reduceRight<PreparedRoute | undefined>(
      (child, route) => ({ ...route, child }),
      undefined,
    ) ?? null
  );
}

/**
 * Native app-path navigation. Instances are immutable snapshots: pushes/replacements create
 * fresh owners, unless they update the top screen in place (see `updateInPlace`); pops reveal the
 * existing owner. While a native transition is pending, new intents resolve false without
 * mutation; async preparation remains supersedable. Callers must await native
 * completion/cancellation before issuing another intent. Layout owners and visited
 * tabs retain their descendants; immutable layout snapshots update only on a fresh instance.
 */
export function createNativeNavigation(
  routes: readonly NativeRoute[],
  options: NativeNavigationOptions = {},
): NativeNavigation {
  return createNavigation(routes, options, {});
}

function createNavigation(
  routes: readonly NativeRoute[],
  options: NativeNavigationOptions,
  nested: NestedOptions,
): NativeNavigation {
  let parent = getOwner();
  if (!parent) throw new Error('createNativeNavigation requires an active Solid owner.');
  const adapter = useHostAdapter();
  let ancestorInFront = useService(SCREEN_IN_FRONT);
  const stack = createRetainedStack([], options);
  const instances = new Map<RouteOwner, NativeRouteEntry>();
  const presentations = new WeakMap<RouteOwner, ScreenPresentation>();
  const reroute = new WeakMap<NativeRouteEntry, (match: RouteMatch) => void>();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  let request: Request | undefined;
  const [revision, setRevision] = createSignal(0);
  let epoch = 0;
  function advance(): number {
    const next = ++epoch;
    setRevision(next);
    return next;
  }
  let instanceId = 0;
  let disposed = false;
  let outlet = false;
  registerScreenComponents();
  const entries = () => stack.entries().map((owner) => instances.get(owner)!);
  const [selectedKey, setSelectedKey] = createSignal<string>();
  const kind = nested.kind ?? 'stack';
  let tabPaths: readonly string[] = [];
  const current = () =>
    kind === 'tabs' ? entries().find((entry) => entry.key === selectedKey()) : entries().at(-1);
  const root = () => nested.root ?? navigation;
  const busy = (): boolean =>
    pending() || !!stack.transition() || entries().some((entry) => entry.children?.busy());

  // Solid error boundaries may consume runWithOwner exceptions; capture and rethrow outside.
  function underOwner<T>(operation: () => T): T {
    let result!: T;
    let failure: { error: unknown } | undefined;
    runWithOwner(parent, () => {
      try {
        result = operation();
      } catch (cause) {
        failure = { error: cause };
      }
    });
    if (failure) throw failure.error;
    return result;
  }
  function active(work: Request): boolean {
    return !disposed && request === work && !work.controller.signal.aborted;
  }
  function stopRequest(): void {
    const previous = request;
    request = undefined;
    setPending(false);
    previous?.controller.abort();
  }
  function begin(): Request | null {
    if (disposed) throw new Error('The native navigation has been disposed.');
    // RN Screens finish events carry no generation. Never overlap native proposals: an
    // old finish would otherwise reach the newly registered listener and settle its token.
    if (root().busy() && !pending()) return null;
    if (stack.transition() || entries().some((entry) => entry.children?.busy())) return null;
    const previous = request;
    const work = { id: ++epoch, controller: new AbortController() };
    request = work;
    previous?.controller.abort();
    if (!active(work)) return null;
    batch(() => {
      setRevision(work.id);
      setPending(true);
      setError(undefined);
    });
    return active(work) ? work : null;
  }
  function failure(cause: unknown): void {
    setError(() => cause);
    try {
      options.onError?.(cause);
    } catch {
      // Reporters cannot turn a failed navigation into an unhandled native callback rejection.
    }
  }
  async function prepare(
    path: string,
    base: string,
    work: Request,
    redirects = 0,
    state?: RouteData,
  ): Promise<PreparedRoute | null> {
    if (redirects > 16) throw new Error('Native route guard redirect limit exceeded.');
    const location = parseRouteLocation(path, base);
    const selections = selectRouteTree(routes, location.url);
    const prepared: PreparedRoute[] = [];
    let inherited: RouteData = {};
    for (const [index, selection] of selections.entries()) {
      const { definition } = selection;
      const match = createRouteMatch({ ...selection.match, state }, selection.match.params, {
        ...inherited,
        ...selection.match.data,
      });
      if (definition.redirectTo !== undefined) {
        const parentPath = selections[index - 1]?.match.pathname ?? '/';
        return prepare(
          redirectLocation(definition.redirectTo, location.url, parentPath),
          '/',
          work,
          redirects + 1,
          state,
        );
      }
      const context = { from: current(), to: match, signal: work.controller.signal };
      const allowed = await checkGuard(definition, context);
      if (!active(work)) return null;
      if (typeof allowed === 'string')
        return prepare(allowed, match.pathname, work, redirects + 1, state);
      if (allowed !== true) return null;
      const loaded = await loadRoute(definition, match, context, work);
      if (!loaded) return null;
      if (loaded.component) prepared.push(loaded);
      inherited = loaded.match.data;
    }
    return preparedChain(prepared);
  }
  async function checkGuard(
    definition: NativeRoute,
    context: NavigationContext,
  ): Promise<boolean | string | typeof CANCELLED> {
    return definition.guard
      ? interruptible(
          underOwner(() => definition.guard!(context)),
          context.signal,
        )
      : true;
  }
  async function loadRoute(
    definition: NativeRoute,
    match: RouteMatch,
    context: NavigationContext,
    work: Request,
  ): Promise<PreparedRoute | null> {
    const resolved = definition.resolve
      ? await interruptible(
          underOwner(() => definition.resolve!(context)),
          context.signal,
        )
      : {};
    if (!active(work) || resolved === CANCELLED) return null;
    const finalMatch = createRouteMatch(match, match.params, { ...match.data, ...resolved });
    const component = definition.lazy
      ? await interruptible(
          underOwner(() => definition.lazy!({ ...context, to: finalMatch })),
          context.signal,
        )
      : definition.component;
    if (!active(work) || component === CANCELLED) return null;
    if (typeof component !== 'function' && !definition.children?.length)
      throw new Error(`Route ${definition.path} has no component.`);
    return { definition, match: finalMatch, component };
  }
  function mount(
    prepared: PreparedRoute,
    intent: Intent = 'reset',
    override?: ScreenPresentation,
  ): NativeRouteEntry {
    const key = `native-route-${++instanceId}`;
    // Reactive so a reuseScreen route can update in place; every other route keeps its first match.
    const [match, setMatch] = createSignal(prepared.match);
    const route = liveRouteMatch(match);
    const inFront = () => ancestorInFront() && current()?.key === key;
    let owner: RouteOwner | undefined;
    let children: NativeNavigation | undefined;
    owner = underOwner(() =>
      createRouteOwner(
        key,
        (screen) =>
          withServiceScope(
            [provideService(SCREEN_IN_FRONT, () => inFront)],
            () => {
              onCleanup(() => {
                if (owner) instances.delete(owner);
              });
              return createHostComponent(() => {
                if (prepared.child)
                  children = createNavigation(routes, options, {
                    root: root(),
                    seed: prepared.child,
                    kind: prepared.definition.outlet,
                    basePath: prepared.match.pathname,
                    definitions: prepared.definition.children,
                  });
                return withRouteContext(
                  {
                    route,
                    navigation: root(),
                    outlet: children,
                    screen: kind === 'stack' ? screen : undefined,
                  },
                  () =>
                    createHostComponent(prepared.component!, {
                      route,
                      navigation: root(),
                    }),
                );
              }, {});
            },
            options.onError,
          ),
        { ...options, element: kind === 'tabs' ? 'view' : 'screen' },
      ),
    );
    try {
      const presentation = copyPresentation({ ...prepared.definition.presentation, ...override });
      const covering = current() && presentations.get(current()!.owner)?.stackPresentation;
      const effective = {
        ...presentation,
        stackPresentation:
          presentation.stackPresentation ?? (intent !== 'reset' ? covering : undefined) ?? 'push',
      };
      presentations.set(owner, effective);
      const nativeProps = kind === 'tabs' ? { style: { flex: 1 } } : screenProps(effective, key);
      for (const [name, value] of Object.entries(nativeProps)) {
        if (name === 'preventNativeDismiss' && hasNativeDismissGuard(owner.node)) continue;
        adapter.engine.setProp(owner.node, name, value);
      }
    } catch (cause) {
      owner.dispose();
      throw cause;
    }
    const entry = Object.freeze({
      key,
      owner,
      route,
      inFront,
      children,
      definition: prepared.definition,
    });
    instances.set(owner, entry);
    reroute.set(entry, setMatch);
    return entry;
  }
  function stage(created: readonly NativeRouteEntry[], intent: Intent): void {
    if (!created.length) throw new Error('A native stack reset requires at least one route.');
    const previous = stack.entries();
    const prefix =
      intent === 'reset' ? [] : intent === 'replace' ? previous.slice(0, -1) : previous;
    const token = stack.transitionTo([...prefix, ...created.map((entry) => entry.owner)]);
    if (kind === 'tabs') {
      setSelectedKey(created.at(-1)?.key);
      stack.complete(token); // Tab selection has no outgoing screen disposal/stack animation.
    }
  }
  function releaseUnadopted(created: readonly NativeRouteEntry[]): void {
    for (const entry of created) if (!stack.retained().includes(entry.owner)) entry.owner.dispose();
  }
  /**
   * A push or replace onto the top leaf screen's own path - only the query, fragment or state
   * differ, and no presentation of its own asks for a new screen - or onto the top screen of its
   * own `reuseScreen` route updates that screen in place.
   */
  function updateInPlace(
    prepared: PreparedRoute,
    intent: Intent,
    isActive: () => boolean,
    presentation?: ScreenPresentation,
  ) {
    const top = current();
    const reuses: boolean =
      (intent === 'push' || intent === 'replace') &&
      !prepared.child &&
      top?.definition === prepared.definition &&
      ((top.route.pathname === prepared.match.pathname &&
        !Object.keys(presentation ?? {}).length) ||
        (kind === 'stack' && !!prepared.definition.reuseScreen));
    if (reuses && isActive()) reroute.get(top!)!(prepared.match);
    return reuses;
  }
  function applyPrepared(
    prepared: PreparedRoute,
    intent: Intent,
    isActive = () => true,
    presentation?: ScreenPresentation,
  ): void {
    const candidates = kind === 'tabs' ? entries() : [current()];
    const existing =
      intent === 'reset' || intent === 'present'
        ? undefined
        : candidates.find(
            (entry) =>
              entry?.definition === prepared.definition &&
              entry.route.pathname === prepared.match.pathname &&
              (kind === 'tabs' || !!prepared.child),
          );
    if (existing) {
      if (prepared.child && existing.children)
        internals.get(existing.children)!.stage(prepared.child, intent, isActive, presentation);
      if (!isActive()) return;
      if (kind === 'tabs') setSelectedKey(existing.key);
      return;
    }
    const entry = mount(prepared, intent, presentation);
    try {
      if (isActive()) stage([entry], kind === 'tabs' ? 'push' : intent);
    } finally {
      releaseUnadopted([entry]);
    }
  }
  function stagePrepared(
    prepared: PreparedRoute,
    intent: Intent,
    isActive?: () => boolean,
    presentation?: ScreenPresentation,
  ): void {
    if (!updateInPlace(prepared, intent, isActive ?? (() => true), presentation))
      applyPrepared(prepared, intent, isActive, presentation);
  }
  async function navigate(
    paths: readonly string[],
    intent: Intent,
    action?: PresentOptions,
  ): Promise<boolean> {
    const work = begin();
    if (!work) return false;
    const created: NativeRouteEntry[] = [];
    try {
      const presentation = actionPresentation(intent, action);
      const state = actionState(action);
      let base = navigation.url();
      const prepared: PreparedRoute[] = [];
      for (const path of paths) {
        const route = await prepare(path, base, work, 0, state);
        if (!route || !active(work)) return false;
        prepared.push(route);
        base = route.match.pathname;
      }
      if (intent !== 'reset' && prepared.length === 1) {
        stagePrepared(prepared[0]!, intent, () => active(work), presentation);
        return active(work);
      }
      for (const route of prepared) {
        created.push(mount(route, intent));
        if (!active(work)) return false;
      }
      stage(created, intent);
      return true;
    } catch (cause) {
      if (active(work)) failure(cause);
      return false;
    } finally {
      // Only adopted instances may survive a failed/stale transaction.
      releaseUnadopted(created);
      if (request === work) stopRequest();
    }
  }
  function validNativeSnapshot(token: StackTransition | null, revision: number): boolean {
    return !disposed && epoch === revision && stack.transition() === token;
  }
  function currentPopIntent(started: number, front: NativeRouteEntry | undefined): boolean {
    return !disposed && epoch === started && !root().busy() && current() === front;
  }
  const navigation: NativeNavigation = {
    entries,
    kind,
    basePath: nested.basePath ?? '/',
    url: () => current()?.children?.url() ?? current()?.route.url ?? '/',
    busy,
    canGoBack: () =>
      !!current()?.children?.canGoBack() ||
      (kind === 'tabs'
        ? !!current() &&
          current()!.definition.path !== (tabPaths[0] ?? entries()[0]?.definition.path)
        : entries().length > 1),
    async back() {
      if (root().busy()) return false;
      const child = current()?.children;
      if (child?.canGoBack()) return child.back();
      if (kind === 'tabs') {
        if (tabPaths[0] && current()?.definition.path !== tabPaths[0])
          return navigation.selectTab(tabPaths[0]);
        const first = entries()[0];
        if (!first || first === current()) return false;
        setSelectedKey(first.key);
        return true;
      }
      return navigation.pop();
    },
    configureTabs(paths) {
      if (kind !== 'tabs' || !paths.length || new Set(paths).size !== paths.length)
        throw new Error('Native tabs require nonempty unique child paths.');
      if (paths.some((path) => !nested.definitions?.some((definition) => definition.path === path)))
        throw new Error('A native tab must name a configured child route.');
      if (current() && !paths.includes(current()!.definition.path))
        throw new Error('The active child route has no matching native tab.');
      tabPaths = [...paths];
    },
    selectTab(path) {
      if (kind !== 'tabs') return Promise.resolve(false);
      const entry = entries().find((candidate) => candidate.definition.path === path);
      // Selecting the bar returns to a retained subtree without replacing its leaf.
      if (entry) {
        if (root().busy()) return Promise.resolve(false);
        setSelectedKey(entry.key);
        return Promise.resolve(true);
      }
      return root().push(joinPath(navigation.basePath, path));
    },
    current,
    pending,
    error,
    transition: stack.transition,
    get disposed() {
      return disposed;
    },
    push: (path, action) =>
      nested.root ? nested.root.push(path, action) : navigate([path], 'push', action),
    present: (path, action) =>
      nested.root ? nested.root.present(path, action) : navigate([path], 'present', action),
    pushStack: (paths) => (nested.root ? nested.root.pushStack(paths) : navigate(paths, 'push')),
    replace: (path) => (nested.root ? nested.root.replace(path) : navigate([path], 'replace')),
    reset: (paths) =>
      nested.root
        ? nested.root.reset(paths)
        : navigate(typeof paths === 'string' ? [paths] : paths, 'reset'),
    async pop(count = 1) {
      const work = begin();
      if (!work) return false;
      try {
        return stack.dismiss(count) !== null;
      } catch (cause) {
        failure(cause);
        return false;
      } finally {
        if (request === work) stopRequest();
      }
    },
    async popTo(path) {
      if (disposed || root().busy()) return false;
      const started = epoch;
      const front = current();
      const child = current()?.children;
      if (child && (await child.popTo(path))) return true;
      if (!currentPopIntent(started, front)) return false;
      if (kind !== 'stack') return false;
      const target = parseRouteLocation(path, navigation.url()).url;
      const index = entries()
        .map((entry) => entry.route.url)
        .lastIndexOf(target);
      const count = entries().length - index - 1;
      return index >= 0 && count > 0 ? navigation.pop(count) : false;
    },
    popToRoot() {
      if (disposed || root().busy()) return Promise.resolve(false);
      const child = current()?.children;
      // A child layout defines the stack in front even when that stack is already at root.
      if (child) return child.popToRoot();
      return kind === 'stack' && entries().length > 1
        ? navigation.pop(entries().length - 1)
        : Promise.resolve(false);
    },
    complete: (token) => !disposed && stack.complete(token),
    cancel(token) {
      if (disposed || stack.transition() !== token) return false;
      stopRequest();
      advance();
      return stack.cancel(token);
    },
    nativeEvents(token) {
      const nativeRevision = revision();
      const frontKey = current()?.key;
      return Object.freeze({
        finish: () =>
          validNativeSnapshot(token, nativeRevision) &&
          token !== null &&
          navigation.complete(token),
        dismissed(key: string, count = 1) {
          if (!validNativeSnapshot(token, nativeRevision) || key !== frontKey || token)
            return false;
          if (!Number.isSafeInteger(count) || count < 1) return false;
          stopRequest();
          advance();
          const dismissed = stack.dismiss(count);
          return dismissed !== null && stack.complete(dismissed);
        },
        cancelled(key: string) {
          return (
            key === frontKey &&
            token !== null &&
            validNativeSnapshot(token, nativeRevision) &&
            navigation.cancel(token)
          );
        },
      });
    },
    attachOutlet() {
      if (outlet) throw new Error('A native navigation can mount only one stack outlet.');
      if (disposed) throw new Error('The native navigation has been disposed.');
      outlet = true;
      if (nested.seed && !entries().length) {
        // Construct descendants under the actual outlet's owner, so layout service/context
        // providers wrap them just as they wrap the outlet itself.
        parent = getOwner();
        ancestorInFront = useService(SCREEN_IN_FRONT);
        const entry = mount(nested.seed);
        const token = stack.transitionTo([entry.owner]);
        setSelectedKey(entry.key);
        stack.complete(token); // Initial subtree has never been attached to native.
      }
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        outlet = false;
        navigation.dispose();
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      advance();
      stopRequest();
      stack.dispose();
      instances.clear();
    },
  };
  internals.set(navigation, { stage: stagePrepared });
  onCleanup(navigation.dispose);
  return navigation;
}
