/**
 * `render()`, `screen` and `within()`, shaped like Testing Library's and running on the fake
 * Fabric instead of a DOM.
 *
 * A render is a real `createNativeRoot()` - the same root an app mounts, with the same renderer and
 * engine - onto a `createFakeFabric()`, so what a query reads is what native would have been handed.
 */
import { createSignal } from 'solid-js';
import {
  nativePlatform,
  registerPlatformComponents,
  type EngineOptions,
} from '@solid-native/fabric';
import {
  createNativeRoot,
  type NativeChild,
  type NativeClock,
  type NativeRoot,
} from '@solid-native/platform/solid';
import { bindQueries, describeTree, flatten, type BoundQueries } from './queries.ts';
import { createFakeFabric, type FakeFabric, type FakeFabricNode } from './test-utils.ts';
import { waitFor, type WaitForOptions } from './wait-for.ts';

/** Where a render is mounted: what `renderWith`'s boot function is handed. */
export interface RenderHost {
  readonly fabric: FakeFabric;
  readonly rootTag: number;
  readonly clock?: NativeClock;
}

/** What a boot function returns: anything that can be torn down, and optionally flushed. */
export interface Mountable {
  dispose(): void;
  flush?(): boolean;
}

export interface HostOptions {
  /**
   * Which platform's view names and component defaults to use. `ios` by default. Once a process
   * has rendered for Android it stays on Android: put Android tests in a file of their own.
   */
  readonly platform?: 'ios' | 'android';
  /** A clock to drive by hand (see `createClock`). By default, real microtasks and frames. */
  readonly clock?: NativeClock;
  readonly rootTag?: number;
}

export interface RenderOptions<P extends object> extends HostOptions {
  /** The component's props. Reactive: `setProps` updates them in place. */
  readonly props?: P;
  /** What the engine takes on a device: `globalStyles`, `conditions`, `tokens`, `onError`... */
  readonly engineOptions?: EngineOptions;
}

/** Every query, bound to this render, and the handles to drive it. */
export interface RenderResult<R extends Mountable = Mountable> extends BoundQueries {
  readonly fabric: FakeFabric;
  /** What was mounted: the `NativeRoot` for `render()`, the boot's result for `renderWith()`. */
  readonly root: R;
  /** Commit whatever is pending now, without waiting for the scheduler. */
  flush(): void;
  /** Print the committed tree, or one node's subtree. */
  debug(node?: FakeFabricNode): void;
  unmount(): void;
}

export interface ComponentRenderResult<P extends object> extends RenderResult<NativeRoot> {
  /** Merge new props into the ones the component was rendered with, and commit. */
  setProps(next: Partial<P>): void;
}

interface Mounted {
  fabric: FakeFabric;
  root: Mountable;
  clock?: NativeClock;
}

const mounted: Mounted[] = [];
/** Which render a node a query returned belongs to, so an event on it reaches the right fake. */
const owners = new WeakMap<FakeFabricNode, Mounted>();

function flushMounted(target: Mounted): void {
  (target.clock as { flushMicrotasks?: () => void } | undefined)?.flushMicrotasks?.();
  target.root.flush?.();
}

/**
 * Let pending work run and commit: one macrotask, so promises and microtasks have run, then a
 * flush of every render (a hand-driven clock's microtasks included).
 */
export async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushRenders();
}

/** Commit what every render has pending, now. */
export function flushRenders(): void {
  for (const target of [...mounted]) flushMounted(target);
}

function latest(): Mounted {
  const current = mounted.at(-1);
  if (!current) throw new Error('Nothing is rendered: call render() first.');
  return current;
}

export function ownerOf(node: FakeFabricNode): Mounted {
  return owners.get(node) ?? latest();
}

/** The node as it is in the most recent commit, found by its tag, or null once it is gone. */
export function currentOf(node: FakeFabricNode): FakeFabricNode | null {
  const hit = flatten(ownerOf(node).fabric.committed).find((n) => n.reactTag === node.reactTag);
  if (hit) owners.set(hit, ownerOf(node));
  return hit ?? null;
}

const tree = (nodes: readonly FakeFabricNode[]): string => describeTree(nodes) || '(nothing)';

function queriesFor(roots: () => readonly FakeFabricNode[], owner: () => Mounted): BoundQueries {
  return bindQueries(
    roots,
    () => tree(roots()),
    (node) => owners.set(node, owner()),
  );
}

/**
 * Fabric's platform is process-wide, and Android's view names cannot be taken back. Node's test
 * runner runs each file in a process of its own, so an Android test goes in a file of its own.
 */
function usePlatform(platform: 'ios' | 'android'): void {
  if (platform === 'ios' && nativePlatform() === 'android')
    throw new Error(
      'render(): this process already rendered for Android, and cannot go back to iOS. Put the ' +
        'Android tests in a file of their own.',
    );
  registerPlatformComponents(platform);
}

/**
 * Mount whatever `boot` mounts onto a fresh fake Fabric: an app's own entry (`mountApp({ fabric,
 * rootTag, ... })`) with its services and providers, exactly as it boots on a device.
 */
export function renderWith<R extends Mountable>(
  boot: (host: RenderHost) => R,
  options: HostOptions = {},
): RenderResult<R> {
  usePlatform(options.platform ?? 'ios');
  const fabric = createFakeFabric();
  const root = boot({ fabric, rootTag: options.rootTag ?? 1, clock: options.clock });
  const self: Mounted = { fabric, root, clock: options.clock };
  mounted.push(self);
  flushMounted(self);
  return {
    ...queriesFor(
      () => fabric.committed,
      () => self,
    ),
    fabric,
    root,
    flush: () => flushMounted(self),
    debug: (node) => console.log(tree(node ? [currentOf(node) ?? node] : fabric.committed)),
    unmount: () => unmount(self),
  };
}

/**
 * Mount a component onto a fresh fake Fabric and commit its first frame, synchronously. The same
 * `createNativeRoot()` an app mounts with, so what the queries read is exactly what native would
 * have been sent.
 */
export function render<P extends object = Record<string, never>>(
  component: (props: P) => NativeChild,
  options: RenderOptions<NoInfer<P>> = {},
): ComponentRenderResult<P> {
  const [props, setProps] = createSignal<P>(options.props ?? ({} as P));
  // Reads go through the signal, so a component reading `props.x` follows `setProps`.
  const reactive = new Proxy({} as P, {
    get: (_, key) => Reflect.get(props(), key),
    has: (_, key) => key in props(),
    ownKeys: () => Reflect.ownKeys(props()),
    getOwnPropertyDescriptor: (_, key) =>
      key in props() ? { enumerable: true, configurable: true } : undefined,
  });
  const result = renderWith(({ fabric, rootTag, clock }) => {
    const root = createNativeRoot({ fabric, rootTag, clock, engineOptions: options.engineOptions });
    root.render(() => component(reactive));
    return root;
  }, options);
  return {
    ...result,
    setProps(next) {
      setProps((previous) => ({ ...previous, ...next }));
      result.flush();
    },
  };
}

function unmount(target: Mounted): void {
  const at = mounted.indexOf(target);
  if (at === -1) return;
  mounted.splice(at, 1);
  target.root.dispose();
}

/** Unmount everything rendered so far. Registered as an `afterEach` where one is global. */
export function cleanup(): void {
  for (const target of [...mounted].reverse()) unmount(target);
}

/** Queries over whatever was rendered most recently, as Testing Library's `screen` is. */
export const screen: BoundQueries & { debug(node?: FakeFabricNode): void } = {
  ...queriesFor(() => latest().fabric.committed, latest),
  debug: (node) => console.log(tree(node ? [currentOf(node) ?? node] : latest().fabric.committed)),
};

/** Queries scoped to one node and what is under it, in whichever commit is current. */
export function within(node: FakeFabricNode): BoundQueries {
  const owner = ownerOf(node);
  return queriesFor(
    () => {
      const current = currentOf(node);
      return current ? [current] : [];
    },
    () => owner,
  );
}

type Present = FakeFabricNode | readonly FakeFabricNode[] | null | undefined;

/** Wait for a node, or whatever a callback finds, to leave the committed tree. */
export async function waitForElementToBeRemoved(
  target: FakeFabricNode | readonly FakeFabricNode[] | (() => Present),
  options?: WaitForOptions,
): Promise<void> {
  const present = (): boolean => {
    let found: Present;
    try {
      found = typeof target === 'function' ? target() : target;
    } catch {
      return false;
    }
    const nodes = found ? ([] as FakeFabricNode[]).concat(found) : [];
    return nodes.some((node) => currentOf(node) !== null);
  };
  if (!present()) {
    throw new Error(
      'waitForElementToBeRemoved needs the node to be there when it starts; it already is not.',
    );
  }
  await waitFor(() => {
    if (present())
      throw new Error(`Still rendered after the timeout.\n\n${tree(latest().fabric.committed)}`);
  }, options);
}

// Testing Library's own convention: clean up after every test when the runner exposes `afterEach`
// globally (Vitest with `globals: true`, Jest). Otherwise each `render()` stands alone.
const globalAfterEach = (globalThis as { afterEach?: (fn: () => void) => void }).afterEach;
if (typeof globalAfterEach === 'function') globalAfterEach(cleanup);
