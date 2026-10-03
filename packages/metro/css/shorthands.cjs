/**
 * A shorthand written with more than one value, some of them `var()`.
 *
 * `padding: var(--y) var(--x)` and `border: var(--w) solid var(--c)` are how Bootstrap, Pico and
 * Open Props size and outline nearly everything. lightningcss cannot parse them, since what a
 * `var()` holds is unknown to it, so they arrive as raw tokens, and the compiler used to refuse
 * them all as "a shorthand whose target depends on the value".
 *
 * Most of them do not. A token is single-valued by construction here (`tokenValue` refuses a
 * value of several parts), so each `var()` is exactly one component, and the number of components
 * is known at build time. That settles which sides each covers. The one thing it does not settle
 * is what a `var()` in a `border` *is*, since a width and a colour can come in either order; see
 * `line`.
 */
const { CssUnsupported, fallbacks, tokenValue } = require('./values.cjs');

const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

/** Four-sided shorthands, as the props for top, right, bottom and left in that order. */
const FOUR = {
  padding: SIDES.map((side) => `padding${side}`),
  margin: SIDES.map((side) => `margin${side}`),
  inset: ['top', 'right', 'bottom', 'left'],
  'border-width': SIDES.map((side) => `border${side}Width`),
  // CSS lists corners clockwise from the top left, which is not the order the sides go in.
  'border-radius': [
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
  ],
};

/** Which of the four values each side takes, for one to four values written. */
const FOUR_FROM = [
  [0, 0, 0, 0],
  [0, 1, 0, 1],
  [0, 1, 2, 1],
  [0, 1, 2, 3],
];

/**
 * The logical pairs, as the props every native view reads: `same` when both sides take one value,
 * `split` when they differ.
 *
 * React Native spells them as CSS does - `insetInlineStart`, `marginBlock` - but those are
 * aliases, with no slot in Yoga's style. `YogaLayoutableShadowNode::updateYogaProps` copies them
 * across on the way to layout, and a view whose shadow node sets its style from the props' Yoga
 * style itself skips that and drops them without a word; react-native-safe-area-context's does,
 * so `inset-x-0` on a `<safe-area-view>` did nothing. So the inline axis is Yoga's own Start and
 * End, which follow the layout direction, and the block axis, always vertical on native, is top
 * and bottom. One value on the inline axis is the same either way round, so it is left and right,
 * which a later `left` or `right` can still override as it would in CSS; Start outranks Left in
 * Yoga whatever order they were written in.
 */
const LOGICAL = {
  'inset-inline': { same: ['left', 'right'], split: ['start', 'end'] },
  'inset-block': { same: ['top', 'bottom'], split: ['top', 'bottom'] },
  'margin-inline': { same: ['marginLeft', 'marginRight'], split: ['marginStart', 'marginEnd'] },
  'margin-block': { same: ['marginTop', 'marginBottom'], split: ['marginTop', 'marginBottom'] },
  'padding-inline': {
    same: ['paddingLeft', 'paddingRight'],
    split: ['paddingStart', 'paddingEnd'],
  },
  'padding-block': {
    same: ['paddingTop', 'paddingBottom'],
    split: ['paddingTop', 'paddingBottom'],
  },
};

/** Two-valued shorthands: start then end, or row then column. */
const PAIR = {
  gap: ['rowGap', 'columnGap'],
};

/** The props a pair's values land in, for how many values were written. */
function pairProps(property, count) {
  const logical = LOGICAL[property];
  if (logical) return count === 1 ? logical.same : logical.split;
  return PAIR[property];
}

/** The line shorthands: which prefix their props take, and whether they may carry a style. */
const LINE = {
  border: { prefix: 'border', style: true },
  outline: { prefix: 'outline', style: true },
  'border-top': { prefix: 'borderTop', style: false },
  'border-right': { prefix: 'borderRight', style: false },
  'border-bottom': { prefix: 'borderBottom', style: false },
  'border-left': { prefix: 'borderLeft', style: false },
  // The logical sides, by the native names `properties.cjs` gives them: Start and End for the
  // inline axis, which Yoga lays out by the direction, Top and Bottom for the block axis.
  'border-inline-start': { sides: ['borderStart'], style: false },
  'border-inline-end': { sides: ['borderEnd'], style: false },
  'border-inline': { sides: ['borderStart', 'borderEnd'], style: false },
  'border-block-start': { sides: ['borderTop'], style: false },
  'border-block-end': { sides: ['borderBottom'], style: false },
  'border-block': { sides: ['borderTop', 'borderBottom'], style: false },
};

const LINE_STYLES = new Set(['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset']);
const LINE_WIDTHS = { thin: 1, medium: 3, thick: 5 };

/** A value's components, split where CSS splits a shorthand: on whitespace. */
function components(parts) {
  const out = [[]];
  for (const part of parts) {
    if (part?.type === 'token' && part.value?.type === 'white-space') {
      if (out[out.length - 1].length) out.push([]);
    } else {
      out[out.length - 1].push(part);
    }
  }
  return out.filter((component) => component.length);
}

/** A `var()` as the deferred declaration the runtime resolves, in the form `kind`. */
function reference(part, props, kind, context) {
  return {
    props,
    kind,
    reference: part.value.name.ident,
    ...fallbacks(part, kind, context),
  };
}

/** A written length among the components: `0`, `12px`, `auto`. */
function staticLength(part, context) {
  const value = tokenValue([part], context);
  const found = value?.length ?? (value?.number === 0 ? 0 : undefined);
  if (typeof found === 'number' || typeof found === 'string') return found;
  if (value?.keyword === 'auto') return 'auto';
  throw new CssUnsupported(`${context}: '${describe(part)}' is not a length this can place`);
}

function describe(part) {
  return JSON.stringify(part?.value ?? part).slice(0, 40);
}

/**
 * Padding, margin, inset, border width and radius, gap and the logical pairs.
 *
 * @returns `{ declarations, deferred }`, or null if this is not a shape this understands and the
 *   compiler's own message should stand
 */
function positional(property, list, context, linear) {
  const four = FOUR[property];
  const count = list.length;
  const props = four ?? pairProps(property, count);
  // One value in a four-sided shorthand is the compiler's own, older path; more than four, or
  // more than two in a pair, is not CSS.
  if (!props || count > props.length || (four && count === 1)) return null;
  const from = four ? FOUR_FROM[count - 1] : count === 1 ? [0, 0] : [0, 1];

  const declarations = {};
  const deferred = [];
  props.forEach((prop, side) => {
    const [part, ...rest] = list[from[side]];
    if (rest.length) throw new CssUnsupported(`${context}: could not read '${property}'`);
    if (part.type === 'var') deferred.push(reference(part, [prop], 'length', context));
    else if (part.type === 'function') deferred.push(arithmetic(part, prop, context, linear));
    else declarations[prop] = staticLength(part, context);
  });
  return { declarations, deferred };
}

/**
 * `calc(var(--x) * .5)` as one component: the compiler's own reading of arithmetic around one
 * `var()`, which it already applies to a property with a single value.
 */
function arithmetic(part, prop, context, linear) {
  const found = linear(part, context);
  if (!found) {
    throw new CssUnsupported(
      `${context}: '${part.value?.name}()' is not arithmetic on one var() that can be settled ` +
        `here, so it needs evaluating on device`,
    );
  }
  return {
    ...reference(found.reference, [prop], 'length', context),
    ...(found.adjust ? { adjust: found.adjust } : {}),
  };
}

/**
 * `border`, `outline` and the per-side borders, where the components come in any order.
 *
 * A written component says what it is. A `var()` does not, so it is offered twice, once as the
 * width and once as the colour, and the token decides on device: a length has no colour form and
 * a colour has no length form, so exactly one of the two resolves. Anything left out takes its
 * initial value as CSS says: no style means no line at all, which native is told as a width of 0.
 */
// eslint-disable-next-line complexity -- one flat case per kind of component
function line(property, list, context) {
  const { prefix, style: withStyle, sides: named } = LINE[property];
  if (list.length < 2) return null;
  // Every side spelled out for `border`, for the reason `lineSides` gives in properties.cjs.
  const sides = named ?? (prefix === 'border' ? SIDES.map((side) => `border${side}`) : [prefix]);
  const widths = sides.map((side) => `${side}Width`);
  const colors = sides.map((side) => `${side}Color`);

  const declarations = {};
  const references = [];
  let style = null;
  let color = null;
  let width = null;
  for (const [part, ...rest] of list) {
    if (rest.length) throw new CssUnsupported(`${context}: could not read '${property}'`);
    if (part.type === 'var') {
      references.push(part);
      continue;
    }
    const value = tokenValue([part], context);
    const word = value?.keyword;
    if (LINE_STYLES.has(word) || word === 'none' || word === 'hidden') style = word;
    else if (word in LINE_WIDTHS) width = LINE_WIDTHS[word];
    else if (value?.length !== undefined) width = value.length;
    else if (value?.color !== undefined) color = value.color;
    else throw new CssUnsupported(`${context}: '${describe(part)}' in '${property}'`);
  }

  const every = (props, to) => Object.fromEntries(props.map((prop) => [prop, to]));

  // With no style written, a var() may be the style, and one is offered as that too. A length or a
  // colour token has no keyword form, so only a style token resolves there.
  //
  // ponytail: a style token of `none` then paints as native's default, solid, where CSS draws no
  // line. Honouring it means turning a token into a width on device; nothing seen writes one.
  const styleInToken = style === null;
  if (style === 'none' || style === 'hidden')
    return { declarations: every(widths, 0), deferred: [] };
  if (!withStyle && style !== 'solid' && !styleInToken) {
    throw new CssUnsupported(
      `${context}: native has one border style for the whole box, so a '${style}' side cannot ` +
        `be drawn. Solid, native's default, is the one a single side can say.`,
    );
  }
  Object.assign(declarations, width === null ? {} : every(widths, width));
  Object.assign(declarations, color === null ? {} : every(colors, color));
  if (withStyle && style !== null) declarations[`${prefix}Style`] = style;

  const deferred = references.flatMap((part) => [
    ...(width === null ? [reference(part, widths, 'length', context)] : []),
    ...(withStyle && styleInToken ? [reference(part, [`${prefix}Style`], 'keyword', context)] : []),
    ...(color === null ? [reference(part, colors, 'color', context)] : []),
  ]);
  return { declarations, deferred };
}

/**
 * A shorthand with `var()` among several values, as plain declarations for the parts that were
 * written and deferred ones for the rest. Null when this is not one, so the caller's own path and
 * message apply.
 */
function expandShorthand(value, context, linear) {
  const property = value?.propertyId?.property;
  const parts = value?.value ?? [];
  if (property === 'text-shadow') return textShadow(parts, context);
  const list = components(parts);
  if (property === 'flex') return flexGrowing(list, context);
  if (LINE[property]) return line(property, list, context);
  return positional(property, list, context, linear);
}

/**
 * `text-shadow` with a token in its colour or a length: native's three props, each settled here
 * where it can be and on device where it cannot. Native has room for one text shadow, not a list.
 */
function textShadow(parts, context) {
  const { shadowsWithColourTokens } = require('./colour-expression.cjs');
  const shadows = shadowsWithColourTokens(parts, context);
  if (shadows.length !== 1) {
    throw new CssUnsupported(
      `${context}: native has room for one text-shadow, not ${shadows.length}`,
    );
  }
  if (shadows[0].__shadows) {
    throw new CssUnsupported(
      `${context}: a whole text-shadow in one token is three props on native, and a token is ` +
        `read in one form: write its parts out, with tokens in them if they vary.`,
    );
  }
  const [{ offsetX, offsetY, blurRadius, color }] = shadows;
  const declarations = {};
  const deferred = [];
  const put = (prop, value) => {
    if (JSON.stringify(value).includes('"__')) deferred.push({ props: [prop], within: value });
    else declarations[prop] = value;
  };
  put('textShadowOffset', { width: offsetX, height: offsetY });
  put('textShadowRadius', blurRadius);
  put('textShadowColor', color);
  return { declarations, deferred };
}

/** `flex: var(--grow)`: a number, so what `flex: <number>` is, growing by the token. */
function flexGrowing(list, context) {
  const [only, ...rest] = list;
  if (rest.length || only?.length !== 1 || only[0].type !== 'var') return null;
  // The shrink and the basis `flex: <number>` sets, written only once the token is known to be
  // there. With no token the declaration is invalid at computed-value time on the web, and `flex`
  // takes its initial value, `0 1 auto`, whatever a weaker rule set.
  const grow = reference(only[0], ['flexGrow'], 'number', context);
  return {
    declarations: {},
    deferred: [
      { ...grow, unset: 0 },
      { ...grow, props: ['flexShrink'], whenSet: 1, unset: 1 },
      { ...grow, props: ['flexBasis'], whenSet: '0%', unset: 'auto' },
    ],
  };
}

module.exports = { expandShorthand, LOGICAL };
