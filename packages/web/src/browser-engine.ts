/**
 * `HostEngine` over real DOM APIs: the browser counterpart to `packages/fabric/src/engine.ts`'s
 * `Engine`.
 *
 * One instance per `mount()` call. It owns the prop/DOM translation (`props.ts`), the element
 * mapping (`elements.ts`), and the responder negotiation (`responder.ts`); this file is mostly
 * the wiring between them and the handful of DOM event listeners the whole tree shares - one
 * `pointerdown`/`pointermove`/`pointerup`/`pointercancel` set on `document` for the responder
 * system, one `focusin`/`focusout` set for `:focus` tracking, because both need to see every
 * node's events rather than each node installing its own (Fabric's own engine is exactly this
 * shape: one `registerEventHandler` callback for the whole tree, not one per view).
 *
 * `dispatchEvent` mirrors `engine.ts`'s method of the same name step for step: run the responder
 * negotiation first, then propagate to whatever `(eventName)` bindings are listening, in the
 * same two-phase order a real touch would arrive in on native.
 */
import {
  HostEngine,
  SyntheticEvent,
  type ResponderEvent,
  type ResponderHandlers,
  type WindowFrame,
} from '@solidnative/fabric';
import {
  makeAnchorNode,
  makeElementNode,
  makeTextNode,
  nearestNodeOf,
  nodeOf,
  type BrowserNode,
} from './dom-node.ts';
import { createDomElement } from './elements.ts';
import { applyProp } from './props.ts';
import { ResponderSystem } from './responder.ts';

/**
 * Events that reach only their target, never its ancestors. Ported from `engine.ts`'s own
 * `DIRECT_EVENTS`: a layout, a load, a scroll offset or a content size is meaningless to
 * anything but the view it happened on, so bubbling it would let an ancestor's same-named
 * listener - a scroll view inside a scroll view - fire for the wrong one.
 */
const DIRECT_EVENTS = new Set([
  'topScroll',
  'topScrollBeginDrag',
  'topScrollEndDrag',
  'topMomentumScrollBegin',
  'topMomentumScrollEnd',
  'topContentSizeChange',
  'topLayout',
  'topLoad',
  'topLoadStart',
  'topLoadEnd',
  'topError',
  'topProgress',
  'topRefresh',
]);

const TOUCH_EVENT_NAMES: Record<string, string> = {
  pointerdown: 'topTouchStart',
  pointermove: 'topTouchMove',
  pointerup: 'topTouchEnd',
  pointercancel: 'topTouchCancel',
};

function scrollToEnd(el: HTMLElement, args: readonly unknown[]): void {
  const [animated = true] = args as [boolean?];
  const horizontal = el.scrollWidth > el.clientWidth && el.scrollHeight <= el.clientHeight;
  el.scrollTo(
    horizontal
      ? { left: el.scrollWidth, behavior: animated ? 'smooth' : 'auto' }
      : { top: el.scrollHeight, behavior: animated ? 'smooth' : 'auto' },
  );
}

function setTextAndSelection(el: HTMLElement, args: readonly unknown[]): void {
  const [, text, start, end] = args as [number, string | null, number, number];
  const textarea = el as HTMLTextAreaElement;
  if (text !== null && text !== undefined) textarea.value = text;
  if (start !== -1) textarea.setSelectionRange(start, end === -1 ? start : end);
}

/**
 * View commands, by name. A lookup table for the same reason `props.ts`'s tables are one: it is
 * where a review sees which commands do something and which do not, in one place, rather than
 * spread across a `switch`'s branches.
 *
 * `flashScrollIndicators`, `zoomToRect`, `hotspotUpdate`, `setPressed`, `setNativeRefreshing`:
 * no web equivalent (a browser's scrollbar has no imperative "flash", pinch-zoom is not
 * scriptable, and there is no Android ripple to drive) - absent rather than a `noop` entry,
 * because unlike a prop there is no generic fallback for a command name to fall through to; an
 * absent command is already silently ignored below.
 */
const COMMANDS: Record<string, (el: HTMLElement, args: readonly unknown[]) => void> = {
  focus: (el) => el.focus(),
  blur: (el) => el.blur(),
  scrollTo: (el, args) => {
    const [x = 0, y = 0, animated = true] = args as [number?, number?, boolean?];
    el.scrollTo({ left: x, top: y, behavior: animated ? 'smooth' : 'auto' });
  },
  scrollToEnd,
  setTextAndSelection,
  // `<switch>` putting back a flip the app refused; the checkbox is what the user clicked.
  setValue: (el, [value]) => {
    (el as HTMLInputElement).checked = value === true;
  },
};

/**
 * The events this engine owns, which are React Native's rather than the DOM's.
 *
 * Each is either synthesised here from something else - `topLayout` from a `ResizeObserver`,
 * `topTouch*` from pointer events, `topFocus` from `focusin` - or not implemented yet. Either way
 * a handler bound to one expects React Native's `{ nativeEvent }` payload with React Native's own
 * fields in it, so they must not be wired straight to the DOM event of the same name: a
 * `scroll-view`'s `(scroll)` reads `nativeEvent.contentOffset`, and handing it a raw DOM `Event`
 * would turn a binding that quietly does nothing into one that throws on the first scroll.
 *
 * The list is the events `@solidnative/components` actually binds, found by
 * reading their host and template bindings rather than guessed. Anything outside it is a plain
 * DOM event and is bound as one.
 *
 * `topLoad` and `topError` are deliberately *not* here, though an `<image>` binds both. A
 * background image fires neither on its own, so `props.ts` loads the URL with a detached `Image()`
 * and dispatches a real DOM `load` or `error` on the element - which means there is a genuine DOM
 * event of each name to bind, and the general path is the right one. Reserving them was what left
 * a broken image URL blank rather than showing a fallback.
 */
const ENGINE_EVENTS = new Set([
  'topLayout',
  'topChange',
  'topContentSizeChange',
  'topRefresh',
  'topScroll',
  'topEndReached',
  'topSelectionChange',
  'topMomentumScrollBegin',
  'topMomentumScrollEnd',
  'topTouchStart',
  'topTouchMove',
  'topTouchEnd',
  'topTouchCancel',
  'topFocus',
  'topBlur',
  'topPointerEnter',
  'topPointerLeave',
]);

export class BrowserEngine extends HostEngine {
  private readonly document: Document;
  private readonly responders = new ResponderSystem();
  private focusedNode: BrowserNode | null = null;
  /** `TextInput`'s echo protocol: a change count that only ever goes up. One counter per field. */
  private readonly eventCounts = new WeakMap<BrowserNode, number>();
  /** Mount points `wrapRoot` wrapped; see `isRoot`. */
  private readonly roots = new WeakSet<BrowserNode>();
  /**
   * The node each in-progress gesture began on, by `pointerId`, so `pointermove`/`pointerup`
   * resolve to the same node however far the finger has travelled - `setPointerCapture` keeps
   * the browser routing them there; this is what this class trusts instead of re-reading
   * `event.target`. Keyed by `pointerId` rather than holding just one, so two fingers on two
   * different controls (a phone reports multi-touch) do not clobber each other.
   */
  private readonly activeTouches = new Map<number, BrowserNode>();
  /**
   * The element nodes this engine made, and so the only ones its document listeners act for.
   *
   * Every engine listens on the one `document`, and a page can hold several - one per island, or
   * the documentation site's three roots - while `nearestNodeOf` finds a node whichever engine
   * made it. Without this, each engine delivered every focus, blur and touch in any root on the
   * page, so a text field's `(blur)` ran once per island.
   */
  private readonly owned = new WeakSet<BrowserNode>();
  /** Removes the document listeners, once the app they served is gone; see `dispose`. */
  private readonly listening: AbortController;

  private readonly nodeResources = new Map<BrowserNode, Set<() => void>>();
  private disposed = false;
  private readonly report: (error: unknown) => void;

  constructor(document: Document, options: { onError?: (error: unknown) => void } = {}) {
    super();
    this.document = document;
    this.report = (error) => {
      try {
        (options.onError ?? console.error)(error);
      } catch {
        /* contain */
      }
    };
    // The document's own, so the signal is one its `addEventListener` recognises.
    this.listening = new (document.defaultView?.AbortController ?? AbortController)();
    this.installGlobalListeners();
  }

  /** Stop listening to the document. `mount` calls this as its app is destroyed. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listening.abort();
    this.activeTouches.clear();
    this.keyPress = null;
    this.focusedNode = null;
    for (const node of [...this.nodeResources.keys()]) this.destroyNode(node);
  }

  /** Release element listeners/observers independently of a retained detach or move. */
  destroyNode(node: BrowserNode): void {
    const resources = this.nodeResources.get(node);
    this.nodeResources.delete(node);
    if (resources)
      for (const cleanup of resources) {
        try {
          cleanup();
        } catch (error) {
          this.report(error);
        }
      }
    node.listeners?.clear();
    this.owned.delete(node);
    if (this.focusedNode === node) this.focusedNode = null;
    if (this.keyPress === node) this.keyPress = null;
    for (const [id, target] of this.activeTouches)
      if (target === node) this.activeTouches.delete(id);
  }

  private ownCleanup(node: BrowserNode, cleanup: () => void): void {
    let resources = this.nodeResources.get(node);
    if (!resources) this.nodeResources.set(node, (resources = new Set()));
    resources.add(cleanup);
  }

  private listen<K extends keyof HTMLElementEventMap>(
    node: BrowserNode,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ): void {
    const el = node.el as HTMLElement;
    el.addEventListener(type, listener);
    this.ownCleanup(node, () => el.removeEventListener(type, listener));
  }

  // --- element creation, called from BrowserRenderer ----------------------------------------

  createElementNode(name: string): BrowserNode {
    const el = createDomElement(this.document, name);
    const node = makeElementNode(name, el);
    this.owned.add(node);
    this.wireAlwaysOnListeners(node);
    return node;
  }

  createTextNode(value: string): BrowserNode {
    return makeTextNode(this.document.createTextNode(value));
  }

  createAnchorNode(): BrowserNode {
    return makeAnchorNode(this.document.createComment(''));
  }

  /** Wrap an existing real element - the app's own mount point - as the tree's root node. */
  wrapRoot(el: Element): BrowserNode {
    const node = makeElementNode(el.tagName.toLowerCase(), el);
    el.setAttribute('data-rn', 'root');
    this.roots.add(node);
    this.owned.add(node);
    return node;
  }

  /**
   * Whether `node` is a mount point `wrapRoot` wrapped. It belongs to whoever called `mount`, not
   * to the app rendered into it, so the renderer empties it rather than removing it.
   */
  isRoot(node: BrowserNode): boolean {
    return this.roots.has(node);
  }

  // --- HostEngine -----------------------------------------------------------------------------

  setProp(node: BrowserNode, key: string, value: unknown): void {
    const clear = value === undefined || value === null;
    if (clear) {
      if (!(key in node.props)) return;
      delete node.props[key];
    } else {
      if (node.props[key] === value) return;
      node.props[key] = value;
    }
    applyProp(node, key, value, clear);
  }

  setEventListener(
    node: BrowserNode,
    topLevelType: string,
    fn: (event: unknown) => void,
  ): () => void {
    const listeners = (node.listeners ??= new Map());
    let set = listeners.get(topLevelType);
    if (!set) listeners.set(topLevelType, (set = new Set()));
    set.add(fn);
    this.wireOptIn(node, topLevelType);
    return () => set!.delete(fn);
  }

  setResponder(node: BrowserNode, handlers: ResponderHandlers): () => void {
    const remove = this.responders.setResponder(node, handlers);
    this.ownCleanup(node, remove);
    return remove;
  }

  /**
   * Where a node is, relative to the mount root rather than to the viewport.
   *
   * `measureInWindow` on native answers in window coordinates, and the overlay host is a
   * full-screen absolutely positioned view at the window's origin, so the two agree and an
   * anchored overlay can use one as the other. `getBoundingClientRect` answers in *viewport*
   * coordinates, and `<overlay-host>` is absolutely positioned inside the mount root - so
   * those two agree only when the root sits at the top left of an unscrolled viewport.
   *
   * That is true of a full-page app, which is why every popover in the gallery lands correctly
   * and this went unnoticed. It is false in the two cases that matter: an app mounted into a box
   * partway down a page, where every overlay is offset by the box's own position, and a document
   * that scrolls, where the offset changes as you scroll. Subtracting the root's own rect from a
   * viewport-relative one cancels the scroll term as well as the offset, since both rects move
   * together as the page scrolls - so one subtraction fixes both cases at once.
   *
   * `closest`, not `querySelector`: a page can hold more than one mounted root at a time (the
   * documentation site's own home page does, three of them), and `querySelector` always answers
   * the first one in document order regardless of which root's own tree `node` actually lives in.
   * That made every root after the first measure its overlays against someone else's box.
   * `closest` walks up from the node itself, so each root only ever measures against its own.
   */
  measure(node: BrowserNode, into: (frame: WindowFrame) => void): void {
    const el = node.el as Element;
    const rect = el.getBoundingClientRect();
    const root = el.closest('[data-rn-root]');
    const origin = root ? root.getBoundingClientRect() : { x: 0, y: 0 };
    into({ x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height });
  }

  dispatchCommand(node: BrowserNode, name: string, args: readonly unknown[] = []): void {
    COMMANDS[name]?.(node.el as HTMLElement, args);
  }

  commit(): boolean {
    // Every write above already reached the DOM synchronously; there is nothing batched to flush.
    return false;
  }

  get focused(): BrowserNode | null {
    if (this.focusedNode && !this.isAttached(this.focusedNode)) this.focusedNode = null;
    return this.focusedNode;
  }

  private isAttached(node: BrowserNode): boolean {
    return (node.el as Element).isConnected;
  }

  /**
   * A `require()`d numeric asset has no web analogue - there is no bundler-provided asset
   * registry this package can read at runtime - so it resolves to nothing rather than a guess.
   * A `{uri}` source, or an array of them, passes through unchanged: `props.ts`'s image handler
   * reads it directly.
   */
  resolveAsset(value: unknown): unknown {
    if (typeof value === 'number') return undefined;
    return value;
  }

  /**
   * A colour the app wrote is passed straight through: CSS accepts the same hex/rgb/named
   * strings RN does. `platform-color(...)`'s semantic iOS/Android names have no web colour
   * system to resolve against, so they resolve to nothing rather than to a wrong guess.
   */
  color(value: unknown): unknown {
    if (value === undefined) return undefined;
    if (typeof value === 'object' && value !== null && 'platformColor' in value) return undefined;
    return value;
  }

  // --- event dispatch, mirrors engine.ts's `dispatchEvent` -----------------------------------

  dispatchEvent(target: BrowserNode, topLevelType: string, nativeEvent: unknown): void {
    if (this.disposed) return;
    const event = new SyntheticEvent(nativeEvent) as ResponderEvent & SyntheticEvent;
    if (topLevelType.startsWith('topTouch'))
      try {
        this.responders.runResponder(target, topLevelType, event);
      } catch (error) {
        this.report(error);
      }
    this.propagate(target, topLevelType, event);
  }

  /** As on native: a listener that stops the event ends the bubble after its own node. */
  private propagate(target: BrowserNode, topLevelType: string, event: SyntheticEvent): void {
    for (
      let node: BrowserNode | null = target;
      node && !event.isPropagationStopped();
      node = DIRECT_EVENTS.has(topLevelType) ? null : node.parent
    ) {
      const listeners = node.listeners?.get(topLevelType);
      if (listeners)
        for (const fn of [...listeners]) {
          try {
            fn(event);
          } catch (error) {
            this.report(error);
          }
        }
    }
  }

  // --- always-on listeners, installed once per element at creation ---------------------------

  private wireAlwaysOnListeners(node: BrowserNode): void {
    if (node.name === 'scroll-view' || node.name === 'virtual-list') this.wireScroll(node);
    if (node.name === 'text-input') this.wireTextInput(node);
    if (node.name === 'switch') this.wireSwitch(node);
  }

  /**
   * `scroll` does not bubble, so this is a real per-node listener rather than a document one.
   *
   * `scrollend` is the browser saying the scroll has come to rest, whatever moved it: a wheel's
   * or a trackpad's glide, a flick, or an animated `scrollTo`. That is the moment a device reports
   * as `(momentumScrollEnd)` - iOS sends it after an animated `scrollTo` as well as after a fling -
   * and the event a paging carousel reads its page from, which never arrived here at all.
   */
  private wireScroll(node: BrowserNode): void {
    const el = node.el as HTMLElement;
    const offsets = () => ({
      contentOffset: { x: el.scrollLeft, y: el.scrollTop },
      contentSize: { width: el.scrollWidth, height: el.scrollHeight },
      layoutMeasurement: { width: el.clientWidth, height: el.clientHeight },
      contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
      zoomScale: 1,
    });
    this.listen(node, 'scroll', () => {
      this.responders.notifyScroll(node);
      this.dispatchEvent(node, 'topScroll', offsets());
    });
    this.listen(node, 'scrollend', () => {
      this.dispatchEvent(node, 'topMomentumScrollEnd', offsets());
    });
  }

  private wireTextInput(node: BrowserNode): void {
    const el = node.el as HTMLTextAreaElement;
    const nextCount = () => {
      const count = (this.eventCounts.get(node) ?? 0) + 1;
      this.eventCounts.set(node, count);
      return count;
    };
    this.listen(node, 'input', (event) => {
      this.dispatchEvent(node, 'topChange', {
        text: el.value,
        eventCount: nextCount(),
        target: 0,
        isComposing: (event as InputEvent).isComposing,
      });
    });
    this.listen(node, 'compositionend', () => {
      this.dispatchEvent(node, 'topChange', {
        text: el.value,
        eventCount: nextCount(),
        target: 0,
        isComposing: false,
      });
    });
    this.listen(node, 'select', () => {
      this.dispatchEvent(node, 'topSelectionChange', {
        selection: { start: el.selectionStart, end: el.selectionEnd },
      });
    });
    this.listen(node, 'focus', () => {
      if (el.hasAttribute('data-select-on-focus')) el.select();
    });
    this.listen(node, 'blur', () => {
      this.dispatchEvent(node, 'topEndEditing', {
        text: el.value,
        eventCount: nextCount(),
        target: 0,
      });
    });
    // `Enter` does what `submitBehavior` says, as on a device: `newline` inserts one, `submit`
    // submits and keeps focus, and `blurAndSubmit` submits and then lets go of the field. The
    // component resolves the default, `blurAndSubmit` on one line and `newline` on many; the
    // fallback here is the same rule, for a field whose binding has not landed yet. An `Enter`
    // that confirms an IME composition belongs to the composition, not to the field.
    this.listen(node, 'keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      const behavior =
        node.props['submitBehavior'] ??
        (el.hasAttribute('data-multiline') ? 'newline' : 'blurAndSubmit');
      if (behavior === 'newline') return;
      event.preventDefault();
      this.dispatchEvent(node, 'topSubmitEditing', {
        text: el.value,
        eventCount: nextCount(),
        target: 0,
      });
      if (behavior === 'blurAndSubmit') el.blur();
    });
  }

  private wireSwitch(node: BrowserNode): void {
    const el = node.el as HTMLInputElement;
    this.listen(node, 'change', () => {
      this.dispatchEvent(node, 'topChange', { value: el.checked, target: 0 });
    });
  }

  /**
   * `topLayout` and hover, opted into once per node the first time something listens for them -
   * never torn down again, exactly as `engine.ts`'s own `EVENT_OPT_IN_PROPS` never unsets the
   * native prop it wrote either. A second listener for the same type on the same node (unusual,
   * but not forbidden) shares the one observer rather than getting a duplicate.
   */
  private wireOptIn(node: BrowserNode, topLevelType: string): void {
    const optedIn = (node.optedIn ??= new Set());
    if (optedIn.has(topLevelType)) return;
    optedIn.add(topLevelType);

    if (topLevelType === 'topLayout') {
      /*
       * The observer says *when*, and the bounding rect says *how big*. The size deliberately
       * does not come from the entry's `contentBoxSize`, which is what it used to come from.
       *
       * Yoga lays out border-box: a React Native view styled `width: 192` with `padding: 16` and
       * a hairline border is 192 wide, and `onLayout` reports 192. `contentBoxSize` is the CSS
       * *content* box, so the same element in a browser reported 158 - the padding and the border
       * subtracted. Every `(layout)` consumer in the library was therefore being handed a size
       * smaller than its native counterpart by however much padding the element happened to have,
       * and each one used it for something different: an accordion animated to a height that cut
       * its own padding off, and an anchored overlay both centred itself on a width it did not
       * have and decided it had room on a side where it did not, because `fits()` was asked about
       * a shorter card than the one about to be painted.
       *
       * `measure()` in this same file has always answered from `getBoundingClientRect()`, which
       * is the border box - so the engine was reporting two different sizes for one element
       * depending on which way you asked. This is the half that was wrong.
       *
       * `x`/`y` are the other half, and a different frame from `measure()`'s: `engine.ts`'s own
       * doc comment for `measure()` says it plainly - "`(layout)` reports a frame in the parent's
       * coordinates" - because a layout tells a view how big it is and where it sits inside
       * whatever it is stacked in, not where it is on screen. Reporting the raw viewport rect here
       * answered a question nothing asked: a consumer that reads `layout.y` as an item's offset
       * within its scrolling parent compares it against a scroll position in that same space, so
       * a viewport-relative `y` was wrong by the scroll container's own position on the page - right only for a scroll view
       * pinned at the top of an unscrolled full-page app, wrong the moment it sits lower on the
       * page or the page itself scrolls. Subtracting the immediate DOM parent's rect - never an
       * anchor comment; `browser-renderer.ts`'s `appendChild`/`insertBefore` only ever set
       * `child.parent` to a node backed by a real element - puts it back in the parent's frame.
       */
      const Observer = this.document.defaultView?.ResizeObserver ?? globalThis.ResizeObserver;
      if (!Observer) return;
      const observer = new Observer(() => {
        if (this.disposed || !this.owned.has(node)) return;
        const rect = (node.el as Element).getBoundingClientRect();
        const parent = node.parent?.el as Element | undefined;
        const origin = parent ? parent.getBoundingClientRect() : { x: 0, y: 0 };
        this.dispatchEvent(node, 'topLayout', {
          layout: {
            x: rect.x - origin.x,
            y: rect.y - origin.y,
            width: rect.width,
            height: rect.height,
          },
        });
      });
      this.ownCleanup(node, () => observer.disconnect());
      observer.observe(node.el as Element);
      return;
    }
    if (topLevelType === 'topPointerEnter' || topLevelType === 'topPointerLeave') {
      const domName = topLevelType === 'topPointerEnter' ? 'pointerenter' : 'pointerleave';
      this.listen(node, domName, () => this.dispatchEvent(node, topLevelType, {}));
      return;
    }

    /*
     * Anything else is an ordinary DOM event, bound for real.
     *
     * Without this, `listen` put the callback in the node's map and stopped: the map is only
     * ever read by `dispatchEvent`, and nothing dispatches a `topClick`. So `onClick`,
     * `onKeyDown`, `onInput` and every other plain DOM handler registered successfully and never
     * fired.
     *
     * The name maps straight down: DOM event types are lowercase, so `topClick` is `click` and
     * `topKeyDown` is `keydown`.
     *
     * The event reaches the handler raw, not wrapped in `{ nativeEvent }`, because that is what a
     * handler written for a browser expects - a link handler reads `button`, `ctrlKey` and
     * `metaKey` off it and calls `preventDefault` itself. Returning `false` from a handler
     * prevents the default.
     *
     * Delivered only to this node's own listeners rather than through `propagate`, and that is
     * the subtle half. `propagate` walks this package's retained tree to emulate the bubbling
     * React Native does in JavaScript. The DOM already bubbles, so a click on a child arrives at
     * an ancestor's listener by itself, and running both would call every ancestor handler twice.
     */
    if (ENGINE_EVENTS.has(topLevelType)) return;
    const type = topLevelType.slice(3).toLowerCase();
    const listener = (event: Event) => {
      for (const listener of [...(node.listeners?.get(topLevelType) ?? [])]) {
        try {
          if ((listener as (value: unknown) => unknown)(event) === false) event.preventDefault();
        } catch (error) {
          this.report(error);
        }
      }
    };
    node.el.addEventListener(type, listener);
    this.ownCleanup(node, () => node.el.removeEventListener(type, listener));
  }

  // --- document-level listeners, shared by the whole tree ------------------------------------

  private installGlobalListeners(): void {
    const on = <K extends keyof DocumentEventMap>(
      type: K,
      listener: (event: DocumentEventMap[K]) => void,
    ): void => this.document.addEventListener(type, listener, { signal: this.listening.signal });
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) {
      on(type, (event) => this.onPointer(event, type));
    }
    on('focusin', (event) => this.onFocusChange(event, true));
    on('focusout', (event) => this.onFocusChange(event, false));
    on('keydown', (event) => this.onKey(event, true));
    on('keyup', (event) => this.onKey(event, false));
  }

  /** The control a held Space is pressing, released on the matching `keyup`. */
  private keyPress: BrowserNode | null = null;

  /**
   * Enter and Space press the focused control, as they press a `<button>`.
   *
   * A pressable is focusable and announces itself as a button, but it presses through the
   * responder negotiation, which only pointer events drove - so a keyboard user could tab to it
   * and do nothing with it. The key becomes the same touch a finger would make, on the control
   * itself, so `pressIn`, `press` and `pressOut` all fire, in order, through the same code.
   *
   * Enter presses on the way down and Space on the way up, which is the browser's own rule for a
   * button; Space is also kept from scrolling the page. A text field and a switch are left alone,
   * because the browser's own control already does the right thing with both keys.
   */
  private onKey(event: KeyboardEvent, down: boolean): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const space = event.key === ' ';
    if (!down) {
      const node = this.keyPress;
      if (!space || !node) return;
      this.keyPress = null;
      this.dispatchEvent(node, 'topTouchEnd', this.keyTouch(node));
      return;
    }
    const node = this.keyTarget(event);
    if (!node) return;
    event.preventDefault();
    if (event.repeat || this.keyPress) return;
    this.dispatchEvent(node, 'topTouchStart', this.keyTouch(node));
    if (space) this.keyPress = node;
    else this.dispatchEvent(node, 'topTouchEnd', this.keyTouch(node));
  }

  /** The focused control a key would press, or null where the key belongs to something else. */
  private keyTarget(event: KeyboardEvent): BrowserNode | null {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return null;
    const node = nodeOf(event.target as Element | null);
    if (!node || !this.owned.has(node) || node.name === 'text-input' || node.name === 'switch')
      return null;
    return this.responders.responds(node) ? node : null;
  }

  /** A touch at the control's centre, so nothing downstream mistakes it for a drag. */
  private keyTouch(node: BrowserNode): { pageX: number; pageY: number; identifier: number } {
    const rect = (node.el as Element).getBoundingClientRect();
    return { pageX: rect.x + rect.width / 2, pageY: rect.y + rect.height / 2, identifier: -1 };
  }

  private onPointer(event: PointerEvent, domType: keyof typeof TOUCH_EVENT_NAMES): void {
    let target: BrowserNode | undefined;
    if (domType === 'pointerdown') {
      // A right or middle click opens a menu or a tab; only the primary button presses.
      if (event.button > 0) return;
      target = nearestNodeOf(event.target as Element | null) ?? undefined;
      if (!target || !this.owned.has(target)) return;
      this.activeTouches.set(event.pointerId, target);
      // Pins every later event in this gesture to the element the finger actually landed on,
      // regardless of where it wanders - what makes the negotiation's `target` mean the same
      // thing `topTouchMove`/`topTouchEnd` that Fabric's continuous per-finger delivery does.
      (event.target as Element).setPointerCapture?.(event.pointerId);
    } else {
      target = this.activeTouches.get(event.pointerId);
      if (!target) return;
      if (domType === 'pointerup' || domType === 'pointercancel')
        this.activeTouches.delete(event.pointerId);
    }
    this.dispatchEvent(target, TOUCH_EVENT_NAMES[domType]!, {
      pageX: event.pageX,
      pageY: event.pageY,
      identifier: event.pointerId,
    });
  }

  private onFocusChange(event: FocusEvent, focused: boolean): void {
    const node = nearestNodeOf(event.target as Element | null);
    if (!node || !this.owned.has(node)) return;
    if (focused) this.focusedNode = node;
    else if (this.focusedNode === node) this.focusedNode = null;
    this.dispatchEvent(node, focused ? 'topFocus' : 'topBlur', { target: 0 });
  }
}
