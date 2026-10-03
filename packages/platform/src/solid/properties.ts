import { getOwner, runWithOwner } from 'solid-js';
import type { EngineNode, ResponderHandlers } from '@solid-native/fabric';
import { isLive, lifetimeOf, NodeLifetime, onNativeCleanup, rootOf } from './context.ts';
import { setStyleProperty } from './styles.ts';

function eventName(name: string): string | null {
  // Most props are not events: settle those on the first two characters, before any regex.
  if (name.charCodeAt(0) !== 111 || name.charCodeAt(1) !== 110) return null;
  if (name.startsWith('on:')) return name.slice(3);
  return /^on[A-Z]/.test(name) ? `top${name.slice(2)}` : null;
}

function setListener(node: EngineNode, name: string, value: unknown): void {
  const lifetime = lifetimeOf(node);
  const previous = lifetime.listeners?.get(name);
  if (previous?.value === value) return;
  previous?.remove();
  lifetime.listeners?.delete(name);
  if (value == null) return;
  if (typeof value !== 'function') throw new TypeError(`${name} must be a callback.`);
  // The node's own owner, not the binding effect's: a handler that writes a signal the binding
  // reads re-runs that effect, which would cancel whatever the handler just registered (a measure,
  // an afterCommit) through its cleanups.
  const owner = lifetime.owner ?? getOwner();
  // Not a native cleanup as well: destroying the node drops every listener it has
  // (`Engine.destroyNode`), so the unsubscribe is needed only when the handler changes.
  const remove = lifetime.root.engine.setEventListener(node, name, (event) => {
    if (lifetime.active && !lifetime.root.disposed) runWithOwner(owner, () => value(event));
  });
  (lifetime.listeners ??= new Map()).set(name, { value, remove });
}

function setResponder(node: EngineNode, value: unknown): void {
  const lifetime = lifetimeOf(node);
  const previous = lifetime.listeners?.get('responder');
  if (previous?.value === value) return;
  previous?.remove();
  lifetime.listeners?.delete('responder');
  if (value == null) return;
  const remove = onNativeCleanup(
    node,
    lifetime.root.engine.setResponder(node, value as ResponderHandlers),
  );
  (lifetime.listeners ??= new Map()).set('responder', { value, remove });
}

/** Whether a node has a listener for an event, without making it a lifetime to ask. */
function listens(node: EngineNode, event: string): boolean {
  const data = node.hostData;
  return data instanceof NodeLifetime && data.listeners?.has(event) === true;
}

export function setProperty(node: EngineNode, name: string, value: unknown): void {
  if (!isLive(node)) return;
  const engine = rootOf(node).engine;
  if (setStyleProperty(engine, node, name, value)) return;
  const event = eventName(name);
  // An `on…` name is an event only when it carries a handler (or clears one): native views also
  // have plain props spelled that way, such as the iOS switch's `onTintColor` color.
  if (event && (typeof value === 'function' || listens(node, event)))
    setListener(node, event, value);
  else if (name === 'responder') setResponder(node, value);
  else engine.setProp(node, name, value);
}
