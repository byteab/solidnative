/**
 * The page `layout-browser.mjs` drives: `window.show(name)` mounts one fixture into a fresh element
 * (disposing the previous one) and exposes its state as `window.current`.
 */
import { createBrowserRoot, mount, type BrowserComponent } from '../../src/solid/index.ts';
import { button, events, textFields } from '../fixtures.solid.tsx';
import { breakpoints, cascade } from '../layout.solid.tsx';
import './styles.css';

const scenes: Record<string, () => { view: BrowserComponent<object> }> = {
  cascade,
  breakpoints: () => ({ view: breakpoints }),
  textFields,
  button,
  events,
};
let disposeCurrent: (() => void) | undefined;
const page = window as unknown as {
  show(name: string, options?: { asAnAppMounts?: boolean }): void;
  current: unknown;
  injectReset(document: Document): void;
};
/** What `mount` injects into a document by default, for the layer-order checks. */
page.injectReset = (target) => {
  const element = target.createElement('div');
  target.body.appendChild(element);
  createBrowserRoot(element).dispose();
  element.remove();
};
page.show = (name, { asAnAppMounts = false } = {}) => {
  disposeCurrent?.();
  document.querySelector('app-root')?.remove();
  const root = document.createElement('app-root');
  document.body.appendChild(root);
  const scene = scenes[name]!();
  const mounted = mount(root, scene.view, asAnAppMounts ? {} : { injectReset: false });
  disposeCurrent = () => mounted.dispose();
  page.current = scene;
};
