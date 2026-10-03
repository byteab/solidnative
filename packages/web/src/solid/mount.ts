import { createEffect, createSignal, getOwner, onCleanup, untrack } from 'solid-js';
import { createBrowserRoot, type BrowserRoot, type BrowserRootOptions } from './root.ts';
import type { HostChild } from './context.ts';

export type BrowserComponent<P extends object> = (props: P) => HostChild;
export interface MountOptions<P extends object> extends BrowserRootOptions {
  readonly inputs?: P;
}
export interface MountResult<P extends object> extends BrowserRoot {
  readonly props: P;
  setInputs(inputs: Partial<P>): void;
  destroy(): void;
}
/** Inputs update in place; callback props are ordinary typed Solid outputs. */
export function mount<P extends object>(
  element: Element,
  component: BrowserComponent<P>,
  options: MountOptions<P> = {},
): MountResult<P> {
  const [inputs, setInputs] = createSignal(options.inputs ?? ({} as P));
  const props = new Proxy({} as P, {
    get: (_, key) => Reflect.get(inputs(), key),
    has: (_, key) => key in inputs(),
    ownKeys: () => Reflect.ownKeys(inputs()),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
  const root = createBrowserRoot(element, options);
  root.render(() => component(props));
  return {
    ...root,
    get disposed() {
      return root.disposed;
    },
    props,
    setInputs(next) {
      if (!root.disposed) setInputs((previous) => ({ ...previous, ...next }));
    },
    destroy: root.dispose,
  };
}
export interface IslandProps<P extends object> {
  readonly component: BrowserComponent<P>;
  readonly inputs: P;
  readonly class?: string;
  readonly services?: BrowserRootOptions['services'];
  readonly onError?: BrowserRootOptions['onError'];
  readonly document?: Document;
}
/** A Solid DOM page can embed shared universal components without sharing its DOM renderer. */
export function Island<P extends object>(props: IslandProps<P>): HTMLElement {
  const owner = getOwner();
  if (!owner) throw new Error('Island requires an active Solid owner.');
  const element = (props.document ?? document).createElement('solidnative-island');
  let current: MountResult<P> | undefined;
  let component: BrowserComponent<P> | undefined;
  createEffect(() => {
    const next = props.component;
    const inputs = { ...props.inputs };
    const className = props.class ?? '';
    untrack(() => {
      if (next !== component) {
        current?.dispose();
        current = undefined;
        component = next;
        current = mount(element, next, {
          inputs,
          island: true,
          owner,
          services: props.services,
          onError: props.onError,
        });
      } else current?.setInputs(inputs);
      element.className = className;
      if (current && !current.disposed) element.classList.add('platform-web');
    });
  });
  onCleanup(() => {
    current?.dispose();
    current = undefined;
  });
  return element;
}
