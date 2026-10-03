/**
 * What every jsdom test of a shared Solid component does first: a fresh document, a root in it,
 * and the component mounted through `mountBrowser` - the same path an app's `mount` takes.
 */
import { installJsdomEnvironment } from '../src/jsdom-env.ts';
import { mountBrowser, type BrowserRootOptions, type HostChild } from '../src/solid/index.ts';

export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export function boot(code: () => HostChild, options?: BrowserRootOptions) {
  const { document, window } = installJsdomEnvironment();
  const view = window as Window & typeof globalThis;
  const element = document.getElementById('app-root')!;
  const root = mountBrowser(code, element, options);
  /** By attribute rather than `#id`: jsdom answers an id selector from the whole document. */
  const byId = <T extends Element = HTMLElement>(id: string, within: ParentNode = element) => {
    const found = within.querySelector(`[id="${id}"]`);
    if (!found) throw new Error(`No element with id "${id}"`);
    return found as unknown as T;
  };
  const pointer = (target: Element, type: string, pointerId = 1) =>
    target.dispatchEvent(
      new (globalThis as unknown as typeof view).PointerEvent(type, { pointerId, bubbles: true }),
    );
  const press = (target: Element, pointerId = 1) => {
    pointer(target, 'pointerdown', pointerId);
    pointer(target, 'pointerup', pointerId);
  };
  const input = (field: HTMLTextAreaElement | HTMLInputElement, value: string) => {
    field.value = value;
    field.dispatchEvent(new view.Event('input', { bubbles: true }));
  };
  return { document, window: view, element, root, byId, pointer, press, input };
}
