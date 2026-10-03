/** The browser half of a Solid DOM component. Only JSON crosses the native bridge. */
import {
  createComponent,
  createRoot,
  createSignal,
  getOwner,
  type Component,
  type Owner,
} from 'solid-js';
import { insert } from 'solid-js/web';

interface NativeBridge {
  injectedObjectJson?(): string;
  postMessage(data: string): void;
}

interface PageWindow extends Window {
  ReactNativeWebView?: NativeBridge;
  __solidNative?: { receive(message: unknown): void };
  __solidNativeEarlyCleanup?: () => void;
}

export interface WebViewMount<P extends object> {
  readonly host: HTMLElement;
  readonly props: P;
  setInputs(inputs: Partial<P>): void;
  dispose(): void;
}

export interface DomComponentFile<P extends object = Record<string, unknown>> {
  readonly domComponent: string;
  readonly mounted?: Promise<WebViewMount<P>>;
}

export interface MountInWebViewOptions<P extends object> {
  readonly inputs?: Partial<P>;
  /** Native output name → callback prop, e.g. { strokes: 'onStrokes' }. */
  readonly outputs?: Readonly<Record<string, keyof P & string>>;
  readonly host?: HTMLElement;
}

const mounts = new WeakSet<Window>();
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const describe = (error: unknown): string =>
  error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);

function initialInputs(bridge: NativeBridge | undefined): Record<string, unknown> {
  try {
    const data: unknown = JSON.parse(bridge?.injectedObjectJson?.() ?? '{}');
    return record(data) && record(data['inputs']) ? data['inputs'] : {};
  } catch {
    return {};
  }
}

/** Browser components use the DOM JSX compiler; this module never executes on native. */
export function mountInWebView<P extends object>(
  component: Component<P>,
  options: MountInWebViewOptions<P> = {},
): DomComponentFile<P> {
  // Keep mounting synchronous so imports install the receiver before native can send inputs.
  return { domComponent: '', mounted: Promise.resolve(mount(component, options)) };
}

function mount<P extends object>(
  component: Component<P>,
  options: MountInWebViewOptions<P>,
): WebViewMount<P> {
  const page = window as PageWindow;
  if (mounts.has(page)) throw new Error('A DOM component already owns this page.');
  mounts.add(page);
  try {
    return createPage(component, options, page);
  } catch (error) {
    mounts.delete(page);
    throw error;
  }
}

function createPage<P extends object>(
  component: Component<P>,
  options: MountInWebViewOptions<P>,
  page: PageWindow,
): WebViewMount<P> {
  const document = page.document;
  const bridge = page.ReactNativeWebView;
  const previous = page.__solidNative;
  const margin = document.body.style.margin;
  const existing = options.host ?? document.querySelector<HTMLElement>('solid-native-web-root');
  const host =
    existing ?? document.body.appendChild(document.createElement('solid-native-web-root'));
  const children = [...host.childNodes];
  let disposed = false;
  let mounting = true;
  let released = false;
  let disposeRoot: (() => void) | undefined;
  let owner: Owner | null = null;
  const post = (message: object) => {
    if (!disposed) bridge?.postMessage(JSON.stringify(message));
  };
  const report = (error: unknown) => post({ type: 'error', message: describe(error) });
  const [inputs, update] = createSignal<Record<string, unknown>>({});
  let outputs: [string, string][] = [];
  let callbacks: Record<string, (value: unknown) => void> = {};
  const props = new Proxy({} as P, {
    get: (_, key) =>
      Object.hasOwn(callbacks, key) ? Reflect.get(callbacks, key) : Reflect.get(inputs(), key),
    has: (_, key) => Object.hasOwn(callbacks, key) || Object.hasOwn(inputs(), key),
    ownKeys: () => [...new Set([...Object.keys(inputs()), ...Object.keys(callbacks)])],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
  const setInputs = (value: Partial<P>) => {
    if (!disposed && record(value)) update((current) => ({ ...current, ...value }));
  };
  const receiver = {
    receive(message: unknown) {
      if (record(message) && message['type'] === 'inputs' && record(message['inputs']))
        setInputs(message['inputs'] as Partial<P>);
    },
  };
  const onError = (event: ErrorEvent) => report(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => report(event.reason);
  function dispose(): void {
    disposed = true;
    if (mounting || released) return;
    released = true;
    page.removeEventListener('error', onError);
    page.removeEventListener('unhandledrejection', onRejection);
    page.removeEventListener('pagehide', dispose);
    if (page.__solidNative === receiver) {
      if (previous) page.__solidNative = previous;
      else delete page.__solidNative;
    }
    try {
      containCleanup(owner);
      disposeRoot?.();
    } finally {
      if (existing) host.replaceChildren(...children);
      else host.remove();
      if (document.body.style.margin === '0px') document.body.style.margin = margin;
      mounts.delete(page);
    }
  }
  try {
    update({ ...options.inputs, ...initialInputs(bridge) });
    outputs = Object.entries(options.outputs ?? {});
    callbacks = Object.fromEntries(
      outputs.map(([name, prop]) => [
        prop,
        (value: unknown) => post({ type: 'output', name, value }),
      ]),
    );
    page.__solidNativeEarlyCleanup?.();
    delete page.__solidNativeEarlyCleanup;
    page.__solidNative = receiver;
    page.addEventListener('error', onError);
    page.addEventListener('unhandledrejection', onRejection);
    page.addEventListener('pagehide', dispose);
    document.body.style.margin = '0';
    createRoot((end) => {
      disposeRoot = end;
      owner = getOwner();
      host.replaceChildren();
      const content = createComponent(component, props);
      if (!disposed) insert(host, content);
    });
    post({ type: 'ready', outputs: outputs.map(([name]) => name) });
    return { host, props, setInputs, dispose };
  } catch (error) {
    try {
      report(error);
    } finally {
      dispose();
    }
    throw error;
  } finally {
    mounting = false;
    if (disposed) dispose();
  }
}

/** A throwing user cleanup must not strand sibling reactive computations. */
function containCleanup(owner: Owner | null): void {
  if (!owner) return;
  for (const child of owner.owned ?? []) containCleanup(child);
  if (owner.cleanups)
    owner.cleanups = owner.cleanups.map((cleanup) => () => {
      try {
        cleanup();
      } catch (error) {
        console.error(error);
      }
    });
}
