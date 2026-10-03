/**
 * Every prop `BrowserEngine.setProp` gives a DOM or ARIA meaning to, keyed by prop name and
 * (where two elements use the same prop name differently) by the node's own template name.
 *
 * `packages/components/src/solid/host-props.ts` is the biggest source of these - roughly forty
 * accessibility and identity props every host primitive carries - plus a smaller set each of
 * `text-input.ts`, `switch.ts`, `image.ts`, `safe-area-view.ts` and `modal.ts` layers on top for
 * their own element. A lookup table rather than a `switch`, for the same reason the prototype
 * (`examples/web-button/src/browser-engine.ts`) gives: this reads as data instead of control
 * flow, and it is where a review can see, at a glance, what the file's own comments below say in
 * prose - which props got a translated DOM meaning and which did not.
 *
 * ## The fallback for everything not in a table
 *
 * A prop with no handler here does not disappear the way it would if this file's tables were the
 * whole story: `applyProp`'s fallback writes any remaining string, number or boolean prop as a
 * plain attribute under its own name. This is not a guess - it is what a real prop reaches native
 * as too. `engine.ts`'s `Engine.setProp` puts *everything* in `node.props`, unconditionally, and
 * the whole bag is what a commit sends to the native view; native ignores what it does not
 * recognise rather than this package having to know in advance which of Tailwind's compiled
 * `data-*` attribute selectors (`data-slot`, `data-variant`, `data-state`, and whatever a future
 * component invents) a class string will need to match against. The fallback is what makes that
 * true here too, without enumerating every one.
 *
 * What genuinely gets nothing, because a plain attribute could not carry it or would be actively
 * wrong: an object or array prop with no scalar form (`hitSlop`'s insets, `accessibilityActions`,
 * the Android-drawable props), and iOS-only accessibility surfaces with no ARIA equivalent at all
 * (`accessibilityIgnoresInvertColors`, `accessibilityLargeContentTitle`,
 * `accessibilityShowsLargeContentViewer`, `accessibilityRespondsToUserInteraction`) - these last
 * four are strings/booleans that *would* fall through to the generic attribute write and sit
 * inertly in the DOM if not named here, which is harmless but worth being honest about rather
 * than implying they did something. Named in this comment rather than omitted from it, for the
 * reason `host.ts` gives for its own exclusions: a divergence that is not written down is the
 * failure this project cares about.
 */
import type { BrowserNode } from './dom-node.ts';
import { cssValue, dashCase } from './css-units.ts';
import { writeStyleKey } from './native-style.ts';

function el(node: BrowserNode): Element {
  return node.el as Element;
}

function setOrRemove(node: BrowserNode, attr: string, value: unknown, clear: boolean): void {
  if (clear) el(node).removeAttribute(attr);
  else el(node).setAttribute(attr, String(value));
}

function setStyleProp(node: BrowserNode, prop: string, value: unknown, clear: boolean): void {
  const style = (el(node) as HTMLElement).style;
  if (clear) style.removeProperty(prop);
  else style.setProperty(prop, cssValue(prop, value));
}

/**
 * `accessibilityRole`/`role` values with a direct ARIA `role`. Not every RN role has one -
 * `pager`, `scrollview`, `horizontalscrollview`, `webview`, `drawerlayout`, `slidingdrawer`,
 * `keyboardkey` and `text` name platform widgets ARIA has no vocabulary for - those fall through
 * to the literal value, an unrecognised `role` an assistive technology ignores rather than a wrong
 * one it acts on. `element-props.test.ts` holds this list against `view-base.ts`'s own.
 */
export const ROLE_MAP: Readonly<Record<string, string>> = {
  none: 'presentation',
  button: 'button',
  togglebutton: 'button',
  link: 'link',
  search: 'searchbox',
  image: 'img',
  adjustable: 'slider',
  imagebutton: 'button',
  header: 'heading',
  // A summary of the screen, as a region with its own name; `contentinfo` is the page's footer.
  summary: 'region',
  alert: 'alert',
  checkbox: 'checkbox',
  combobox: 'combobox',
  menu: 'menu',
  menubar: 'menubar',
  menuitem: 'menuitem',
  progressbar: 'progressbar',
  radio: 'radio',
  radiogroup: 'radiogroup',
  scrollbar: 'scrollbar',
  spinbutton: 'spinbutton',
  switch: 'switch',
  tab: 'tab',
  tabbar: 'tablist',
  tablist: 'tablist',
  timer: 'timer',
  list: 'list',
  toolbar: 'toolbar',
  grid: 'grid',
  viewgroup: 'group',
  iconmenu: 'menu',
};

function applyRole(node: BrowserNode, value: unknown, clear: boolean): void {
  const role = typeof value === 'string' ? (ROLE_MAP[value] ?? value) : undefined;
  setOrRemove(node, 'role', role, clear || role === undefined);
  // Which attribute `checked` goes to depends on the role, and the two arrive in either order.
  const state = node.props['accessibilityState'];
  applyAccessibilityState(node, state, state === undefined || state === null);
}

function applyAccessibilityState(node: BrowserNode, value: unknown, clear: boolean): void {
  const state = clear ? undefined : (value as Record<string, unknown> | undefined);
  setOrRemove(node, 'aria-disabled', state?.['disabled'], state?.['disabled'] !== true);
  setOrRemove(node, 'aria-busy', state?.['busy'], state?.['busy'] !== true);
  setOrRemove(node, 'aria-selected', state?.['selected'], state?.['selected'] === undefined);
  setOrRemove(node, 'aria-expanded', state?.['expanded'], state?.['expanded'] === undefined);
  applyChecked(node, state?.['checked']);
}

/**
 * A button is pressed rather than checked: ARIA gives `aria-checked` no meaning on one, so a
 * screen reader said nothing of a checked `togglebutton`, where a device says "on".
 */
function applyChecked(node: BrowserNode, checked: unknown): void {
  const pressed = el(node).getAttribute('role') === 'button';
  setOrRemove(node, 'aria-pressed', checked, checked === undefined || !pressed);
  setOrRemove(node, 'aria-checked', checked, checked === undefined || pressed);
}

function applyAccessibilityValue(node: BrowserNode, value: unknown, clear: boolean): void {
  const v = clear ? undefined : (value as Record<string, unknown> | undefined);
  setOrRemove(node, 'aria-valuemin', v?.['min'], v?.['min'] === undefined);
  setOrRemove(node, 'aria-valuemax', v?.['max'], v?.['max'] === undefined);
  setOrRemove(node, 'aria-valuenow', v?.['now'], v?.['now'] === undefined);
  setOrRemove(node, 'aria-valuetext', v?.['text'], v?.['text'] === undefined);
}

function joinIfArray(value: unknown): unknown {
  return Array.isArray(value) ? value.join(' ') : value;
}

type Handler = (node: BrowserNode, value: unknown, clear: boolean) => void;

/** For a prop that genuinely has nothing to do on the web; see the file doc comment. */
const noop: Handler = () => {};

/** The keys the last whole `style` object wrote, so the next one can remove what it leaves out. */
const writtenStyles = new WeakMap<BrowserNode, Set<string>>();

/**
 * A static `style="flex: 1; margin-top: 4px"`, written whole as a string, as the object it
 * declares. Parsed by a scratch declaration rather than split on `;` and `:`,
 * because on the web a value can hold both: `url(data:image/png;base64,...)`.
 */
function declarations(node: BrowserNode, css: string): Record<string, string> {
  const scratch = el(node).ownerDocument.createElement('div').style;
  scratch.cssText = css;
  const out: Record<string, string> = {};
  for (const name of Array.from(scratch)) out[name] = scratch.getPropertyValue(name);
  return out;
}

/**
 * A whole style object as the `style` prop: what a Solid `style`/`style:key` binding and an
 * animation frame write. A static style string arrives here too. A custom property keeps its
 * name as written: it is case-sensitive, so `--brandTint` is not `--brand-tint`.
 */
const styleKey = (name: string): string => (name.startsWith('--') ? name : dashCase(name));

function applyStyleObject(node: BrowserNode, value: unknown, clear: boolean): void {
  const style = (el(node) as HTMLElement).style;
  const next = new Set<string>();
  // Kept as the object too, so a later `setStyle` mirrors into declarations rather than a string.
  if (typeof value === 'string') value = node.props['style'] = declarations(node, value);
  if (!clear && typeof value === 'object') {
    const keyed: Record<string, unknown> = {};
    for (const [name, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null && v !== undefined) keyed[styleKey(name)] = v;
    }
    for (const key of Object.keys(keyed)) {
      for (const written of writeStyleKey(style, key, keyed)) next.add(written);
    }
  }
  for (const key of writtenStyles.get(node) ?? []) if (!next.has(key)) style.removeProperty(key);
  writtenStyles.set(node, next);
}

/** The shared host props: identical meaning on every element, whatever it committed as. */
const VIEW_BASE_HANDLERS: Record<string, Handler> = {
  style: applyStyleObject,
  accessibilityLabel: (n, v, c) => setOrRemove(n, 'aria-label', v, c),
  accessibilityHint: (n, v, c) => setOrRemove(n, 'aria-description', v, c),
  accessibilityLabelledBy: (n, v, c) => setOrRemove(n, 'aria-labelledby', joinIfArray(v), c),
  accessibilityRole: applyRole,
  role: applyRole,
  accessibilityState: applyAccessibilityState,
  accessibilityValue: applyAccessibilityValue,
  accessibilityLiveRegion: (n, v, c) => setOrRemove(n, 'aria-live', v === 'none' ? 'off' : v, c),
  accessibilityElementsHidden: (n, v, c) => setOrRemove(n, 'aria-hidden', v, c || v !== true),
  // `no` and `no-hide-descendants` both hide the subtree on the web: ARIA has no way to hide a
  // node from the accessibility tree while keeping its descendants individually reachable, which
  // is the one place `no` and `no-hide-descendants` differ on Android.
  importantForAccessibility: (n, v, c) => {
    const hide = v === 'no' || v === 'no-hide-descendants';
    setOrRemove(n, 'aria-hidden', true, c || !hide);
  },
  accessibilityViewIsModal: (n, v, c) => setOrRemove(n, 'aria-modal', v, c || v !== true),
  accessibilityLanguage: (n, v, c) => setOrRemove(n, 'lang', v, c),
  nativeID: (n, v, c) => setOrRemove(n, 'id', v, c),
  id: (n, v, c) => setOrRemove(n, 'id', v, c),
  testID: (n, v, c) => setOrRemove(n, 'data-testid', v, c),
  focusable: (n, v, c) => setOrRemove(n, 'tabindex', v ? '0' : '-1', c),
  pointerEvents: (n, v, c) => {
    // `none` and `auto` map onto the CSS property directly. `box-none` and `box-only` have no
    // exact CSS equivalent - native's version lets a *box* opt out of hit-testing while every
    // descendant keeps receiving touches regardless of its own props; CSS `pointer-events` only
    // has inheritance, which an explicit `auto` on a descendant can override but a plain,
    // untouched descendant cannot escape. Approximated rather than left as a no-op: `box-none`
    // sets `none` on the node itself, `box-only` sets `auto`, which is the more useful default in
    // both directions: a full-window layer that is `box-none` lets touches through to the app
    // under it, and a card inside that sets its own `pointerEvents: 'auto'` opts back in, which
    // is precisely CSS's override rule and needs no web-specific code of its own to work.
    //
    // What this does not do: it does not make an *untouched* descendant of a `box-none` node
    // clickable the way native does automatically - a component that never had to say
    // `pointerEvents="auto"` on native because `box-none` only ever excluded the box itself will
    // need to say so here too. `overlay-host`'s own content is the only place this project has
    // exercised the gap.
    if (v === 'none' || v === 'box-none') setStyleProp(n, 'pointer-events', 'none', c);
    else if (v === 'auto' || v === 'box-only') setStyleProp(n, 'pointer-events', 'auto', c);
    else setStyleProp(n, 'pointer-events', '', true);
  },
  // Object/array props with no scalar form the generic fallback could write, and iOS-only
  // accessibility surfaces with no ARIA equivalent at all. See the file doc comment's second
  // section for why these are named rather than left to fall through.
  hitSlop: noop,
  accessibilityActions: noop,
  nativeBackgroundAndroid: noop,
  nativeForegroundAndroid: noop,
  accessibilityIgnoresInvertColors: noop,
  accessibilityLargeContentTitle: noop,
  accessibilityShowsLargeContentViewer: noop,
  accessibilityRespondsToUserInteraction: noop,
};

/** `text-input.ts`'s own props, applied to the `<textarea>` `elements.ts` creates for it. */
const TEXT_INPUT_HANDLERS: Record<string, Handler> = {
  text: (n, v, c) => {
    const textarea = el(n) as HTMLTextAreaElement;
    const next = c ? '' : String(v);
    // Only when it actually differs: the caret and scroll position reset on every write, even
    // one that sets the value to what it already was, and `TextInput`'s own echo write does
    // exactly that on every keystroke unless this guard is here.
    if (textarea.value !== next) textarea.value = next;
  },
  placeholder: (n, v, c) => setOrRemove(n, 'placeholder', v, c),
  // No inline way to style a pseudo-element, so the colour travels as a custom property and
  // `reset.css` reads it back with `::placeholder`.
  placeholderTextColor: (n, v, c) => setStyleProp(n, '--rn-placeholder-color', v, c),
  keyboardType: (n, v, c) => {
    const map: Record<string, string> = {
      numeric: 'numeric',
      'number-pad': 'numeric',
      'decimal-pad': 'decimal',
      'email-address': 'email',
      'phone-pad': 'tel',
      url: 'url',
    };
    const mode = typeof v === 'string' ? map[v] : undefined;
    setOrRemove(n, 'inputmode', mode, c || mode === undefined);
  },
  returnKeyType: (n, v, c) => {
    const known = new Set(['done', 'go', 'next', 'search', 'send', 'previous']);
    const hint = typeof v === 'string' && known.has(v) ? v : undefined;
    setOrRemove(n, 'enterkeyhint', hint, c || hint === undefined);
  },
  secureTextEntry: (n, v, c) => setStyleProp(n, '-webkit-text-security', v ? 'disc' : '', c || !v),
  autoCapitalize: (n, v, c) => setOrRemove(n, 'autocapitalize', v === 'none' ? 'off' : v, c),
  autoCorrect: (n, v, c) => setOrRemove(n, 'autocorrect', v ? 'on' : 'off', c),
  autoFocus: (n, v, c) => {
    if (!c && v) (el(n) as HTMLElement).focus();
  },
  maxLength: (n, v, c) => setOrRemove(n, 'maxlength', v, c),
  multiline: (n, v, c) => setOrRemove(n, 'data-multiline', '', c || v !== true),
  numberOfLines: (n, v, c) => setOrRemove(n, 'rows', v, c || n.props['multiline'] !== true),
  editable: (n, v, c) => {
    (el(n) as HTMLTextAreaElement).readOnly = !c && v === false;
  },
  selection: (n, v, c) => {
    if (c) return;
    const range = v as { start: number; end?: number };
    (el(n) as HTMLTextAreaElement).setSelectionRange(range.start, range.end ?? range.start);
  },
  selectTextOnFocus: (n, v, c) => setOrRemove(n, 'data-select-on-focus', '', c || v !== true),
  textAlign: (n, v, c) => setStyleProp(n, 'text-align', v, c),
  spellCheck: (n, v, c) => setOrRemove(n, 'spellcheck', v ? 'true' : 'false', c),
  autoComplete: (n, v, c) => setOrRemove(n, 'autocomplete', v, c),
};

/** `switch.ts`'s own props, applied to the `<input type="checkbox">` `elements.ts` creates. */
const SWITCH_HANDLERS: Record<string, Handler> = {
  on: (n, v, c) => {
    (el(n) as HTMLInputElement).checked = !c && v === true;
  },
  value: (n, v, c) => {
    (el(n) as HTMLInputElement).checked = !c && v === true;
  },
  disabled: (n, v, c) => {
    (el(n) as HTMLInputElement).disabled = !c && v === true;
  },
};

/** `image.ts`'s own props. `image` paints with `background-image`; see `elements.ts`. */
const IMAGE_HANDLERS: Record<string, Handler> = {
  source: (n, v, c) => {
    const uri = sourceUri(c ? undefined : v);
    setStyleProp(n, 'background-image', uri ? `url("${cssEscape(uri)}")` : '', !uri);
    if (uri) watchImageLoad(n, uri);
  },
  resizeMode: (n, v, c) => {
    const size: Record<string, string> = {
      cover: 'cover',
      contain: 'contain',
      stretch: '100% 100%',
    };
    const mode = typeof v === 'string' ? v : undefined;
    setStyleProp(n, 'background-size', mode ? (size[mode] ?? 'auto') : '', c || !mode);
    setStyleProp(n, 'background-repeat', mode === 'repeat' ? 'repeat' : 'no-repeat', c);
    setStyleProp(n, 'background-position', 'center', c);
  },
  blurRadius: (n, v, c) =>
    setStyleProp(n, 'filter', typeof v === 'number' ? `blur(${v}px)` : '', c),
  /**
   * The picture's own size, which on native is a default the cascade can override. Written as
   * custom properties that `reset.css` reads at the weakest specificity there is, since an inline
   * `width` would beat the app's own classes here exactly as it would on a device.
   */
  intrinsicSize: (n, v, c) => {
    const size = c ? undefined : (v as { width?: unknown; height?: unknown } | undefined);
    const px = (value: unknown) => (typeof value === 'number' ? `${value}px` : '');
    setStyleProp(n, '--rn-intrinsic-width', px(size?.width), !px(size?.width));
    setStyleProp(n, '--rn-intrinsic-height', px(size?.height), !px(size?.height));
  },
};

/**
 * Says whether a `background-image` loaded, which the property itself will not.
 *
 * An `<image>` paints with `background-image` here (see `elements.ts` for why), and a background
 * fires no `load` or `error` event - only a real `<img>` does. React Native's `Image` reports
 * both, and things depend on it: an avatar-style component that swaps to a fallback when the
 * image errors needs exactly this signal. Without it a broken image URL sat blank forever,
 * showing neither a picture nor a fallback.
 *
 * A detached `Image()` is the standard way to ask. It shares the browser's cache with the
 * background the element is already painting, so this costs a cache lookup rather than a second
 * download.
 *
 * The answer is dispatched as an ordinary DOM event on the element itself, rather than pushed
 * through the engine, so it reaches `(load)` and `(error)` by the same path every other plain
 * binding takes. That is also why `topLoad` and `topError` are not in `browser-engine.ts`'s
 * reserved set: there is a real DOM event of each name here, and it is this one.
 *
 * The uri is remembered so a source that changes mid-flight cannot have its old answer arrive
 * late and overwrite the new one, which is the stale-response guard any fetch needs.
 */
const IMAGE_LOADS = new WeakMap<object, string>();

function watchImageLoad(node: BrowserNode, uri: string): void {
  IMAGE_LOADS.set(node, uri);
  const el = node.el as Element;
  const view = el.ownerDocument.defaultView;
  if (!view) return;
  const probe = new view.Image();
  const settle = (type: 'load' | 'error') => () => {
    if (IMAGE_LOADS.get(node) === uri) el.dispatchEvent(new view.Event(type));
  };
  probe.addEventListener('load', settle('load'));
  probe.addEventListener('error', settle('error'));
  probe.src = uri;
}

function sourceUri(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && 'uri' in (value as object)) {
    return (value as { uri?: string }).uri;
  }
  if (Array.isArray(value) && value.length > 0) return sourceUri(value[0]);
  return undefined;
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, (c) => `\\${c}`);
}

/**
 * `safe-area-view.ts`'s `edges`/`mode`. Applied on either changing, from both current values,
 * because native takes all four edges together and this follows the same rule (see that file's
 * own `resolvedEdges` comment).
 *
 * `env(safe-area-inset-*)` is the real CSS mechanism for this - a phone with a notch reports a
 * non-zero inset through it, the same number `react-native-safe-area-context` reads on iOS. What
 * is not reproduced: `additive` mode is documented as adding the inset to whatever padding a
 * caller's own class already put there, and there is no way to read that back out of a
 * stylesheet this engine cannot inspect - so `additive` and `maximum` both resolve to `env()`
 * alone here, which is `maximum` against a base of zero. A caller relying on `additive` stacking
 * with its own padding will see less padding on the web than on native.
 */
const EDGE_PROP: Record<string, string> = {
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
};

function applySafeAreaInsets(node: BrowserNode): void {
  const edges = node.props['edges'] as Record<string, string> | undefined;
  const mode = (node.props['mode'] as string | undefined) ?? 'padding';
  const family = mode === 'margin' ? 'margin' : 'padding';
  // The family not in use is cleared too, or switching mode left the old insets behind.
  const other = family === 'margin' ? 'padding' : 'margin';
  for (const edge of Object.keys(EDGE_PROP)) {
    const edgeMode = edges?.[edge];
    const prop = `${family}-${EDGE_PROP[edge]}`;
    setStyleProp(node, `${other}-${EDGE_PROP[edge]}`, '', true);
    if (!edgeMode || edgeMode === 'off') setStyleProp(node, prop, '', true);
    else setStyleProp(node, prop, `env(safe-area-inset-${edge})`, false);
  }
}

const SAFE_AREA_HANDLERS: Record<string, Handler> = {
  edges: (n) => applySafeAreaInsets(n),
  mode: (n) => applySafeAreaInsets(n),
};

/**
 * `modal.ts`'s own props. `visible` defaults to `true` there specifically so a mounted-but-hidden
 * host does not swallow touches over nothing (see that file's doc comment); on the web the same
 * concern is a `hidden` attribute, which `reset.css` gives higher specificity than the layout
 * reset's `display: flex` so it actually hides rather than being immediately overridden by it.
 */
const MODAL_HANDLERS: Record<string, Handler> = {
  visible: (n, v, c) => setOrRemove(n, 'hidden', '', c || v !== false),
  transparent: (n, v, c) => setStyleProp(n, 'background-color', 'transparent', c || v !== true),
};

/**
 * `packages/icons/src/svg-props.ts`'s translation, read back the other way.
 *
 * `fill`/`stroke` arrive as a *brush*, not a colour string: `null` for "paint nothing", a real
 * `{type: 0, payload}` object for an actual colour (`payload` already run through
 * `BrowserEngine.color`, which passes a normal CSS colour string straight through), `{type: 2}`
 * for `currentColor`, `{type: 1, brushRef}` for a gradient reference. `strokeLinecap`/
 * `strokeLinejoin`/`fillRule`/`clipRule` arrive as the integers `svg-props.ts` encodes SVG's
 * keywords as - native prop values, not the strings a `<svg-path stroke-linecap="round">` was
 * written with - so the tables below are `svg-props.ts`'s own `LINECAP`/`LINEJOIN`/`FILL_RULE`
 * read backwards. `strokeDasharray` arrives as a string array, already split on commas/whitespace
 * rather than the original string; `matrix` as the six numbers of a 2x3 matrix rather than the
 * `transform` string they came from. All are reconstructed here into the attribute form a browser
 * wants.
 *
 * `propList` gets nothing: it is native prop names this element declared for itself, so that
 * *its* `RNSVGGroup`/`RNSVGPath` inherits nothing it did not ask to inherit - a fake for
 * inheritance real SVG attributes already do on their own, which is the entire reason
 * `svg-props.ts` had to invent it.
 *
 * Geometry (`d`, `cx`, `cy`, `r`, `rx`, `ry`, `x`, `y`, `width`, `height`, `x1`, `y1`, `x2`, `y2`)
 * gets no handler either, on purpose: those prop names are already the SVG attribute names,
 * untouched by `nativeProps`, so `applyProp`'s generic string/number fallback at the bottom of
 * this file writes them correctly with nothing said here.
 */
function brushAttr(value: unknown): string | undefined {
  const brush = value as { type: number; payload?: unknown; brushRef?: string };
  if (brush.type === 2) return 'currentColor';
  if (brush.type === 1) return `url(#${brush.brushRef})`;
  if (brush.type === 0) return typeof brush.payload === 'string' ? brush.payload : undefined;
  return undefined;
}

/**
 * `fill`/`stroke`. Reads `value` itself rather than the `clear` flag `applyProp` would otherwise
 * pass every other handler, because `clear` alone cannot tell apart the two things a cleared
 * brush prop means: `undefined` ("never declared - inherit from the ancestor group, same as real
 * SVG's own cascade") and the brush `null` ("declared as `none` - paint nothing, even if an
 * ancestor would otherwise supply a paint"). Only the second needs an attribute written at all.
 * `dom-node.ts`'s `SVG_BRUSH_ELEMENTS` seeding is what makes sure this handler is even reached for
 * a shape's first `fill="none"`/`stroke="none"` - see that file's own doc comment for why a
 * `null` brush needs help getting here in the first place.
 */
function applyBrush(node: BrowserNode, attr: string, value: unknown): void {
  if (value === undefined) {
    el(node).removeAttribute(attr);
    return;
  }
  if (value === null) {
    el(node).setAttribute(attr, 'none');
    return;
  }
  const resolved = brushAttr(value);
  if (resolved === undefined) el(node).removeAttribute(attr);
  else el(node).setAttribute(attr, resolved);
}

const LINECAP_KEYWORD: Record<number, string> = { 0: 'butt', 1: 'round', 2: 'square' };
const LINEJOIN_KEYWORD: Record<number, string> = { 0: 'miter', 1: 'round', 2: 'bevel' };
const FILL_RULE_KEYWORD: Record<number, string> = { 0: 'evenodd', 1: 'nonzero' };

function applyKeyword(
  node: BrowserNode,
  attr: string,
  map: Readonly<Record<number, string>>,
  value: unknown,
  clear: boolean,
): void {
  const resolved = typeof value === 'number' ? map[value] : undefined;
  setOrRemove(node, attr, resolved, clear || resolved === undefined);
}

/**
 * Every shape `svg-icon.ts` parses out of an icon's markup - `svg-path`, `svg-rect`, `svg-circle`,
 * `svg-line`, plus `svg-g` and `svg-ellipse` - shares this one set of presentation props, the
 * same names `svg-props.ts`'s own `PRESENTATION` table lists.
 */
const SVG_PRESENTATION_HANDLERS: Record<string, Handler> = {
  fill: (n, v) => applyBrush(n, 'fill', v),
  stroke: (n, v) => applyBrush(n, 'stroke', v),
  fillOpacity: (n, v, c) => setOrRemove(n, 'fill-opacity', v, c),
  strokeOpacity: (n, v, c) => setOrRemove(n, 'stroke-opacity', v, c),
  strokeWidth: (n, v, c) => setOrRemove(n, 'stroke-width', v, c),
  strokeLinecap: (n, v, c) => applyKeyword(n, 'stroke-linecap', LINECAP_KEYWORD, v, c),
  strokeLinejoin: (n, v, c) => applyKeyword(n, 'stroke-linejoin', LINEJOIN_KEYWORD, v, c),
  fillRule: (n, v, c) => applyKeyword(n, 'fill-rule', FILL_RULE_KEYWORD, v, c),
  clipRule: (n, v, c) => applyKeyword(n, 'clip-rule', FILL_RULE_KEYWORD, v, c),
  strokeDasharray: (n, v, c) => {
    const joined = Array.isArray(v) ? v.join(',') : undefined;
    setOrRemove(n, 'stroke-dasharray', joined, c || joined === undefined);
  },
  strokeDashoffset: (n, v, c) => setOrRemove(n, 'stroke-dashoffset', v, c),
  strokeMiterlimit: (n, v, c) => setOrRemove(n, 'stroke-miterlimit', v, c),
  opacity: (n, v, c) => setOrRemove(n, 'opacity', v, c),
  matrix: (n, v, c) => {
    const matrix = Array.isArray(v) ? `matrix(${v.join(',')})` : undefined;
    setOrRemove(n, 'transform', matrix, c || matrix === undefined);
  },
  propList: noop,
};

/**
 * The SVG root's own sizing props - `svg-icon.ts`'s host bindings, none of which go through
 * `svg-props.ts`'s `nativeProps` (they are written directly, not parsed off markup).
 * `minX`/`minY`/`vbWidth`/`vbHeight` build one `viewBox` attribute together, and
 * `align`/`meetOrSlice` build one `preserveAspectRatio` together, so each handler rereads every
 * prop in its group off `node.props` rather than trusting the single value it was called with -
 * the same pattern `applySafeAreaInsets` above uses for `edges`/`mode`, needed for the same
 * reason: the renderer applies props one at a time, so whichever of a group changes first would
 * otherwise write an attribute built from the rest still being stale (`undefined`, before their
 * own first commit) or from a previous render's values.
 */
function applySvgViewBox(node: BrowserNode): void {
  const minX = node.props['minX'];
  const minY = node.props['minY'];
  const vbWidth = node.props['vbWidth'];
  const vbHeight = node.props['vbHeight'];
  const complete =
    typeof minX === 'number' &&
    typeof minY === 'number' &&
    typeof vbWidth === 'number' &&
    typeof vbHeight === 'number';
  setOrRemove(
    node,
    'viewBox',
    complete ? `${minX} ${minY} ${vbWidth} ${vbHeight}` : undefined,
    !complete,
  );
}

/**
 * `bbWidth`/`bbHeight` are the root's own rendered size in points - `Icon`'s `size()` input -
 * kept as real `width`/`height` attributes alongside the `[style]` host binding that sizes the
 * box for layout, so an inspector reading the SVG element in isolation sees the same size CSS is
 * about to give it.
 */
function applySvgSize(node: BrowserNode): void {
  const bbWidth = node.props['bbWidth'];
  const bbHeight = node.props['bbHeight'];
  setOrRemove(node, 'width', bbWidth, typeof bbWidth !== 'number');
  setOrRemove(node, 'height', bbHeight, typeof bbHeight !== 'number');
}

/**
 * `0`/`1`/`2` are `RNSVGSvgView`'s own encoding of `meet`/`slice`/`none` - see `svg-props.ts`'s
 * `viewBoxProps`, which always sends `0` for both roots today. `slice`/`none` are translated on
 * the chance a future caller sets one directly, not because either root emits them yet; that
 * would be a divergence worth noting if it ever mattered, but nothing in this codebase exercises
 * it.
 */
const MEET_OR_SLICE: Record<number, string> = { 0: 'meet', 1: 'slice', 2: 'none' };

function applySvgAspectRatio(node: BrowserNode): void {
  const align = node.props['align'];
  const meetOrSlice = node.props['meetOrSlice'];
  if (typeof align !== 'string') {
    el(node).removeAttribute('preserveAspectRatio');
    return;
  }
  const slice = typeof meetOrSlice === 'number' ? (MEET_OR_SLICE[meetOrSlice] ?? 'meet') : 'meet';
  el(node).setAttribute('preserveAspectRatio', `${align} ${slice}`);
}

const SVG_ROOT_HANDLERS: Record<string, Handler> = {
  minX: (n) => applySvgViewBox(n),
  minY: (n) => applySvgViewBox(n),
  vbWidth: (n) => applySvgViewBox(n),
  vbHeight: (n) => applySvgViewBox(n),
  bbWidth: (n) => applySvgSize(n),
  bbHeight: (n) => applySvgSize(n),
  align: (n) => applySvgAspectRatio(n),
  meetOrSlice: (n) => applySvgAspectRatio(n),
  // `Icon`'s own `[color]` host binding - what a shape's `currentColor` brush (`brushAttr`'s
  // `{type: 2}` case, written as the literal attribute value `currentColor`) resolves against.
  // Real SVG's `currentColor` already means "this element's computed CSS `color`", so setting it
  // here as an inline style *is* the whole translation - no downstream shape needs to know the
  // actual value, exactly as native's brush stays unresolved until the view paints.
  color: (n, v, c) => setStyleProp(n, 'color', v, c || typeof v !== 'string'),
};

/**
 * `activity-indicator.ts`'s colour, as the `color` its spinner in `reset.css` paints with. The
 * spinner is drawn by the stylesheet, and `animating` and `hidesWhenStopped` reach it as the
 * plain attributes the fallback writes.
 */
const ACTIVITY_INDICATOR_HANDLERS: Record<string, Handler> = {
  color: (n, v, c) => setStyleProp(n, 'color', v, c || typeof v !== 'string'),
};

const BY_ELEMENT: Record<string, Record<string, Handler>> = {
  'activity-indicator': ACTIVITY_INDICATOR_HANDLERS,
  'text-input': TEXT_INPUT_HANDLERS,
  switch: SWITCH_HANDLERS,
  image: IMAGE_HANDLERS,
  'safe-area-view': SAFE_AREA_HANDLERS,
  modal: MODAL_HANDLERS,
  'svg-g': SVG_PRESENTATION_HANDLERS,
  'svg-path': SVG_PRESENTATION_HANDLERS,
  'svg-circle': SVG_PRESENTATION_HANDLERS,
  'svg-ellipse': SVG_PRESENTATION_HANDLERS,
  'svg-rect': SVG_PRESENTATION_HANDLERS,
  'svg-line': SVG_PRESENTATION_HANDLERS,
  'svg-icon': SVG_ROOT_HANDLERS,
};

/**
 * Apply one prop to its node. `clear` is `value === undefined || value === null`.
 *
 * A key with a handler - either element-specific or from the shared host set - runs exactly
 * that translation. Everything else falls to the generic attribute write the file doc comment
 * describes, which is why a `noop` entry (`hitSlop`, `accessibilityActions`, ...) has to be a
 * real entry rather than an absent one: an absent key falls through and gets written as a raw
 * attribute, a `noop` key is claimed and genuinely does nothing.
 */
export function applyProp(node: BrowserNode, key: string, value: unknown, clear: boolean): void {
  const elementHandler = BY_ELEMENT[node.name]?.[key];
  const baseHandler = VIEW_BASE_HANDLERS[key];
  if (elementHandler || baseHandler) {
    elementHandler?.(node, value, clear);
    baseHandler?.(node, value, clear);
    return;
  }
  if (clear) {
    el(node).removeAttribute(key);
    return;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    el(node).setAttribute(key, String(value));
  }
}
