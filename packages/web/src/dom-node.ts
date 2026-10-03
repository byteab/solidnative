/**
 * The retained node the Solid browser host creates for each element, text and anchor, and the
 * thing every `HostEngine` method actually operates on.
 *
 * `packages/fabric/src/engine.ts`'s `EngineNode` is not reusable here (its constructor-free shape
 * still carries Fabric-only bookkeeping - `committed`, `styleCache`, `sheet`...), but the shared
 * components never ask for that: they ask for `HostNode`'s five fields - `kind`, `props`, `text`,
 * `children` and `parent` - so a node that implements `HostNode` honestly, backed by a real DOM
 * node, satisfies every one of them without a cast.
 *
 * `children`/`parent` are maintained by hand rather than read live off the DOM (`el.parentElement`,
 * `el.childNodes`) for the same reason `Engine` keeps its own tree: a live DOM walk would have to
 * filter out nodes this package did not create (there are none today, but a consumer's own
 * `document.createElement` inside a projected template is not this package's to assume against),
 * and a walk over `children` wants exactly the nodes the renderer put here, in order.
 */
import type { HostNode } from '@solidnative/fabric';

export type BrowserNodeKind = 'element' | 'text' | 'anchor';

export interface BrowserNode extends HostNode {
  readonly kind: BrowserNodeKind;
  /** The real DOM node this wraps. An `Element` for `element`, a `Text` for `text`. */
  readonly el: Element | Text | Comment;
  /** Lowercase template spelling, e.g. `view`. Mirrors `EngineNode.name`; never the DOM tag. */
  readonly name: string;
  /** `name` again on an element, for code that reads a DOM-style tag off a host node. */
  readonly tagName?: string;
  props: Record<string, unknown>;
  text: string;
  children: BrowserNode[];
  parent: BrowserNode | null;
  /**
   * Registered listeners, by top-level type (`topTouchStart`, `topChange`, ...). `null` until
   * the first one, so a node nothing ever listens to costs one field rather than one `Map`.
   */
  listeners: Map<string, Set<(event: unknown) => void>> | null;
  /**
   * Which opt-in event types (`topLayout`, `topPointerEnter`, `topPointerLeave`) already have
   * their real DOM listener installed - `browser-engine.ts`'s `wireOptIn` guard. `null` until
   * the first one, matching `listeners` above.
   */
  optedIn: Set<string> | null;
}

/** `event.target`, and anything else holding a real DOM node, back to the `BrowserNode` for it. */
const registry = new WeakMap<Element | Text | Comment, BrowserNode>();

/**
 * The SVG names whose `fill`/`stroke` need a seeded `props` entry from the moment they are
 * created - see the block below for why. `svg-line` is left out: a `<line>` has no fill of its
 * own to paint (react-native-svg's `Line` never reads `fill` either), so there is nothing an
 * explicit `fill="none"` there could mean.
 */
const SVG_BRUSH_ELEMENTS = new Set(['svg-g', 'svg-path', 'svg-circle', 'svg-ellipse', 'svg-rect']);

export function makeElementNode(name: string, el: Element): BrowserNode {
  const props: Record<string, unknown> = {};
  // `packages/icons/src/svg-props.ts`'s `brushOf` turns a literal `fill="none"`/`stroke="none"`
  // into `null` - a real, meaningful value ("paint nothing"), not an absent one. But
  // `BrowserEngine.setProp` treats `null` exactly like `undefined` on a key it has never seen
  // before: `if (!(key in node.props)) return;`, its fast path for "nothing to remove, so nothing
  // changed". That path is right for almost everything a `null` prop could mean, and wrong here -
  // it would skip `applyProp` entirely on a chart line's `fill="none"` (`chart-line.ts`,
  // `chart-area.ts`), leaving the attribute unset, and an unset `fill` defaults to opaque black in
  // a browser (the real SVG initial value) rather than to unpainted (what react-native-svg's own
  // `propList` convention, and every one of these charts, is relying on). Seeding the key here -
  // present, value `undefined` - costs nothing on a shape that never touches the prop again, and
  // is what lets that first `null` reach `props.ts`'s real translation instead of being dropped by
  // the fast path. See `props.ts`'s `applyBrush` for the other half: it is what turns a seeded
  // key's `null` into a written `fill="none"`/`stroke="none"` rather than a removed attribute.
  if (SVG_BRUSH_ELEMENTS.has(name)) {
    props['fill'] = undefined;
    props['stroke'] = undefined;
  }
  const node: BrowserNode = {
    kind: 'element',
    el,
    name,
    tagName: name,
    props,
    text: '',
    children: [],
    parent: null,
    listeners: null,
    optedIn: null,
  };
  registry.set(el, node);
  return node;
}

export function makeTextNode(text: Text): BrowserNode {
  const node: BrowserNode = {
    kind: 'text',
    el: text,
    name: '#text',
    props: {},
    text: text.data,
    children: [],
    parent: null,
    listeners: null,
    optedIn: null,
  };
  registry.set(text, node);
  return node;
}

/** A position marker the renderer keeps (an empty `Show`, say), backed by a real `Comment`. */
export function makeAnchorNode(comment: Comment): BrowserNode {
  const node: BrowserNode = {
    kind: 'anchor',
    el: comment,
    name: '#anchor',
    props: {},
    text: '',
    children: [],
    parent: null,
    listeners: null,
    optedIn: null,
  };
  registry.set(comment, node);
  return node;
}

/** The `BrowserNode` a real DOM node was created with, or `null` for one this package did not make. */
export function nodeOf(el: Element | Text | Comment | null): BrowserNode | null {
  return el ? (registry.get(el) ?? null) : null;
}

/**
 * The nearest `BrowserNode` starting at a real `Element` and walking up `parentElement`.
 *
 * Used to resolve `event.target` for events this package listens for on `document` rather than
 * per-node (the responder system's pointer events, focus/blur, selection change): the physical
 * hit is always a real element this package created, but it is not always one with its own
 * listeners, so the search has to climb past any that are not tracked before it gets to `body`
 * and turns up nothing.
 */
export function nearestNodeOf(el: Element | null): BrowserNode | null {
  for (let current = el; current; current = current.parentElement) {
    const node = registry.get(current);
    if (node) return node;
  }
  return null;
}

/** Root-first path from the tree's root to `node`, inclusive. Mirrors `Engine`'s own `pathTo`. */
export function pathTo(node: BrowserNode): BrowserNode[] {
  const path: BrowserNode[] = [];
  for (let current: BrowserNode | null = node; current; current = current.parent)
    path.push(current);
  return path.reverse();
}
