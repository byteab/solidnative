/**
 * Shared Solid components on `BrowserEngine`, for everything beyond a control's own value: icons
 * as real SVG, imperative scroll commands, responder negotiation over a nested tree, layout and
 * measure coordinate spaces, the browser's device services, several apps on one document, plain
 * DOM event bindings, and the native-only bindings failing loudly rather than silently.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { View, WorkletStyle, type WorkletBackend } from '@solid-native/components/solid';
import { SVG_NAMESPACE } from '../src/elements.ts';
import { nodeOf } from '../src/dom-node.ts';
import { createElement, insert, mountBrowser, spread } from '../src/solid/index.ts';
import { boot, settle } from './boot.ts';
import {
  button,
  device,
  events,
  icon,
  layoutFrame,
  nestedPress,
  scrollView,
  statusBar,
} from './fixtures.solid.tsx';

describe('Icon, over real SVG elements', () => {
  const setup = () => {
    const booted = boot(icon);
    const root = booted.byId<SVGSVGElement>('icon-root');
    const shape = (tag: string) => root.querySelector(`[data-rn="${tag}"]`) as SVGElement;
    return { ...booted, svg: root, shape };
  };

  it('commits the root as a real <svg>, in the SVG namespace', () => {
    const { svg, root } = setup();
    assert.equal(svg.namespaceURI, SVG_NAMESPACE);
    assert.equal(svg.tagName, 'svg');
    root.dispose();
  });

  it('carries the parsed viewBox, the size, and a meet/xMidYMid aspect ratio', () => {
    const { svg, root } = setup();
    assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
    assert.equal(svg.getAttribute('width'), '32');
    assert.equal(svg.getAttribute('height'), '32');
    assert.equal(svg.getAttribute('preserveAspectRatio'), 'xMidYMid meet');
    root.dispose();
  });

  it('resolves the colour as a real CSS color, for currentColor to read', () => {
    const { svg, root } = setup();
    assert.match(svg.style.color, /#111827|rgb\(17,\s*24,\s*39\)/);
    root.dispose();
  });

  it("wraps the markup in a real <g> carrying the root svg's presentation attributes", () => {
    const { shape, root } = setup();
    const group = shape('svg-g');
    assert.equal(group.namespaceURI, SVG_NAMESPACE);
    assert.equal(group.tagName, 'g');
    assert.equal(group.getAttribute('fill'), 'none');
    assert.equal(group.getAttribute('stroke'), 'currentColor');
    assert.equal(group.getAttribute('stroke-width'), '1.5');
    root.dispose();
  });

  it("commits <path> real, with no fill/stroke of its own - inheriting the group's", () => {
    const { shape, root } = setup();
    const path = shape('svg-path');
    assert.equal(path.namespaceURI, SVG_NAMESPACE);
    assert.equal(path.tagName, 'path');
    assert.equal(path.getAttribute('d'), 'M4 4h16v16H4z');
    assert.equal(path.getAttribute('stroke-linecap'), 'round');
    assert.equal(path.getAttribute('stroke-linejoin'), 'round');
    assert.equal(path.hasAttribute('fill'), false);
    assert.equal(path.hasAttribute('stroke'), false);
    root.dispose();
  });

  it('translates a colour brush and integer fill-rule/clip-rule on <circle>', () => {
    const { shape, root } = setup();
    const circle = shape('svg-circle');
    assert.equal(circle.tagName, 'circle');
    assert.equal(circle.getAttribute('cx'), '12');
    assert.equal(circle.getAttribute('fill'), '#ff9f0a');
    assert.equal(circle.getAttribute('fill-rule'), 'evenodd');
    assert.equal(circle.getAttribute('clip-rule'), 'evenodd');
    root.dispose();
  });

  it('writes an explicit fill="none" on <rect>, its dash array and its matrix', () => {
    const { shape, root } = setup();
    const rect = shape('svg-rect');
    assert.equal(rect.tagName, 'rect');
    assert.equal(rect.getAttribute('fill'), 'none');
    assert.equal(rect.getAttribute('stroke-dasharray'), '4,2');
    assert.equal(rect.getAttribute('transform'), 'matrix(1,0,0,1,3,4)');
    root.dispose();
  });

  it('commits <line> real, with its own coordinates and stroke', () => {
    const { shape, root } = setup();
    const line = shape('svg-line');
    assert.equal(line.namespaceURI, SVG_NAMESPACE);
    assert.equal(line.tagName, 'line');
    assert.equal(line.getAttribute('x1'), '2');
    assert.equal(line.getAttribute('x2'), '22');
    assert.equal(line.getAttribute('stroke'), '#e5e7eb');
    root.dispose();
  });
});

describe('ScrollView.scrollTo, over a real <scroll-view>', () => {
  const setup = () => {
    const booted = boot(scrollView().view);
    const content = booted.byId('content');
    Object.defineProperty(content, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(content, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(content, 'scrollHeight', { value: 20, configurable: true });
    Object.defineProperty(content, 'clientHeight', { value: 20, configurable: true });
    // jsdom has no `Element.scrollTo`; this one lands instantly and records what it was asked.
    const calls: { left?: number; top?: number; behavior?: string }[] = [];
    content.scrollTo = ((options: { left?: number; top?: number; behavior?: string }) => {
      calls.push(options);
      if (options.left !== undefined) content.scrollLeft = options.left;
      if (options.top !== undefined) content.scrollTop = options.top;
    }) as typeof content.scrollTo;
    const tap = async (id: string) => {
      booted.press(booted.byId(id));
      await settle();
    };
    return { ...booted, content, calls, tap };
  };

  it('dispatches a real scrollTo with the offset and a smooth behaviour by default', async () => {
    const { root, content, calls, tap } = setup();
    await tap('jump');
    assert.deepEqual(calls, [{ left: 300, top: 0, behavior: 'smooth' }]);
    assert.equal(content.scrollLeft, 300);
    root.dispose();
  });

  it('carries animated: false through as an instant behaviour', async () => {
    const { root, calls, tap } = setup();
    await tap('jump-instant');
    assert.deepEqual(calls, [{ left: 600, top: 0, behavior: 'auto' }]);
    root.dispose();
  });

  it('scrollToEnd resolves the horizontal end from scrollWidth', async () => {
    const { root, calls, tap } = setup();
    await tap('jump-end');
    assert.deepEqual(calls, [{ left: 900, behavior: 'auto' }]);
    root.dispose();
  });
});

describe('responder negotiation, over a real nested tree', () => {
  const setup = () => {
    const fixture = nestedPress();
    const booted = boot(fixture.view);
    const text = (label: string) =>
      [...booted.element.querySelectorAll('text')].find((node) => node.textContent === label)!;
    return { fixture, ...booted, text };
  };

  it('elects only the innermost pressable, not the one wrapping it', async () => {
    const { fixture, root, press, text } = setup();
    press(text('inner'), 1);
    await settle();
    assert.deepEqual(fixture.log(), ['inner']);
    root.dispose();
  });

  it('lets a scroll view take the gesture over a press started inside it', async () => {
    const { fixture, root, pointer, text, element, window } = setup();
    pointer(text('inner'), 'pointerdown', 2);
    element.querySelector('scroll-view')!.dispatchEvent(new window.Event('scroll'));
    pointer(text('inner'), 'pointerup', 2);
    await settle();
    assert.deepEqual(fixture.log(), [], 'the press was cancelled for both pressables');
    root.dispose();
  });

  it('still presses normally when nothing scrolls', async () => {
    const { fixture, root, press, text } = setup();
    press(text('outer'), 3);
    await settle();
    assert.deepEqual(fixture.log(), ['outer']);
    root.dispose();
  });
});

describe('an onLayout event reporting an inner view', () => {
  it('reports x/y relative to the immediate parent, not the viewport', async () => {
    const fixture = layoutFrame();
    const { root, byId } = boot(fixture.view);
    // jsdom lays nothing out, so both rects are stated: outer sits 80 down and 50 across the page,
    // inner a further 20 down and 16 across inside it.
    byId('outer').getBoundingClientRect = () =>
      ({ x: 50, y: 80, width: 300, height: 200 }) as DOMRect;
    byId('inner').getBoundingClientRect = () =>
      ({ x: 66, y: 100, width: 120, height: 40 }) as DOMRect;
    await settle();
    assert.deepEqual(fixture.frame(), { x: 16, y: 20, width: 120, height: 40 });
    root.dispose();
  });
});

describe('measuring a node for an anchored overlay', () => {
  type Frame = { x: number; y: number };
  const measure = (engine: unknown, node: unknown) => {
    const frames: Frame[] = [];
    (engine as { measure(node: unknown, into: (frame: Frame) => void): void }).measure(
      node,
      (frame) => frames.push(frame),
    );
    return frames;
  };

  it('answers relative to the mount root, not the viewport', async () => {
    const { root, element, byId } = boot(button().view);
    await settle();
    const trigger = byId('trigger');
    element.getBoundingClientRect = () => ({ x: 0, y: 120, width: 400, height: 300 }) as DOMRect;
    trigger.getBoundingClientRect = () => ({ x: 16, y: 160, width: 200, height: 36 }) as DOMRect;
    const frames = measure(root.engine, nodeOf(trigger));
    assert.equal(frames.length, 1);
    assert.equal(frames[0]!.y, 40, 'the offset of the button within the root');
    assert.equal(frames[0]!.x, 16);
    root.dispose();
  });

  it('answers relative to its own root when more than one is mounted', async () => {
    const { document, root: first, element } = boot(button().view);
    element.getBoundingClientRect = () => ({ x: 0, y: 0, width: 400, height: 100 }) as DOMRect;
    const other = document.createElement('div');
    document.body.appendChild(other);
    const second = mountBrowser(button().view, other);
    await settle();
    other.getBoundingClientRect = () => ({ x: 0, y: 500, width: 400, height: 300 }) as DOMRect;
    const trigger = other.querySelector('pressable')!;
    trigger.getBoundingClientRect = () => ({ x: 16, y: 540, width: 200, height: 36 }) as DOMRect;
    const frames = measure(second.engine, nodeOf(trigger));
    assert.equal(frames.length, 1);
    assert.equal(frames[0]!.y, 40, 'against its own root at y=500, not the first at y=0');
    first.dispose();
    second.dispose();
  });
});

describe('the device services, on the web', () => {
  it('report the viewport, follow a resize, and read and follow the document direction', async () => {
    const fixture = device();
    const { root, window, document } = boot(fixture.view);
    const screen = fixture.screen();
    const direction = fixture.direction();
    await settle();

    assert.equal(screen.window().width, window.innerWidth);
    assert.ok(window.innerWidth >= 768, 'the fixture window is wider than the breakpoint');
    assert.equal(screen.compact(), false);

    window.innerWidth = 400;
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(screen.window().width, 400);
    assert.equal(screen.compact(), true);

    assert.equal(direction.current(), 'ltr');
    assert.equal(direction.rtl(), false);
    document.documentElement.setAttribute('dir', 'rtl');
    await settle();
    assert.equal(direction.current(), 'rtl');
    assert.equal(direction.rtl(), true);
    // `<body dir>` wins over `<html dir>`.
    document.body.setAttribute('dir', 'ltr');
    await settle();
    assert.equal(direction.current(), 'ltr');
    document.body.removeAttribute('dir');
    document.documentElement.removeAttribute('dir');
    await settle();
    assert.equal(direction.current(), 'ltr');
    root.dispose();
  });
});

describe('the status bar, on the web', () => {
  it('renders a component that sets the status bar style, with a throwing require', () => {
    const scope = globalThis as { require?: unknown };
    const original = scope.require;
    scope.require = () => {
      throw new Error('Calling `require` for "react-native" in an environment without it');
    };
    try {
      const { element, root } = boot(statusBar());
      assert.match(element.textContent ?? '', /A light screen/);
      root.dispose();
    } finally {
      scope.require = original;
    }
  });
});

describe('apps sharing a document', () => {
  it("tells a field's focus and blur to its own app, once, whatever else is on the page", async () => {
    const first = events();
    const { document, root, element } = boot(first.view);
    const islands = [events(), events()].map((fixture) => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      return { fixture, host, root: mountBrowser(fixture.view, host) };
    });
    const second = islands[0]!;
    const field = second.host.querySelector('[id="line"]') as HTMLTextAreaElement;
    field.focus();
    field.blur();
    await settle();
    assert.deepEqual(second.fixture.log(), ['focus', 'endEditing', 'blur']);
    assert.deepEqual(first.log(), []);
    assert.ok(element.querySelector('[id="line"]'));
    root.dispose();
    for (const island of islands) island.root.dispose();
  });

  it('stops listening to the document once its app is disposed', () => {
    const { document, root, element } = boot(events().view);
    const field = element.querySelector('[id="line"]') as HTMLTextAreaElement;
    root.dispose();
    // Put back by hand, as a page holding on to the element might.
    document.body.appendChild(field);
    field.focus();
    assert.equal(root.engine.focused, null);
  });
});

describe('plain DOM event bindings', () => {
  it('fire, hand over the real event, bubble once, and map any event name', async () => {
    let navigations = 0,
      prevented = false,
      outerClicks = 0,
      keys = 0;
    const { root, byId, window } = boot(() => {
      const page = createElement('view');
      const link = createElement('a');
      spread(link, {
        nativeID: 'link',
        href: '/somewhere',
        onClick: (event: MouseEvent) => {
          navigations++;
          event.preventDefault();
          prevented = event.defaultPrevented;
        },
      });
      const outer = createElement('view');
      spread(outer, { nativeID: 'outer', onClick: () => outerClicks++ });
      const inner = createElement('view');
      spread(inner, { nativeID: 'inner' });
      insert(outer, inner);
      const field = createElement('input');
      spread(field, { nativeID: 'field', onKeyDown: () => keys++ });
      insert(page, [link, outer, field]);
      return page;
    });
    const click = (id: string) =>
      byId(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    click('link');
    await settle();
    assert.equal(navigations, 1);
    assert.equal(prevented, true, 'preventDefault reached the real event');

    click('inner');
    await settle();
    assert.equal(outerClicks, 1, 'once, not twice');

    byId('field').dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true }));
    await settle();
    assert.equal(keys, 1);
    root.dispose();
  });
});

describe('what does not carry over to the web', () => {
  it('names the native host a worklet binding needs, rather than doing nothing', () => {
    const errors: unknown[] = [];
    const backend = {} as WorkletBackend;
    const { root } = boot(
      () => View({ ref: WorkletStyle(() => ({ style: () => ({}) }) as never, backend) }),
      { onError: (error) => errors.push(error) },
    );
    assert.equal(errors.length, 1);
    assert.match(String(errors[0]), /Worklets and native gestures require a native Fabric host/);
    root.dispose();
  });
});
