import type { Owner } from 'solid-js';
import { activeRoot } from './context.ts';

/** Solid's computation, as far as `quiet` reaches into it. */
interface Computation {
  fn?: (value: unknown) => unknown;
  owned: Computation[] | null;
}

const unchanged = (value: unknown): unknown => value;

/**
 * Stop an owner's computations from doing anything until it is disposed: one that re-runs hands
 * back the value it has and, reading nothing, unsubscribes itself. A removed row commonly derives
 * its data from the list it was removed from (`lines().find(...)!`), which would throw if it ran.
 * Solid never runs them, as it disposes the owner before they can; this is the cheap half of that
 * disposal, a walk with no unlinking, and the rest waits for the commit. It writes Solid's
 * internal `fn`, which every Solid 1.x computation has.
 */
function quiet(owner: Owner | null | undefined): void {
  const owned = (owner as unknown as Computation | null | undefined)?.owned;
  if (!owned) return;
  for (let i = 0; i < owned.length; i++) {
    const computation = owned[i]!;
    computation.fn = unchanged;
    if (computation.owned) quiet(computation as unknown as Owner);
  }
}

/** Dispose an owner whose nodes are leaving the screen: see `retirer`. */
export type Retire = (owner: Owner | null | undefined, dispose: () => void) => void;

const disposeNow: Retire = (_owner, dispose) => dispose();

/**
 * How to dispose owners whose nodes are being taken off screen, for the native root rendering
 * now: each is quieted at once and disposed after the commit that removes its nodes, as React
 * runs unmount effects after its commit, so that commit is not held up by the teardown
 * (`docs/mount-performance.md`). Outside a native root, at once.
 */
export function retirer(): Retire {
  const root = activeRoot();
  if (!root) return disposeNow;
  return (owner, dispose) => {
    quiet(owner);
    root.retire(dispose);
  };
}
