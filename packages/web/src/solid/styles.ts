import { createComponent, createContext, useContext } from 'solid-js';
import type { HostNode } from '@solidnative/fabric';
import type { BrowserNode } from '../dom-node.ts';
import { contextOf, currentBrowser } from './context.ts';

/** Build-time browser CSS data; never a native Engine stylesheet interpreted at runtime. */
export interface BrowserStyleSheet {
  readonly browser: true;
  readonly id: string;
  readonly css: string;
}
const styles = createContext<BrowserStyleSheet | null>(null);
const documents = new WeakMap<
  Document,
  Map<string, { css: string; node: HTMLStyleElement; refs: number }>
>();
const leases = new WeakMap<object, Set<string>>();
const hosts = new WeakMap<HostNode, string>();
function sheetOf(value: unknown): BrowserStyleSheet | null {
  if (value == null) return null;
  const sheet = value as BrowserStyleSheet;
  if (sheet.browser !== true || !/^[a-z0-9-]+$/.test(sheet.id) || typeof sheet.css !== 'string')
    throw new Error('Browser styles require the Solid browser CSS compiler.');
  return sheet;
}
function acquire(sheet: BrowserStyleSheet): void {
  const context = currentBrowser();
  let owned = leases.get(context);
  if (!owned) leases.set(context, (owned = new Set()));
  const document = context.root.el.ownerDocument!;
  let sheets = documents.get(document);
  if (!sheets) documents.set(document, (sheets = new Map()));
  let entry = sheets.get(sheet.id);
  if (entry && entry.css !== sheet.css)
    throw new Error(`Conflicting browser stylesheet: ${sheet.id}`);
  if (owned.has(sheet.id)) return;
  if (!entry) {
    const node = document.createElement('style');
    node.setAttribute('data-solid-native-style', sheet.id);
    node.textContent = sheet.css;
    document.head.appendChild(node);
    sheets.set(sheet.id, (entry = { css: sheet.css, node, refs: 0 }));
  }
  entry.refs++;
  owned.add(sheet.id);
  context.cleanup(context.root, () => {
    if (--entry!.refs === 0) {
      entry!.node.remove();
      sheets!.delete(sheet.id);
    }
    owned!.delete(sheet.id);
  });
}
export function withNativeStyles<T>(value: unknown, render: () => T): T {
  const sheet = sheetOf(value);
  if (sheet) acquire(sheet);
  let result!: T;
  createComponent(styles.Provider, {
    value: sheet,
    get children() {
      result = render();
      return undefined;
    },
  });
  return result;
}
export function stampStyle(node: BrowserNode): void {
  const sheet = useContext(styles);
  if (sheet) (node.el as Element).setAttribute(`data-s-${sheet.id}`, '');
}
export function setNativeStyleHost(node: HostNode, value: unknown): void {
  const browserNode = node as BrowserNode;
  const context = contextOf(browserNode);
  if (context.disposed || !context.owns(node)) return;
  const sheet = sheetOf(value);
  // Acquire first: an invalid/conflicting replacement must preserve the previous host.
  if (sheet) acquire(sheet);
  const previous = hosts.get(node);
  if (previous) (browserNode.el as Element).removeAttribute(`data-h-${previous}`);
  hosts.delete(node);
  if (sheet) {
    (browserNode.el as Element).setAttribute(`data-h-${sheet.id}`, '');
    hosts.set(node, sheet.id);
  }
}
