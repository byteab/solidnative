import {
  createComponent,
  createContext,
  createRoot,
  getOwner,
  onCleanup,
  runWithOwner,
  useContext,
  type Owner,
} from 'solid-js';

/** Identity, rather than name, distinguishes service tokens. Factories are lazy. */
export interface ServiceToken<T> {
  readonly name: string;
  readonly create: () => T;
}

export interface ServiceBinding<T = unknown> {
  readonly token: ServiceToken<T>;
  readonly create: () => T;
}

export interface ServiceScopeProps<T> {
  readonly services?: readonly ServiceBinding[];
  readonly onError?: (error: unknown) => void;
  readonly children?: T;
}

interface Scope {
  owner: Owner | null;
  resolve<T>(token: ServiceToken<T>): T;
  dispose(): void;
}

const context = createContext<Scope>();

export function createServiceToken<T>(name: string, create: () => T): ServiceToken<T> {
  return Object.freeze({ name, create });
}

/** Override a token's factory in the nearest ServiceScope. */
export function provideService<T>(token: ServiceToken<T>, create: () => T): ServiceBinding<T> {
  return { token, create };
}

function reportError(report: ((error: unknown) => void) | undefined, error: unknown): void {
  try {
    if (report) report(error);
    else console.error('[native-solid] service cleanup', error);
  } catch {
    // Cleanup must finish even when application error reporting fails.
  }
}

/** Pinned public Solid Owner shape; Solid still performs all subscription unlinking. */
function containCleanup(owner: Owner, report: (error: unknown) => void): void {
  for (const child of owner.owned ?? []) containCleanup(child, report);
  if (owner.cleanups)
    owner.cleanups = owner.cleanups.map((cleanup) => () => {
      try {
        cleanup();
      } catch (error) {
        report(error);
      }
    });
}

function ownedFactory<T>(scope: Scope, create: () => T, report: (error: unknown) => void) {
  let owner: Owner | null = null;
  let dispose: (() => void) | undefined;
  let failure: { error: unknown } | undefined;
  let active = true;
  const release = () => {
    if (!active) return;
    active = false;
    if (owner) containCleanup(owner, report);
    dispose?.();
  };
  try {
    const value = runWithOwner(scope.owner, () =>
      createRoot((cleanup) => {
        owner = getOwner();
        dispose = cleanup;
        try {
          return create();
        } catch (error) {
          // Capture before Solid's inherited error handler can turn a failed factory into
          // an undefined result. Release now; rethrow once outside runWithOwner below.
          failure = { error };
          release();
          return undefined;
        }
      }),
    );
    if (failure) throw failure.error;
    return { value: value as T, release };
  } catch (error) {
    release();
    throw error;
  }
}

function makeScope(
  parent: Scope | undefined,
  services: readonly ServiceBinding[],
  onError: ((error: unknown) => void) | undefined,
): Scope {
  const factories = new Map<ServiceToken<unknown>, () => unknown>();
  for (const binding of services) {
    if (factories.has(binding.token))
      throw new Error(`Duplicate service override: ${binding.token.name}`);
    factories.set(binding.token, binding.create);
  }
  const cache = new Map<ServiceToken<unknown>, { value: unknown; release(): void }>();
  const pending = new Set<ServiceToken<unknown>>();
  let disposed = false;
  const scope: Scope = {
    owner: null,
    resolve<T>(token: ServiceToken<T>): T {
      if (disposed) throw new Error('The service scope has been disposed.');
      if (!factories.has(token) && parent) return parent.resolve(token);
      if (cache.has(token)) return cache.get(token)!.value as T;
      if (pending.has(token)) throw new Error(`Circular service dependency: ${token.name}`);
      pending.add(token);
      try {
        const instance = ownedFactory(scope, factories.get(token) ?? token.create, (error) =>
          reportError(onError, error),
        );
        if (disposed) {
          instance.release();
          throw new Error('The service scope was disposed while creating a service.');
        }
        cache.set(token, instance);
        return instance.value as T;
      } finally {
        pending.delete(token);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Dependents were added after their dependencies and therefore clean up first.
      for (const instance of [...cache.values()].reverse()) instance.release();
      cache.clear();
      pending.clear();
    },
  };
  return scope;
}

/**
 * Unoverridden tokens resolve in the parent scope; root defaults are app singletons.
 * Override a service token itself to create a screen-owned instance with screen sources.
 * Scope configuration is captured at creation; use a keyed branch to replace a scope.
 */
export function withServiceScope<T>(
  services: readonly ServiceBinding[],
  render: () => T,
  onError?: (error: unknown) => void,
): T {
  const parent = getOwner();
  if (!parent) throw new Error('ServiceScope requires an active Solid owner.');
  const scope = makeScope(useContext(context), services, onError);
  let owner: Owner | null = null;
  let disposeOwner: (() => void) | undefined;
  let active = true;
  let failure: { error: unknown } | undefined;
  const release = () => {
    if (!active) return;
    active = false;
    releaseFromParent = undefined;
    if (owner) containCleanup(owner, (error) => reportError(onError, error));
    disposeOwner?.();
    scope.dispose();
    owner = null;
    disposeOwner = undefined;
  };
  let releaseFromParent: (() => void) | undefined = release;
  onCleanup(() => releaseFromParent?.());
  let value!: T;
  createRoot((dispose) => {
    owner = getOwner();
    disposeOwner = dispose;
    createComponent(context.Provider, {
      value: scope,
      get children() {
        scope.owner = getOwner();
        try {
          value = render();
        } catch (error) {
          // A failed scoped subtree must not wait for its still-live parent to release
          // subscriptions or effects, even when an inherited error handler consumes it.
          failure = { error };
          release();
        }
        return undefined;
      },
    });
  }, parent);
  if (failure) throw failure.error;
  return value;
}

/** Generic children keep device services independent of a native or DOM renderer. */
export function ServiceScope<T>(props: ServiceScopeProps<T>): T | undefined {
  return withServiceScope(props.services ?? [], () => props.children, props.onError);
}

export function useService<T>(token: ServiceToken<T>): T {
  const scope = useContext(context);
  if (!scope) throw new Error(`Service ${token.name} requires a ServiceScope.`);
  return scope.resolve(token);
}
