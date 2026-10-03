/**
 * A browser environment for Node, so this package's tests can run with `node --test` rather than
 * needing a real browser window. Ported from the prototype at
 * `examples/web-button/src/jsdom-env.ts` (see the report for what that prototype found), which
 * exists to be read rather than imported - this package cannot depend on an example.
 *
 * Two gaps jsdom leaves that this fills: it has no `ResizeObserver` at all, and no `PointerEvent`
 * constructor with the pointer-specific fields (`pointerId`) or `setPointerCapture` on `Element`.
 * Both are stubbed minimally - just enough for `BrowserEngine` to observe a size once and to run
 * its pointer-based responder negotiation. Neither stub ships; it exists only for this test file.
 */
import { JSDOM } from 'jsdom';

export function installJsdomEnvironment(): { document: Document; window: Window } {
  const dom = new JSDOM('<!doctype html><html><body><div id="app-root"></div></body></html>', {
    url: 'http://localhost/',
  });
  const window = dom.window as unknown as Window & typeof globalThis;

  class FakeResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      queueMicrotask(() => {
        const rect = target.getBoundingClientRect();
        this.callback(
          [
            {
              target,
              contentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
            } as unknown as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        );
      });
    }
    unobserve(): void {}
    disconnect(): void {}
  }

  if (!window.Element.prototype.setPointerCapture) {
    window.Element.prototype.setPointerCapture = function (): void {};
    window.Element.prototype.releasePointerCapture = function (): void {};
    window.Element.prototype.hasPointerCapture = function (): boolean {
      return false;
    };
  }

  const globals: Record<string, unknown> = {
    window,
    document: window.document,
    Node: window.Node,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    Text: window.Text,
    Comment: window.Comment,
    Event: window.Event,
    PointerEvent: window.PointerEvent ?? window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    CustomEvent: window.CustomEvent,
    ResizeObserver: FakeResizeObserver,
    Image: window.Image,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id: number) => window.clearTimeout(id),
  };
  for (const [key, value] of Object.entries(globals)) {
    (globalThis as Record<string, unknown>)[key] = value;
  }

  return { document: window.document, window };
}
