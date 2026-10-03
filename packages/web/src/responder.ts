/**
 * The JS responder negotiation, over DOM pointer events instead of Fabric's raw touch stream.
 *
 * `packages/fabric/src/engine.ts` runs a two-phase election on every `topTouchStart`: a capture
 * pass root-to-target where an ancestor (a scroll view) can pre-empt, then a bubble pass
 * target-to-root where the innermost interested node wins. Exactly one node ever holds the
 * gesture, and a `grant` can be refused by `onResponderTerminationRequest`. This file is that
 * algorithm, ported line for line from `negotiate`/`grant`/`release` in `engine.ts`, over
 * `BrowserNode`'s `.parent` chain instead of `EngineNode`'s.
 *
 * ## What is faithfully reproduced
 *
 * The whole negotiation: capture pre-emption, bubble election, termination requests, and a
 * scroll view taking over a drag mid-press (`notifyScroll`, the counterpart of `engine.ts`'s
 * `cancelPressForScroll`). `pressable.test.ts`-equivalent scenarios - a pressable nested in a
 * scroll view nested in a dialog - behave the same on both platforms because this is the same
 * algorithm, not a different one that happens to agree on simple cases.
 *
 * ## What differs, and why
 *
 * There is no native side to tell who currently owns the gesture (`tellNative`/`setIsJSResponder`
 * in `engine.ts`): a DOM scroll container has no separate "JS responder" concept to defer to, it
 * simply does not receive the pointer events this system does not propagate to it as a drag. So
 * `blockNativeResponder` is accepted (for API parity - a component that sets it does not break)
 * and does nothing, which is a real gap only for a native scroll gesture that would otherwise
 * fight a JS one; on the web the browser's own scroll only starts from events this system's
 * `setPointerCapture` call (`browser-engine.ts`) already keeps from reaching it while a responder
 * holds the gesture.
 *
 * `notifyScroll`'s cancellation is coarser than `engine.ts`'s: native tells the responder system
 * apart a real drag from a momentum settle or a programmatic `scrollTo` because it is the same
 * code sending both `topScroll` and `topScrollBeginDrag`. A DOM `scroll` event carries no such
 * distinction, so this cancels on the first `scroll` a descendant responder sees, drag or not.
 * The one case that reads differently: a programmatic `scrollTo()` call that happens to run while
 * something inside that scroll view is mid-press will cancel the press on the web and not on
 * native. Narrow, and named here rather than found by a user later.
 */
import { SyntheticEvent, type ResponderEvent, type ResponderHandlers } from '@solid-native/fabric';
import { type BrowserNode, pathTo } from './dom-node.ts';

export class ResponderSystem {
  private readonly responders = new WeakMap<BrowserNode, ResponderHandlers>();
  private current: BrowserNode | null = null;

  get responder(): BrowserNode | null {
    return this.current;
  }

  /** Whether `node` takes part in the negotiation at all: a control, rather than a plain view. */
  responds(node: BrowserNode): boolean {
    return this.responders.has(node);
  }

  setResponder(node: BrowserNode, handlers: ResponderHandlers): () => void {
    this.responders.set(node, handlers);
    return () => {
      this.responders.delete(node);
      if (this.current !== node) return;
      // Torn down mid-gesture: no release is coming, so the responder is cleared here or the
      // negotiation would believe forever that a node no longer registered still holds it.
      this.current = null;
    };
  }

  /** Root-first capture, then target-first bubble. Mirrors `engine.ts`'s `negotiate`. */
  private negotiate(
    target: BrowserNode,
    event: ResponderEvent,
    phase: 'Start' | 'Move',
  ): BrowserNode | null {
    const path = pathTo(target);
    const capture = `on${phase}ShouldSetResponderCapture` as const;
    const bubble = `on${phase}ShouldSetResponder` as const;

    for (const node of path) {
      if (this.responders.get(node)?.[capture]?.(event, target as never)) return node;
    }
    for (let i = path.length - 1; i >= 0; i--) {
      if (this.responders.get(path[i]!)?.[bubble]?.(event, target as never)) return path[i]!;
    }
    return null;
  }

  private grant(node: BrowserNode, event: ResponderEvent): void {
    const previous = this.current;
    if (previous === node) return;

    if (previous) {
      const handlers = this.responders.get(previous);
      // `undefined` means yes: RN's default is to allow the takeover.
      if (handlers?.onResponderTerminationRequest?.(event) === false) return;
      handlers?.onResponderTerminate?.(event);
    }

    this.current = node;
    this.responders.get(node)?.onResponderGrant?.(event);
  }

  private release(event: ResponderEvent, terminated: boolean): void {
    const node = this.current;
    if (!node) return;
    this.current = null;
    const handlers = this.responders.get(node);
    if (terminated) handlers?.onResponderTerminate?.(event);
    else handlers?.onResponderRelease?.(event);
  }

  /** Drives the negotiation from a synthesised `topTouchStart`/`Move`/`End`/`Cancel`. */
  runResponder(target: BrowserNode, type: string, event: ResponderEvent): void {
    if (type === 'topTouchStart') {
      const elected = this.negotiate(target, event, 'Start');
      if (elected) this.grant(elected, event);
      return;
    }
    if (type === 'topTouchMove') {
      if (this.current) this.responders.get(this.current)?.onResponderMove?.(event);
      else {
        const elected = this.negotiate(target, event, 'Move');
        if (elected) this.grant(elected, event);
      }
      return;
    }
    if (type === 'topTouchEnd') this.release(event, false);
    else if (type === 'topTouchCancel') this.release(event, true);
  }

  /** A scroll container moved under the finger. Cancels a press inside it; see the file doc. */
  notifyScroll(scrollNode: BrowserNode): void {
    const responder = this.current;
    if (!responder || responder === scrollNode) return;
    for (let node: BrowserNode | null = responder; node; node = node.parent) {
      if (node === scrollNode) {
        this.release(new SyntheticEvent({}), true);
        return;
      }
    }
  }
}
