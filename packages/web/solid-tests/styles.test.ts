/**
 * Styles on the Solid browser host: React Native's style keys turned into CSS whichever way they
 * arrive (one `style:key` binding at a time, or a whole object), a static style string, and a
 * component's own compiled `.native.css` sheet - applied, scoped to that component, `:host`, one
 * `<style>` however often it renders, and custom properties kept by the names they were written.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileBrowserCss } from '@solidnative/metro/solid-browser.cjs';
import { Text } from '@solidnative/components/solid';
import type { BrowserNode } from '../src/dom-node.ts';
import { createElement, setProp } from '../src/solid/index.ts';
import { boot } from './boot.ts';
import { Badge, Card, Themed } from './fixtures.solid.tsx';

function scene() {
  let node!: BrowserNode;
  const booted = boot(() => (node = createElement('view')));
  const style = (node.el as HTMLElement).style;
  /** One key at a time, as `style:key` bindings arrive. */
  const bind = (entries: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(entries)) setProp(node, `style:${key}`, value);
  };
  const unbind = (key: string) => setProp(node, `style:${key}`, undefined);
  /** A whole object, as a `style` prop or an animation frame writes one. */
  const setObject = (value: unknown) => setProp(node, 'style', value);
  return { ...booted, node, style, bind, unbind, setObject };
}

const CARD = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.45,
  shadowRadius: 12,
};

describe("React Native's shadow keys", () => {
  it('become one box-shadow, bound key by key or as an object', () => {
    const expected = '0px 6px 12px color-mix(in srgb, #000000 45%, transparent)';
    const bound = scene();
    bound.bind(CARD);
    assert.equal(bound.style.boxShadow, expected);
    const object = scene();
    object.setObject(CARD);
    assert.equal(object.style.boxShadow, expected);
  });

  it('use the colour at full opacity, and draw nothing without an opacity, as iOS does', () => {
    const { style, bind, unbind } = scene();
    bind({ ...CARD, shadowOpacity: 1 });
    assert.equal(style.boxShadow, '0px 6px 12px #000000');
    unbind('shadowOpacity');
    assert.equal(style.boxShadow, '');
  });

  it('follow each key as it changes, and go when the last one does', () => {
    const { style, bind, unbind } = scene();
    bind(CARD);
    bind({ shadowOffset: { width: 2, height: 3 } });
    assert.equal(style.boxShadow, '2px 3px 12px color-mix(in srgb, #000000 45%, transparent)');
    for (const key of Object.keys(CARD)) unbind(key);
    assert.equal(style.boxShadow, '');
  });

  it('give way to a boxShadow the same style names outright', () => {
    const { style, bind } = scene();
    bind({ ...CARD, boxShadow: '0 1px 2px red' });
    assert.equal(style.boxShadow, '0 1px 2px red');
  });

  it('are removed with the object that set them', () => {
    const { style, setObject } = scene();
    setObject(CARD);
    setObject({ opacity: 1 });
    assert.equal(style.boxShadow, '');
  });

  it('draw nothing at zero opacity, and are black with no colour, as on iOS', () => {
    const zero = scene();
    zero.bind({ ...CARD, shadowOpacity: 0 });
    assert.equal(zero.style.boxShadow, '');
    const black = scene();
    black.bind({ shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4 });
    assert.equal(black.style.boxShadow, '0px 2px 4px black');
  });
});

describe('the other React Native-only style keys', () => {
  it('turn the text shadow keys into one text-shadow', () => {
    const { style, bind, unbind } = scene();
    bind({
      textShadowColor: 'red',
      textShadowOffset: { width: 1, height: 2 },
      textShadowRadius: 3,
    });
    assert.equal(style.textShadow, '1px 2px 3px red');
    unbind('textShadowColor');
    assert.equal(style.textShadow, '');
  });

  it('write fontVariant as a space-separated list', () => {
    const { style, bind } = scene();
    bind({ fontVariant: ['small-caps', 'tabular-nums'] });
    assert.equal(style.fontVariant, 'small-caps tabular-nums');
  });

  it('set both edges a horizontal or vertical key stands for', () => {
    const { style, bind } = scene();
    bind({ paddingHorizontal: 8, paddingVertical: 4, marginHorizontal: 2, marginVertical: 1 });
    assert.deepEqual(
      [style.paddingLeft, style.paddingRight, style.paddingTop, style.paddingBottom],
      ['8px', '8px', '4px', '4px'],
    );
    assert.deepEqual(
      [style.marginLeft, style.marginRight, style.marginTop, style.marginBottom],
      ['2px', '2px', '1px', '1px'],
    );
  });

  it('let the single edge win over the horizontal key, as in Yoga', () => {
    const { style, bind, unbind } = scene();
    bind({ paddingLeft: 3, paddingHorizontal: 8 });
    assert.equal(style.paddingLeft, '3px');
    assert.equal(style.paddingRight, '8px');
    unbind('paddingLeft');
    assert.equal(style.paddingLeft, '8px', 'the horizontal value comes back');
    unbind('paddingHorizontal');
    assert.equal(style.paddingLeft, '');
  });

  it('do the same as an object', () => {
    const { style, setObject } = scene();
    setObject({ paddingVertical: 10, paddingTop: 2 });
    assert.equal(style.paddingTop, '2px');
    assert.equal(style.paddingBottom, '10px');
    setObject({});
    assert.equal(style.paddingBottom, '');
  });

  it("turn Yoga's start and end edges into the inline-start and inline-end properties", () => {
    const { style, bind, unbind } = scene();
    bind({ start: 4, end: 8, marginStart: 1, marginEnd: 2, paddingStart: 3, paddingEnd: 5 });
    assert.deepEqual(
      [
        'inset-inline-start',
        'inset-inline-end',
        'margin-inline-start',
        'margin-inline-end',
        'padding-inline-start',
        'padding-inline-end',
      ].map((name) => style.getPropertyValue(name)),
      ['4px', '8px', '1px', '2px', '3px', '5px'],
    );
    unbind('start');
    assert.equal(style.getPropertyValue('inset-inline-start'), '');
  });
});

describe('a static style string', () => {
  it('applies through the same style prop as an object', () => {
    const { style, setObject } = scene();
    setObject('flex-grow: 2; margin-top: 4px');
    assert.equal(style.flexGrow, '2');
    assert.equal(style.marginTop, '4px');
  });
});

describe("a component's own sheet, on the web", () => {
  const colour = (window: Window, element: Element | null, property = 'backgroundColor') =>
    element
      ? (window.getComputedStyle(element) as unknown as Record<string, string>)[property]
      : '(missing)';

  it('applies to the elements it renders, and to no other component of the same class', () => {
    const { window, root, byId } = boot(() => [
      Card(),
      Badge(),
      Text({ id: 'plain', class: 'label', children: 'plain' }),
    ]);
    assert.equal(colour(window, byId('card-label'), 'color'), 'rgb(0, 128, 0)');
    assert.equal(colour(window, byId('badge-label'), 'color'), 'rgb(0, 0, 255)');
    const plain = colour(window, byId('plain'), 'color');
    assert.notEqual(plain, 'rgb(0, 128, 0)');
    assert.notEqual(plain, 'rgb(0, 0, 255)');
    root.dispose();
  });

  it('reaches the host element through :host', () => {
    const { window, root, byId } = boot(() => Themed({}));
    assert.equal(colour(window, byId('themed-card')), 'rgb(255, 0, 0)');
    assert.equal(colour(window, byId('themed-host')), 'rgb(0, 0, 255)');
    root.dispose();
  });

  it('adds one stylesheet per sheet, however many times it renders, and removes it after', () => {
    const { document, root } = boot(() => [Themed({ id: 'one' }), Themed({ id: 'two' })]);
    const sheets = () =>
      [...document.head.querySelectorAll('style[data-solidnative-style]')].filter((style) =>
        style.textContent?.includes('.card['),
      );
    assert.equal(sheets().length, 1);
    root.dispose();
    assert.equal(sheets().length, 0);
  });

  it('keeps a custom property by the name it was written with', () => {
    const { document, root } = boot(() => Themed({}));
    const sheet = [...document.head.querySelectorAll('style[data-solidnative-style]')].find(
      (style) => style.textContent?.includes('.card['),
    );
    // The compiler minifies the colour, never the property name.
    assert.match(sheet?.textContent ?? '', /--tint:\s*(?:rgb\(0, 0, 255\)|#00f)/);
    root.dispose();
  });

  it('keeps var() references in a compiled sheet', () => {
    const sheet = compileBrowserCss(
      '.themed { padding-top: calc(var(--safe-area-inset-top, 0px) + 4px); }',
      'themed.native.css',
    );
    assert.match(sheet.css, /var\(--safe-area-inset-top, 0px\)/);
  });

  it('sets a bound custom property by its name, case kept, a number not a length', () => {
    const { root, byId } = boot(() => Themed({}));
    const bound = byId('bound');
    assert.equal(bound.style.getPropertyValue('--tint'), 'rgb(0, 0, 255)');
    assert.equal(bound.style.getPropertyValue('--brandTint'), 'rgb(0, 0, 255)');
    assert.equal(bound.style.getPropertyValue('--columns'), '3');
    root.dispose();
  });
});
