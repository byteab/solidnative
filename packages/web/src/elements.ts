/**
 * The DOM tag each element name commits as.
 *
 * Every name the renderer creates a host element for - `view`, `text`, `pressable`, and also any
 * other intrinsic name a caller writes (its own `x-widget`, say) - becomes a real element with
 * exactly that tag. A browser accepts any tag name and gives it no built-in
 * unregistered name to a plain `View`, because native only has a fixed set of *real* native views
 * to commit as and an arbitrary string is not one of them. A browser has no such list - there is
 * nothing to fall back from - so this file does not reproduce that fallback; the reason for it on
 * native does not exist on the web. `data-rn="<name>"` still goes on every element regardless (it
 * is what `reset.css` selects on, and what the two exceptions below need it for), but the tag
 * itself is always the literal name unless this table says otherwise.
 *
 * ## The two exceptions
 *
 * The shared host props' writes (a real ARIA `role`, `tabindex`, `aria-*`) are enough accessible
 * behaviour for a view, a piece of text, or a scroll container - no amount of them makes a
 * `<view>` accept a text cursor or a space-bar toggle, though, because those are behaviours the
 * browser's own form controls implement in C++, not CSS or JavaScript this package could add. So:
 *
 * - `text-input` commits as a real `<textarea>`. A `<textarea>` rather than an `<input>` because
 *   `multiline` is a prop set *after* creation (a reactive prop, applied once the element exists,
 *   not known at `createElement`), and a `<textarea>` can stand in for a
 *   single-line field by intercepting `Enter` (see `browser-engine.ts`) in a way an `<input>`
 *   cannot stand in for a multi-line one. `secureTextEntry` is approximated with the
 *   non-standard `-webkit-text-security` (see `props.ts`); Firefox has no equivalent and shows
 *   the text in the clear, which is the one place this package's accessibility parity is
 *   actually worse than a wrong guess would be quieter about.
 * - `switch` commits as a real `<input type="checkbox">`. Its accessible role still comes from
 *   the normal host prop pipeline (`Switch` sets the `'switch'` role, which `props.ts`'s
 *   `ROLE_MAP` turns into `role="switch"`) - this file only has to make the element
 *   a genuine, keyboard- and screen-reader-operable checkbox underneath that role.
 *
 * `image` stays a plain `data-rn="image"` element rather than a real `<img>`, on purpose: RN's
 * `Image` is a box that a picture fills, sized by flex like any other view, not a replaced
 * inline element with its own intrinsic size fighting the layout. `browser-engine.ts` paints the
 * picture with `background-image`, which is what lets `resizeMode` map straight onto
 * `background-size` instead of needing a wrapper element `object-fit` does not.
 *
 * ## The third exception: SVG
 *
 * `packages/icons/src/svg-elements.ts` registers `svg-g`/`svg-path`/`svg-circle`/`svg-ellipse`/
 * `svg-rect`/`svg-line` and its root (`svg-icon`) against Fabric view names (`RNSVGPath` and so
 * on) so that native drives `react-native-svg` directly with no React component of its own in
 * between - see that file's doc comment. A tag created with `document.createElement` is not
 * enough to make that work here: an element born outside the SVG namespace never paints as SVG no
 * matter what tag string it is given (`document.createElement` always mints an
 * `HTMLUnknownElement` for a name a browser does not recognise, SVG names very much included), so
 * these seven names are the only ones in this file that need `ns` - everything else is content
 * HTML has no opinion on and is happy to create by string alone.
 */
export interface ElementSpec {
  readonly tag: string;
  /** Attributes set once, at creation, because the DOM tag needs them to behave at all. */
  readonly attrs?: Readonly<Record<string, string>>;
  /** The element's creation namespace, when it is not HTML's. `createDomElement` reads this to
   * choose `createElementNS` over `createElement` - see "The third exception: SVG" above. */
  readonly ns?: string;
}

/** The one non-HTML namespace this package ever needs. */
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const SPECS: Record<string, ElementSpec> = {
  'text-input': { tag: 'textarea', attrs: { rows: '1' } },
  switch: { tag: 'input', attrs: { type: 'checkbox' } },
  'activity-indicator': { tag: 'activity-indicator', attrs: { role: 'progressbar' } },
  // The shapes `@solid-native/icons`' `svg-elements.ts` registers. Real SVG tag names, not the prefixed
  // template names - `svg-path` would otherwise ask the DOM for an element literally called
  // `<svg-path>`, which the SVG namespace has no such thing as and so mints as an unstyled,
  // unpainted `SVGUnknownElement` instead of a `<path>`.
  'svg-g': { tag: 'g', ns: SVG_NAMESPACE },
  'svg-path': { tag: 'path', ns: SVG_NAMESPACE },
  'svg-circle': { tag: 'circle', ns: SVG_NAMESPACE },
  'svg-ellipse': { tag: 'ellipse', ns: SVG_NAMESPACE },
  'svg-rect': { tag: 'rect', ns: SVG_NAMESPACE },
  'svg-line': { tag: 'line', ns: SVG_NAMESPACE },
  // The root. Commits as the same Fabric view natively (`svg-elements.ts`'s own doc comment); a
  // plain `<svg>` here too; `props.ts`'s `SVG_ROOT_HANDLERS` is what reads `Icon`'s own host
  // bindings into its `viewBox`/size.
  'svg-icon': { tag: 'svg', ns: SVG_NAMESPACE },
};

/**
 * Register a name that needs a real DOM tag or baseline attributes beyond the default (its own
 * name, no attributes) - the web counterpart to `engine.ts`'s `registerViewName`. Nothing in this
 * package needs to guess at an unknown name the way `viewNameOf` does; see the file doc comment
 * for why.
 */
export function registerElementName(name: string, spec: ElementSpec): void {
  SPECS[name] = spec;
}

export function specFor(name: string): ElementSpec {
  return SPECS[name] ?? { tag: name };
}

/**
 * Create the real DOM element for a template tag name, with its `data-rn` marker and attrs.
 *
 * `createElementNS` rather than `createElement` whenever a spec names a namespace - see "The
 * third exception: SVG" above. `setAttribute`, on the other hand, is namespace-agnostic either
 * way (an attribute has no namespace of its own unless explicitly qualified, which `data-rn` and
 * every attribute this package writes never is), so nothing below the element's own creation
 * needs to change for it.
 */
export function createDomElement(document: Document, name: string): Element {
  const spec = specFor(name);
  const el = spec.ns
    ? document.createElementNS(spec.ns, spec.tag)
    : document.createElement(spec.tag);
  el.setAttribute('data-rn', name);
  for (const [attr, value] of Object.entries(spec.attrs ?? {})) el.setAttribute(attr, value);
  return el;
}
