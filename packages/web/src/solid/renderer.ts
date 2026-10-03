import { createRenderer } from 'solid-js/universal';
import { getOwner, runWithOwner } from 'solid-js';
import type { ResponderHandlers } from '@solid-native/fabric';
import type { BrowserNode } from '../dom-node.ts';
import { contextOf, currentBrowser } from './context.ts';
import { stampStyle } from './styles.ts';

function detach(node: BrowserNode): void {
  if (!node.parent) return;
  const index = node.parent.children.indexOf(node);
  if (index >= 0) node.parent.children.splice(index, 1);
  node.parent = null;
  node.el.parentNode?.removeChild(node.el);
}
const bindings = new WeakMap<BrowserNode, Map<string, () => void>>();
const classes = new WeakMap<BrowserNode, { base: string; list: Record<string, boolean> }>();
const inline = new WeakMap<
  BrowserNode,
  { base: Record<string, unknown>; keys: Record<string, unknown> }
>();
function styleObject(
  node: BrowserNode,
  value: unknown,
  result: Record<string, unknown> = {},
): Record<string, unknown> {
  if (Array.isArray(value)) {
    for (const item of value) styleObject(node, item, result);
  } else if (typeof value === 'string') {
    const style = node.el.ownerDocument!.createElement('div').style;
    style.cssText = value;
    for (const key of Array.from(style)) result[key] = style.getPropertyValue(key);
  } else if (value && typeof value === 'object') Object.assign(result, value);
  return result;
}
function setClasses(node: BrowserNode, name: string, value: unknown): void {
  const state = classes.get(node) ?? { base: '', list: {} };
  if (name === 'classList') state.list = (value ?? {}) as Record<string, boolean>;
  else state.base = String(value ?? '');
  classes.set(node, state);
  (node.el as Element).setAttribute(
    'class',
    [state.base, ...Object.keys(state.list).filter((k) => state.list[k])].join(' ').trim(),
  );
}
function setStyle(node: BrowserNode, name: string, value: unknown): boolean {
  if (name === 'class' || name === 'className' || name === 'classList') {
    setClasses(node, name, value);
    return true;
  }
  if (name !== 'style' && !name.startsWith('style:') && !name.startsWith('--')) return false;
  const state = inline.get(node) ?? { base: {}, keys: {} };
  if (name === 'style') state.base = styleObject(node, value);
  else state.keys[name.startsWith('style:') ? name.slice(6) : name] = value;
  inline.set(node, state);
  contextOf(node).engine.setProp(node, 'style', { ...state.base, ...state.keys });
  return true;
}
function setBinding(node: BrowserNode, name: string, value: unknown): void {
  const context = contextOf(node);
  let map = bindings.get(node);
  if (!map) bindings.set(node, (map = new Map()));
  map.get(name)?.();
  map.delete(name);
  if (value == null) return;
  const owner = getOwner();
  const remove =
    name === 'responder'
      ? context.engine.setResponder(node, value as ResponderHandlers)
      : context.engine.setEventListener(node, name, (event) => {
          if (!context.disposed && context.owns(node))
            runWithOwner(owner, () => (value as (event: unknown) => void)(event));
        });
  map.set(name, context.cleanup(node, remove));
}
function foreignAnchor(parent: BrowserNode, anchor: BrowserNode | undefined): boolean {
  return !!anchor && (contextOf(anchor) !== contextOf(parent) || anchor.parent !== parent);
}
export const renderer = createRenderer<BrowserNode>({
  createElement(name) {
    const context = currentBrowser();
    const node = context.own(context.engine.createElementNode(name));
    stampStyle(node);
    return node;
  },
  createTextNode(value) {
    const context = currentBrowser();
    return context.own(context.engine.createTextNode(String(value)));
  },
  replaceText(node, value) {
    if (contextOf(node).disposed) return;
    node.text = String(value);
    (node.el as Text).data = node.text;
  },
  isTextNode: (node) => node.kind === 'text',
  setProperty(node, name, value) {
    const context = contextOf(node);
    if (context.disposed || !context.owns(node)) return;
    if (setStyle(node, name, value)) return;
    if (name === 'responder') setBinding(node, name, value);
    else if (name.startsWith('on:')) setBinding(node, name.slice(3), value);
    else if (/^on[A-Z]/.test(name)) setBinding(node, `top${name.slice(2)}`, value);
    else context.engine.setProp(node, name, value);
  },
  insertNode(parent, node, anchor) {
    const context = contextOf(node);
    if (context.disposed || !context.owns(node)) return;
    if (contextOf(parent) !== context || foreignAnchor(parent, anchor))
      throw new Error('Cannot insert nodes across browser roots or use a foreign anchor.');
    if (node === anchor) return;
    for (let current: BrowserNode | null = parent; current; current = current.parent)
      if (current === node) throw new Error('Cannot insert a browser node into its descendant.');
    detach(node);
    const index = anchor ? parent.children.indexOf(anchor) : parent.children.length;
    parent.children.splice(index, 0, node);
    node.parent = parent;
    parent.el.insertBefore(node.el, anchor?.el ?? null);
  },
  removeNode(parent, node) {
    if (node.parent === parent) detach(node);
  },
  getParentNode: (node) => node.parent ?? undefined,
  getFirstChild: (node) => node.children[0],
  getNextSibling: (node) => node.parent?.children[node.parent.children.indexOf(node) + 1],
});
export function spread<T>(
  node: BrowserNode,
  accessor: T | (() => T),
  skipChildren?: boolean,
): void {
  let previous = new Set<string>();
  renderer.spread(
    node,
    () => {
      const value = typeof accessor === 'function' ? (accessor as () => T)() : accessor;
      const props = { ...(value as Record<string, unknown>) };
      const keys = new Set(Object.keys(props));
      for (const key of previous) if (!keys.has(key)) props[key] = undefined;
      previous = keys;
      return props;
    },
    skipChildren,
  );
}
