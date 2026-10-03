/**
 * The contract the shared packages actually depend on, rather than the Fabric implementation.
 *
 * `@solid-native/components` is meant to be renderer-agnostic: it describes a view and a press, and
 * leaves the drawing to a host. In practice they were coupled to Fabric twice over - the `Engine`,
 * which is a concrete class whose constructor wants a `FabricUIManager`, and `EngineNode`, which is
 * a Fabric tree node. A web prototype could only satisfy both by casting a hand-written object
 * through `as unknown as Engine`, which typechecks and tells you nothing.
 *
 * So this is the seam, measured rather than guessed: every `engine.*` call and every `node.*`
 * field those three packages actually make, and nothing else. `Engine` implements `HostEngine` and
 * `EngineNode` extends `HostNode`, so nothing about the native path changes; a browser host
 * implements the same two and needs no cast.
 *
 * It lives in this package because everything already imports from here and importing it costs a
 * web build nothing - the Fabric bindings are reached lazily, through a global the browser does
 * not have. If that stops being true, moving these two declarations to a package of their own is
 * mechanical: nothing here refers to Fabric.
 *
 * ## What is deliberately not in it
 *
 * `tagOf` and `shadowNodeOf` hand out Fabric's own handles, for Reanimated worklets and
 * react-native-gesture-handler. The three components that use them - `worklet-style`,
 * `worklet-scroll` and `native-gesture` - inject the concrete `Engine` and are native-only by
 * nature, which is the honest place to draw that line rather than pretending a browser could
 * answer.
 */
import type {
  DrivenProperty,
  EventFeed,
  ScrollAxis,
  ScrollDrive,
  ScrollRange,
  StaticTransform,
} from './native-drive.ts';
import type { ResponderHandlers, WindowFrame } from './engine.ts';

/** What a host node has to be able to answer. `EngineNode` and a DOM element both can. */
export interface HostNode {
  /** `element` or `text`, so a caller can tell a node from the words inside it. */
  readonly kind: string;
  /**
   * The props the host is holding for this node.
   *
   * A real bag rather than an accessor, so a host can delete from it: a prop the component
   * consumes itself has to stop being an attribute the host writes through.
   */
  props: Record<string, unknown>;
  /** The text, when `kind` is `text`. Empty otherwise. */
  text: string;
  children: readonly HostNode[];
  parent: HostNode | null;
  /**
   * Set by `claimHost` when a host primitive creates its element, so a host can tell an element a
   * component owns from a bare one somebody wrote by hand.
   *
   * Part of the contract rather than a Fabric detail, because the shared packages are what set it:
   * the components' `primitiveNode` calls `claimHost` on every element it creates. What a host does
   * with it is its own business - Fabric warns about an unclaimed primitive name, and a browser has
   * nothing to warn about.
   */
  claimed?: true;
  /**
   * The engine that made this node, when the host can say. Code holding only the node reads it
   * to check the node belongs to the engine it is about to call (a node from another root, or
   * another host, must not reach it). A host whose nodes cannot carry it leaves it out.
   */
  readonly host?: HostEngine;
}

/**
 * What a host has to be able to do.
 *
 * An abstract class rather than an interface, so the optional operations below come with a
 * default that does nothing, and a host implements only what it has.
 */
export abstract class HostEngine {
  /** Write a prop. `undefined` and `null` both clear it, which is how native says "default". */
  abstract setProp(node: HostNode, key: string, value: unknown): void;
  /** Listen for one of the host's own events. Returns its own teardown. */
  abstract setEventListener(
    node: HostNode,
    topLevelType: string,
    fn: (event: unknown) => void,
  ): () => void;
  /** Claim gestures on a node, through whatever arbitration the host has. */
  abstract setResponder(node: HostNode, handlers: ResponderHandlers): () => void;
  /** Where the node is on screen, asynchronously, because native answers on its own thread. */
  abstract measure(node: HostNode, into: (frame: WindowFrame) => void): void;
  /** Tell a native view to do something imperative: scroll, focus, blur. */
  abstract dispatchCommand(node: HostNode, name: string, args?: readonly unknown[]): void;
  /** Flush pending work. Native batches; a browser may not need to. */
  abstract commit(): boolean;
  /** The node holding focus, or null. Verified to still be attached before it is handed back. */
  abstract get focused(): HostNode | null;
  /** Turn whatever an app passed as an image source into what the host wants. */
  abstract resolveAsset(value: unknown): unknown;
  /** Turn a colour the app wrote into whatever the host draws with. */
  abstract color(value: unknown): unknown;

  /**
   * Measure a node again from what native now holds for it, in a commit of its own. For a host
   * that measures when content changes, as a browser does, there is nothing to do.
   */
  remeasure(_node: HostNode): void {}

  /**
   * Take the user to a node: a text input gets the cursor, and anything else is brought on
   * screen. What a DOM element's own `focus()` does, for code that calls it on an element.
   */
  focus(_node: HostNode): void {}

  /**
   * Scroll whatever the node is in just far enough to show all of it; `visibleBottom` is where in
   * the window the visible area ends, when something such as the keyboard covers its bottom.
   */
  reveal(_node: HostNode, _options?: { visibleBottom?: number; margin?: number }): void {}

  /** Whether `driveByScroll` moves views on the native side. A host without it moves nothing. */
  get drivesScroll(): boolean {
    return false;
  }

  /**
   * Move `view` by `scroll`'s offset along `axis` on the native side, through `range`, keeping
   * `statics` in its transform. Null when the host cannot, and the caller moves the view itself.
   */
  driveByScroll(
    _view: HostNode,
    _scroll: HostNode,
    _axis: ScrollAxis,
    _range: ScrollRange,
    _statics?: readonly StaticTransform[],
  ): ScrollDrive | null {
    return null;
  }

  /**
   * Move `view` by a value `source`'s native events carry, such as a keyboard's height, on the
   * native side, plus `shift` when one is given, which `ScrollDrive.shift` changes. Null when the
   * host cannot. See `driveByScroll`.
   */
  driveByEvent(
    _view: HostNode,
    _source: HostNode,
    _feed: EventFeed,
    _property: DrivenProperty,
    _range: ScrollRange,
    _statics?: readonly StaticTransform[],
    _shift?: number | null,
  ): ScrollDrive | null {
    return null;
  }
}
