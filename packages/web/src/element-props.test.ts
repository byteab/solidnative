/**
 * The element-specific handlers in `props.ts`: `image`, `safe-area-view`, `modal`, `text-input`,
 * `ViewBase`'s `pointerEvents` approximation, and the `accessibilityRole` table.
 *
 * Each of these turns a React Native prop into a style or attribute the browser understands, and
 * each fails the same way when it goes wrong: nothing throws, the prop sits in `node.props`, and
 * the page quietly looks or behaves unlike the device. An image tiles at its natural size instead
 * of covering its box, a safe area pads with one family and margins with the other, a role an
 * assistive technology never heard of reaches the DOM. None of that is visible to a suite that
 * only checks a prop was received.
 *
 * `env()` is the one value here jsdom cannot hold: its style declaration rejects it, so
 * `style.paddingTop` reads back empty whether the handler wrote it or not. The safe-area tests
 * record what the handler asked the declaration for instead, which is the claim that matters;
 * whether Chromium then resolves it is `browser/`'s question.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { installJsdomEnvironment } from './jsdom-env.ts';
import type { BrowserEngine as Engine } from './browser-engine.ts';
import type { BrowserNode } from './dom-node.ts';

let BrowserEngine: typeof Engine;
let document: Document;
let window: Window;
let RESET_CSS: string;

/**
 * Every `accessibilityRole` React Native accepts. The Solid components type the prop as a string,
 * so this list is the record of the union the role table has to cover.
 */
const ROLES = new Set(
  (
    'none button togglebutton link search image keyboardkey text adjustable imagebutton header ' +
    'summary alert checkbox combobox menu menubar menuitem progressbar radio radiogroup scrollbar ' +
    'spinbutton switch tab tabbar tablist timer list toolbar grid pager scrollview ' +
    'horizontalscrollview viewgroup webview drawerlayout slidingdrawer iconmenu'
  ).split(' '),
);

before(async () => {
  ({ document, window } = installJsdomEnvironment());
  ({ BrowserEngine } = await import('./browser-engine.ts'));
  ({ RESET_CSS } = await import('./reset-css.ts'));
});

function scene(name: string) {
  const engine = new BrowserEngine(document);
  const node = engine.createElementNode(name);
  const el = node.el as HTMLElement;
  const set = (key: string, value: unknown) => engine.setProp(node, key, value);
  return { engine, node, el, style: el.style, set };
}

/** Every declaration a handler asked for, whether or not jsdom's declaration kept it. */
function recordDeclarations(node: BrowserNode): Map<string, string> {
  const style = (node.el as HTMLElement).style;
  const declared = new Map<string, string>();
  const setProperty = style.setProperty.bind(style);
  const removeProperty = style.removeProperty.bind(style);
  style.setProperty = (name: string, value: string | null, priority?: string) => {
    if (value === null || value === '') declared.delete(name);
    else declared.set(name, value);
    setProperty(name, value, priority);
  };
  style.removeProperty = (name: string) => {
    declared.delete(name);
    return removeProperty(name);
  };
  return declared;
}

describe('image', () => {
  it('paints a {uri} source, or the first of a list, as the background image', () => {
    const { style, set } = scene('image');
    set('source', { uri: 'https://example.com/a.png' });
    assert.equal(style.backgroundImage, 'url("https://example.com/a.png")');
    set('source', [{ uri: 'https://example.com/b.png' }, { uri: 'https://example.com/c.png' }]);
    assert.equal(style.backgroundImage, 'url("https://example.com/b.png")');
    set('source', null);
    assert.equal(style.backgroundImage, '');
  });

  it('escapes a quote in the uri rather than ending the url() early', () => {
    const { style, set } = scene('image');
    set('source', { uri: 'https://example.com/a"b.png' });
    assert.equal(style.backgroundImage, 'url("https://example.com/a\\"b.png")');
  });

  it('fits the picture the way each resizeMode says, and clears all of it', () => {
    const { style, set } = scene('image');
    const fitted = () => [style.backgroundSize, style.backgroundRepeat, style.backgroundPosition];
    const centred = 'center center';
    set('resizeMode', 'cover');
    assert.deepEqual(fitted(), ['cover', 'no-repeat', centred]);
    set('resizeMode', 'contain');
    assert.deepEqual(fitted(), ['contain', 'no-repeat', centred]);
    set('resizeMode', 'stretch');
    assert.deepEqual(fitted(), ['100% 100%', 'no-repeat', centred]);
    set('resizeMode', 'repeat');
    assert.deepEqual(fitted(), ['auto', 'repeat', centred]);
    // `center` is natural size, centred. React Native also scales a larger image down, which a
    // background has no keyword for; `object-fit: scale-down` does, but this is not an `<img>`.
    set('resizeMode', 'center');
    assert.deepEqual(fitted(), ['auto', 'no-repeat', centred]);
    set('resizeMode', null);
    assert.deepEqual(fitted(), ['', '', '']);
  });

  it('covers its box with no resizeMode at all, which is the default React Native documents', () => {
    // `Image` binds `resizeMode` only when the caller set one, so the default has to come from
    // the reset. A browser's own background default is natural size, tiled from the corner.
    const sheet = document.createElement('style');
    sheet.textContent = RESET_CSS;
    document.head.appendChild(sheet);
    const { el, set } = scene('image');
    document.body.appendChild(el);
    set('source', { uri: 'https://example.com/a.png' });

    const computed = window.getComputedStyle(el);
    assert.equal(computed.backgroundSize, 'cover');
    assert.equal(computed.backgroundRepeat, 'no-repeat');
    assert.equal(computed.backgroundPosition, 'center center');
    el.remove();
    sheet.remove();
  });

  it('blurs by blurRadius points, and stops when it is cleared', () => {
    const { style, set } = scene('image');
    set('blurRadius', 6);
    assert.equal(style.filter, 'blur(6px)');
    set('blurRadius', null);
    assert.equal(style.filter, '');
  });

  it("offers the picture's own size as a default, never as an inline width", () => {
    // Inline `width` beats every class, so the size travels as custom properties the reset reads
    // at zero specificity, and `class="size-11"` still wins.
    const { style, set } = scene('image');
    set('intrinsicSize', { width: 600, height: 300 });
    assert.equal(style.getPropertyValue('--rn-intrinsic-width'), '600px');
    assert.equal(style.getPropertyValue('--rn-intrinsic-height'), '300px');
    assert.equal(style.width, '');
    set('intrinsicSize', null);
    assert.equal(style.getPropertyValue('--rn-intrinsic-width'), '');
    assert.match(
      RESET_CSS,
      /:where\(\[data-rn='image'\]\)\s*\{\s*width: var\(--rn-intrinsic-width/,
    );
  });
});

describe('safe-area-view', () => {
  const insets = (declared: Map<string, string>) => Object.fromEntries(declared);

  it("pads each edge it is given by that edge's env() inset, and leaves an off edge alone", () => {
    const { node, set } = scene('safe-area-view');
    const declared = recordDeclarations(node);
    set('edges', { top: 'additive', right: 'off', bottom: 'maximum', left: 'off' });
    assert.deepEqual(insets(declared), {
      'padding-top': 'env(safe-area-inset-top)',
      'padding-bottom': 'env(safe-area-inset-bottom)',
    });
  });

  it('gives additive the same value as maximum, as props.ts documents', () => {
    // There is no reading back the padding a class already put there, so additive cannot add to
    // it: it resolves to the inset alone, which is maximum against a base of zero.
    const additive = scene('safe-area-view');
    const maximum = scene('safe-area-view');
    const a = recordDeclarations(additive.node);
    const m = recordDeclarations(maximum.node);
    additive.set('edges', {
      top: 'additive',
      right: 'additive',
      bottom: 'additive',
      left: 'additive',
    });
    maximum.set('edges', { top: 'maximum', right: 'maximum', bottom: 'maximum', left: 'maximum' });
    assert.deepEqual(insets(a), insets(m));
    assert.equal(a.size, 4);
  });

  it('insets with margin in margin mode, and takes the padding back off when it switches', () => {
    const { node, set } = scene('safe-area-view');
    const declared = recordDeclarations(node);
    set('edges', { top: 'additive', right: 'off', bottom: 'off', left: 'off' });
    set('mode', 'margin');
    assert.deepEqual(insets(declared), { 'margin-top': 'env(safe-area-inset-top)' });
    set('mode', 'padding');
    assert.deepEqual(insets(declared), { 'padding-top': 'env(safe-area-inset-top)' });
  });

  it('drops every inset when its edges are cleared', () => {
    const { node, set } = scene('safe-area-view');
    const declared = recordDeclarations(node);
    set('edges', { top: 'additive', right: 'additive', bottom: 'additive', left: 'additive' });
    set('edges', null);
    assert.equal(declared.size, 0);
  });
});

describe('modal', () => {
  it('hides only when visible is false, since it defaults to shown', () => {
    const { el, set } = scene('modal');
    set('visible', false);
    assert.equal(el.hasAttribute('hidden'), true);
    set('visible', true);
    assert.equal(el.hasAttribute('hidden'), false);
    set('visible', false);
    set('visible', null);
    assert.equal(el.hasAttribute('hidden'), false);
  });

  it('drops the backdrop when transparent, and gets it back from the reset when not', () => {
    const sheet = document.createElement('style');
    sheet.textContent = RESET_CSS;
    document.head.appendChild(sheet);
    const { el, set } = scene('modal');
    document.body.appendChild(el);

    set('transparent', true);
    assert.equal(window.getComputedStyle(el).backgroundColor, 'rgba(0, 0, 0, 0)');
    set('transparent', false);
    assert.equal(el.style.backgroundColor, '');
    assert.equal(window.getComputedStyle(el).backgroundColor, 'rgba(0, 0, 0, 0.5)');
    el.remove();
    sheet.remove();
  });
});

describe('pointerEvents', () => {
  it('maps none and auto directly, box-none onto none and box-only onto auto', () => {
    const { style, set } = scene('view');
    const cases: [string, string][] = [
      ['none', 'none'],
      ['auto', 'auto'],
      // The box itself opts out; a descendant that says auto opts back in, which is CSS's own
      // override rule. An untouched descendant does not, which native would allow: see props.ts.
      ['box-none', 'none'],
      // The box takes touches. Native would also stop its descendants taking them; CSS cannot
      // say that about children from the parent, so they stay reachable here.
      ['box-only', 'auto'],
    ];
    for (const [value, css] of cases) {
      set('pointerEvents', value);
      assert.equal(style.pointerEvents, css, value);
    }
  });

  it('writes nothing for a value it does not know, and clears when unset', () => {
    const { style, set } = scene('view');
    set('pointerEvents', 'none');
    set('pointerEvents', 'sometimes');
    assert.equal(style.pointerEvents, '');
    set('pointerEvents', 'none');
    set('pointerEvents', null);
    assert.equal(style.pointerEvents, '');
  });
});

describe('text-input', () => {
  it('carries placeholderTextColor as the custom property reset.css reads', () => {
    const { style, set } = scene('text-input');
    set('placeholderTextColor', '#888888');
    assert.equal(style.getPropertyValue('--rn-placeholder-color'), '#888888');
    set('placeholderTextColor', null);
    assert.equal(style.getPropertyValue('--rn-placeholder-color'), '');
    assert.match(
      RESET_CSS,
      /::placeholder \{[^}]*color: var\(--rn-placeholder-color, color-mix\(in srgb, currentColor 45%, transparent\)\);/,
    );
  });

  it('masks the text while secureTextEntry is on, and shows it again when it goes off', () => {
    const { style, set } = scene('text-input');
    set('secureTextEntry', true);
    assert.equal(style.getPropertyValue('-webkit-text-security'), 'disc');
    set('secureTextEntry', false);
    assert.equal(style.getPropertyValue('-webkit-text-security'), '');
  });

  it('gives each keyboardType the inputmode for that keyboard, and the default none', () => {
    const { el, set } = scene('text-input');
    const expected: Record<string, string | null> = {
      numeric: 'numeric',
      'number-pad': 'numeric',
      'decimal-pad': 'decimal',
      'email-address': 'email',
      'phone-pad': 'tel',
      url: 'url',
      default: null,
      'ascii-capable': null,
    };
    for (const [keyboard, mode] of Object.entries(expected)) {
      set('keyboardType', keyboard);
      assert.equal(el.getAttribute('inputmode'), mode, keyboard);
    }
    set('keyboardType', 'email-address');
    set('keyboardType', null);
    assert.equal(el.getAttribute('inputmode'), null);
  });
});

describe('accessibilityRole', () => {
  /** The roles props.ts names as having no ARIA equivalent, written through as they are. */
  const UNMAPPED = new Set([
    'keyboardkey',
    'text',
    'pager',
    'scrollview',
    'horizontalscrollview',
    'webview',
    'drawerlayout',
    'slidingdrawer',
  ]);

  /** WAI-ARIA 1.2's concrete roles: what a mapped role must land on to mean anything. */
  const ARIA = new Set(
    (
      'alert alertdialog application article banner blockquote button caption cell checkbox ' +
      'code columnheader combobox complementary contentinfo definition deletion dialog document ' +
      'emphasis feed figure form generic grid gridcell group heading img insertion link list ' +
      'listbox listitem log main marquee math menu menubar menuitem menuitemcheckbox ' +
      'menuitemradio meter navigation none note option paragraph presentation progressbar radio ' +
      'radiogroup region row rowgroup rowheader scrollbar search searchbox separator slider ' +
      'spinbutton status strong subscript superscript switch tab table tablist tabpanel term ' +
      'textbox time timer toolbar tooltip tree treegrid treeitem'
    ).split(' '),
  );

  it('turns every mapped role into a real ARIA role, and names every one it does not map', async () => {
    const { ROLE_MAP } = await import('./props.ts');
    for (const [role, aria] of Object.entries(ROLE_MAP)) {
      assert.ok(ROLES.has(role), `${role} is in ROLE_MAP but not a role React Native accepts`);
      assert.ok(ARIA.has(aria), `${role} maps to ${aria}, which is not an ARIA role`);
    }
    for (const role of ROLES) {
      assert.ok(
        role in ROLE_MAP || UNMAPPED.has(role),
        `${role} is neither mapped nor documented as having no ARIA equivalent`,
      );
      assert.ok(!(role in ROLE_MAP && UNMAPPED.has(role)), `${role} is both mapped and unmapped`);
    }
  });

  it('writes the mapped role, the unmapped one literally, and nothing when cleared', () => {
    const { el, set } = scene('view');
    set('accessibilityRole', 'header');
    assert.equal(el.getAttribute('role'), 'heading');
    set('accessibilityRole', 'pager');
    assert.equal(el.getAttribute('role'), 'pager');
    set('role', 'none');
    assert.equal(el.getAttribute('role'), 'presentation');
    set('accessibilityRole', null);
    set('role', null);
    assert.equal(el.getAttribute('role'), null);
  });
});

describe('props the other groups leave at their defaults', () => {
  it("reads a live region of none as ARIA's off", () => {
    const { el, set } = scene('view');
    set('accessibilityLiveRegion', 'none');
    assert.equal(el.getAttribute('aria-live'), 'off');
  });

  it('takes an element out of the tab order when it is not focusable', () => {
    const { el, set } = scene('view');
    set('focusable', false);
    assert.equal(el.getAttribute('tabindex'), '-1');
  });

  it('turns autocorrect off when told to', () => {
    const { el, set } = scene('text-input');
    set('autoCorrect', false);
    assert.equal(el.getAttribute('autocorrect'), 'off');
  });

  it('places a caret, not a range, for a selection with no end', () => {
    const { engine, node, el } = scene('text-input');
    const field = el as unknown as HTMLTextAreaElement;
    engine.dispatchCommand(node, 'setTextAndSelection', [1, 'hello', 2, -1]);
    assert.deepEqual([field.selectionStart, field.selectionEnd], [2, 2]);
  });
});
