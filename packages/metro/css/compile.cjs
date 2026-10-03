/**
 * Compile a component's CSS into a rule set the runtime can match against.
 *
 * Build time does the parsing, longhand expansion, value conversion and specificity maths, so
 * the device only ever does selector matching and a merge. Anything native cannot express is an
 * error here rather than a style that quietly does nothing.
 */
const lightning = require('lightningcss');
const {
  colourExpression,
  isRelative,
  meaningful,
  mentionsLightDark,
  schemeSide,
  shadowsWithColourTokens,
} = require('./colour-expression.cjs');
const {
  CssUnsupported,
  fallbacks,
  tokenValue,
  formOf,
  length,
  keyword,
  round,
} = require('./values.cjs');
const {
  translate,
  finishTransition,
  animationTimeWithTokens,
  finishAnimation,
  frameEasing,
  finishBox,
  unsupported,
  kindOf,
  propsFor,
  camel,
  ALIASES,
} = require('./properties.cjs');
const { deferGradient, GRADIENTS } = require('./gradients.cjs');
const { calcWithTokens, motionWithTokens } = require('./token-arithmetic.cjs');
const { undrawnOnIos } = require('./filters.cjs');
const { expandShorthand } = require('./shorthands.cjs');

/** Standard CSS specificity, packed so it sorts numerically. */
const pack = (ids, classes, types) => ids * 1_000_000 + classes * 1_000 + types;

/**
 * Arithmetic around a `var()`, worked out at build time so the device never sees an expression.
 *
 * This exists because of the safe-area insets. An inset says where the system's furniture ends,
 * not where a layout should begin, so nearly every honest use of one is "the inset plus the
 * padding this design wanted" (`calc(var(--x) + 12px)`) or "whichever of the two is larger"
 * (`max(var(--x), 16px)`). Tailwind writes those with the spacing scale inside, so what arrives
 * here is `calc(var(--x) + calc(.25rem * 4))` - nested, and in units that are not points.
 *
 * Everything linear in one unknown is understood: the value is reduced to `scale * var + offset`,
 * optionally floored by a `max()` around the whole thing. Anything else - two variables, a
 * variable in a divisor, a `min()` - returns null and is refused, because the alternative is a
 * calc engine on device, which is a CSS parser by another name.
 */
function linear(part, context) {
  const { name, arguments: args } = part.value ?? {};
  if (name !== 'calc' && name !== 'max') return null;

  const found = variables(part);
  if (found.length !== 1) return null;
  const reference = found[0];

  const value =
    name === 'max'
      ? floored(terms(args), reference, context)
      : evaluateLinear(terms(args), reference, context);
  return value?.scale ? { reference, adjust: trim(value) } : null;
}

/** `max(<linear>, <length>)` in either order: the same value, with a lower bound on it. */
function floored(list, reference, context) {
  const sides = split(list, 'comma');
  if (sides.length !== 2) return null;
  const [a, b] = sides.map((side) => evaluateLinear(side, reference, context));
  const [value, bound] = a?.scale ? [a, b] : [b, a];
  if (!value || !bound || bound.scale) return null;
  return { ...value, floor: bound.offset };
}

/** Every `var()` in a math function, however deeply nested. One is understood; two are not. */
function variables(node) {
  if (node?.type === 'var') return [node];
  const args = node?.value?.arguments;
  return Array.isArray(args) ? args.flatMap(variables) : [];
}

/** The meaningful arguments of a math function: whitespace separates nothing here. */
function terms(args) {
  return (args ?? []).filter((arg) => !(arg.type === 'token' && arg.value?.type === 'white-space'));
}

/** The delimiter a term is, if it is one: `+`, `-`, `*`, `/` or `comma`. */
function operator(term) {
  if (term?.type !== 'token') return null;
  if (term.value?.type === 'comma') return 'comma';
  return term.value?.type === 'delim' ? term.value.value : null;
}

/** Split a term list on one operator, dropping it. */
function split(list, on) {
  const parts = [[]];
  for (const term of list) {
    if (operator(term) === on) parts.push([]);
    else parts[parts.length - 1].push(term);
  }
  return parts;
}

/**
 * A term list reduced to `scale * reference + offset`, or null if it is not linear in it.
 *
 * Sums first, because `+` and `-` bind loosest, exactly as they do in CSS.
 */
function evaluateLinear(list, reference, context) {
  let total = { scale: 0, offset: 0 };
  let sign = 1;
  let current = [];

  const take = () => {
    const value = evaluateProduct(current, reference, context);
    if (!value) return false;
    total = { scale: total.scale + sign * value.scale, offset: total.offset + sign * value.offset };
    current = [];
    return true;
  };

  for (const term of list) {
    const op = operator(term);
    if (op !== '+' && op !== '-') {
      current.push(term);
      continue;
    }
    if (!take()) return null;
    sign = op === '+' ? 1 : -1;
  }
  return take() ? total : null;
}

/** One product or quotient of leaves. At most one of them may be the reference. */
function evaluateProduct(list, reference, context) {
  let total = null;
  let op = '*';

  for (const term of list) {
    const delimiter = operator(term);
    if (delimiter === '*' || delimiter === '/') {
      op = delimiter;
      continue;
    }
    const value = leaf(term, reference, context);
    if (!value) return null;
    if (total === null) {
      total = value;
      continue;
    }
    // A variable may be scaled but never multiplied by or divided into another variable: that is
    // not linear, and there is nothing to fold it into.
    if (value.scale && (op === '/' || total.scale)) return null;
    const [a, b] = op === '*' ? [total, value] : [total, { scale: 0, offset: 1 / value.offset }];
    if (a.scale && b.scale) return null;
    total = { scale: a.scale * b.offset + b.scale * a.offset, offset: a.offset * b.offset };
  }
  return total;
}

/** A single term: the reference itself, a nested `calc()`, a length in points, or a number. */
function leaf(term, reference, context) {
  if (term === reference) return { scale: 1, offset: 0 };
  const constant = (value) => ({ scale: 0, offset: value });

  switch (term?.type) {
    case 'var':
      return null;
    case 'function':
      return term.value?.name === 'calc'
        ? evaluateLinear(terms(term.value.arguments), reference, context)
        : null;
    case 'token':
      return term.value?.type === 'number' ? constant(term.value.value) : null;
    default: {
      const points = length(term, context);
      return typeof points === 'number' ? constant(points) : null;
    }
  }
}

/** The adjustment, with the parts that say nothing left out, so a plain `var()` stays plain. */
function trim({ scale, offset, floor }) {
  return {
    ...(scale === 1 ? {} : { scale }),
    ...(offset === 0 ? {} : { offset }),
    ...(floor === undefined ? {} : { floor }),
  };
}

/**
 * `color-mix(in <space>, var(--x) N%, transparent)`: a token at reduced opacity.
 *
 * The one form Tailwind writes, for `bg-primary/90` and every other slashed colour. It cannot be
 * folded here, because the colour is a themed token whose value depends on where in the tree it is
 * read, so it becomes the same deferred reference a plain `var()` does with the percentage carried
 * along as an alpha to apply once the token is known.
 *
 * Any other mix - two real colours, a token on both sides - is carried to the device as a colour
 * expression and worked out there in the space it names (see `colour-expression.cjs` and the
 * engine's `color-mix.ts`): the `in oklab` is not decoration, it changes the result.
 */
function deferColorMix(fn, property, context) {
  if (kindOf(property) !== 'color') {
    throw new CssUnsupported(`${context}: color-mix() in '${property}', which is not a colour`);
  }
  const { varPart, percentage, faded } = mixParts(fn.arguments ?? []);
  const reference = varPart?.value?.name?.ident;
  if (!faded || !reference || percentage === undefined) {
    return {
      props: propsFor(property),
      within: { __colour: colourExpression([{ type: 'function', value: fn }], context) },
    };
  }
  if (!reference || percentage === undefined) {
    throw new CssUnsupported(
      `${context}: color-mix() needs a var() and a percentage to be deferred. Without a var() it ` +
        `should have been folded at build time, which is a bug here rather than in the sheet.`,
    );
  }

  return {
    props: propsFor(property),
    kind: 'color',
    reference,
    adjust: { alpha: round(percentage) },
    ...fallbacks(varPart, 'color', context),
  };
}

/**
 * `rgba(var(--channels), <alpha>)`: a colour whose channels are a token, with an alpha written
 * beside them or taken from a token of its own.
 *
 * It is how Bootstrap writes every colour utility - `.text-primary` is
 * `rgba(var(--bs-primary-rgb), var(--bs-text-opacity))` - so that `.text-opacity-50` can change
 * the one token and not the colour. Both are read on device, where the cascade has settled them.
 *
 * @returns the deferred declaration, or null if this is not that shape
 */
function deferChannels(part, property, context) {
  const name = part?.type === 'function' ? part.value?.name?.toLowerCase() : null;
  if (name !== 'rgb' && name !== 'rgba') return null;
  const args = terms(part.value.arguments).filter((arg) => operator(arg) !== 'comma');
  const [channels, alpha, ...rest] = args;
  if (channels?.type !== 'var' || rest.length || kindOf(property) !== 'color') return null;

  const fallback = varFallback(channels, 'channels', context);
  return {
    props: propsFor(property),
    kind: 'channels',
    reference: channels.value.name.ident,
    ...(fallback === undefined ? {} : { fallback }),
    ...opacityOf(alpha, context),
  };
}

/** The alpha of a channels colour: none, written, or a token of its own. */
function opacityOf(alpha, context) {
  if (alpha === undefined) return {};
  if (alpha.type !== 'var') return { adjust: { alpha: alphaOf(alpha, context) } };
  const fallback = varFallback(alpha, 'number', context);
  return {
    alpha: { reference: alpha.value.name.ident, ...(fallback === undefined ? {} : { fallback }) },
  };
}

/**
 * `--x: hsl(var(--h), var(--s), var(--l))`, comma or space syntax, with an optional alpha: how
 * Bulma writes every colour, so `.has-text-primary-05` can change one lightness token and not the
 * whole hue. Only a `--` definition takes this shape; a declaration with `var()` mixed into a
 * colour otherwise still needs a parser on device, which is `deferVar`'s existing refusal.
 *
 * Unlike `deferChannels`, which finishes at the use site, this settles nothing here: the channels
 * may themselves be tokens the cascade has not resolved yet, so the whole thing is carried as a
 * deferred form on the token and turned into a colour once, alongside its aliases (see
 * `resolveAliases` in css.ts), rather than at every place the token is read.
 *
 * A channel that is neither a `var()` nor a plain number - `calc(var(--l) + var(--delta))`, which
 * is Bulma's own shade arithmetic - falls through to null rather than being reported here, so it
 * keeps the ordinary "has a value native cannot express in any form" refusal: calc() between two
 * tokens is out of scope everywhere in this compiler, not specially so inside hsl().
 *
 * @returns `{ hsl }`, or null if this is not that shape or a channel cannot be read
 */
function deferHslToken(parts) {
  if (parts.length !== 1) return null;
  const part = parts[0];
  const name = part?.type === 'function' ? part.value?.name?.toLowerCase() : null;
  if (name !== 'hsl' && name !== 'hsla') return null;

  const args = terms(part.value.arguments).filter((arg) => {
    const op = operator(arg);
    return op !== 'comma' && op !== '/';
  });
  if (args.length !== 3 && args.length !== 4) return null;

  const channels = args.map(hslChannel);
  if (channels.some((channel) => channel === undefined)) return null;

  const [h, s, l, alpha] = channels;
  return { hsl: { h, s, l, ...(alpha === undefined ? {} : { alpha }) } };
}

/**
 * `--x: rgba(var(--channels), <alpha>)`: a colour token made of a channels token and an alpha
 * written beside it or taken from a token of its own. Bootstrap's colours as a token, and how
 * Tailwind 3's `ring-opacity-50` fades a ring, whose colour is a token the ring reads.
 *
 * Settled on the node that defines it, as an hsl() token is: see `resolveAliases` in css.ts.
 *
 * @returns `{ deferredColour }`, or null if this is not that shape
 */
function deferChannelsToken(parts, context) {
  if (parts.length !== 1) return null;
  const deferred = deferChannels(parts[0], 'color', context);
  if (!deferred) return null;
  const alpha = deferred.alpha ?? deferred.adjust?.alpha;
  return {
    deferredColour: {
      channels: {
        reference: deferred.reference,
        ...(deferred.fallback === undefined ? {} : { fallback: deferred.fallback }),
      },
      ...(alpha === undefined ? {} : { alpha }),
    },
  };
}

/**
 * One channel of an hsl() token: a `var()` naming another token, with its fallback read the same
 * way a literal channel is; a value settled here; or undefined, when it is neither.
 */
function hslChannel(term) {
  if (term?.type === 'var') {
    const literal = terms(term.value?.fallback ?? [])[0];
    const fallback = literal ? hslLiteral(literal) : undefined;
    return {
      reference: term.value.name.ident,
      ...(fallback === undefined ? {} : { fallback }),
    };
  }
  return hslLiteral(term);
}

/** Degrees per unit, so a hue written in any angle unit reads as the degrees hslToRgb expects. */
const HUE_UNITS = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

/** A hue lightningcss has already parsed as an angle: `221deg`, the shape it prefers as an hsl()'s first argument. */
function angleLiteral(term) {
  if (term?.type !== 'angle') return undefined;
  const unit = term.value?.type;
  return round(term.value.value * (HUE_UNITS[unit] ?? 1));
}

/** A number, a percentage, or a hue left as a raw dimension token rather than parsed as an angle. */
function tokenLiteral(term) {
  const token = term?.type === 'token' ? term.value : null;
  if (token?.type === 'number' || token?.type === 'percentage') return round(token.value);
  if (token?.type === 'dimension' && token.value?.unit === 'deg') return round(token.value.value);
  return undefined;
}

/**
 * A literal hsl() channel: a hue in degrees, or a fraction already scaled the way every other
 * percentage in this compiler is (see `length`'s percentage case). That fraction is exactly what
 * saturation, lightness and alpha want, so nothing here has to know which channel it is reading.
 */
function hslLiteral(term) {
  return angleLiteral(term) ?? tokenLiteral(term);
}

/** A written alpha: a number, or a percentage of one. */
function alphaOf(term, context) {
  const value = term?.value;
  if (value?.type === 'number') return round(value.value);
  if (value?.type === 'percentage') return round(value.value);
  throw new CssUnsupported(`${context}: could not read the alpha of an rgba()`);
}

/** A `var()`'s fallback, converted to the form the use site needs, or undefined if it has none. */
function varFallback(varPart, kind, context) {
  const raw = varPart.value?.fallback;
  const converted = raw ? tokenValue(raw, `${context} (fallback)`) : null;
  return formOf(converted, kind);
}

/** The three things that matter in a `color-mix()`, picked out of its argument tokens. */
function mixParts(args) {
  const parts = args.filter(
    (part) => !(part.type === 'token' && part.value?.type === 'white-space'),
  );
  const words = parts.filter((part) => part.type === 'token' && part.value?.type === 'ident');
  return {
    varPart: parts.find((part) => part.type === 'var'),
    percentage: parts.find((part) => part.value?.type === 'percentage')?.value?.value,
    faded: words[words.length - 1]?.value?.value === 'transparent',
  };
}

/** The layers of a background that is gradients and commas only, or null if it is anything else. */
function gradientLayers(parts) {
  const meaningfulParts = parts.filter(
    (part) => !(part.type === 'token' && part.value?.type === 'white-space'),
  );
  const layers = meaningfulParts.filter(
    (part) => !(part.type === 'token' && part.value?.type === 'comma'),
  );
  const isGradient = (part) => part?.type === 'function' && GRADIENTS.has(part.value?.name);
  if (layers.length < 2 || !layers.every(isGradient)) return null;
  return meaningfulParts.length === layers.length * 2 - 1 ? layers : null;
}

/**
 * The list properties that can be written as slots of tokens, the marker each slot is, and the
 * prop the list lands in.
 */
const SLOTTED = {
  filter: { marker: '__filters', prop: 'filter' },
  transform: { marker: '__transforms', prop: 'transform' },
  'font-variant-numeric': { marker: '__variants', prop: 'fontVariant' },
};

/**
 * One slot of a list that is all tokens, `var(--tw-blur,)`: a token holding a function, or
 * nothing. Tailwind gives each filter utility, and each 3D rotation and skew, a slot of its own
 * and has every one of them read all the slots, so `blur-sm grayscale` is one list made of two
 * classes, spliced on device.
 */
function listSlot(part, marker, context) {
  const fallback = part.value?.fallback;
  if (fallback && meaningful(fallback).length) {
    throw new CssUnsupported(
      `${context}: a slot's fallback in a list of tokens can only be empty, as in 'var(--x,)'. ` +
        `Put the function in the token instead.`,
    );
  }
  return {
    [marker]: { reference: part.value?.name?.ident, ...(fallback ? { fallback: [] } : {}) },
  };
}

/**
 * A declaration whose value contains `var()`, recorded for resolution at match time.
 *
 * The reference and the fallback are settled here, along with which RN property the result lands
 * in and what sort of value it must be converted to, so the device only does a map lookup.
 */
// Navigating lightningcss's untyped AST. Every `?.` and `??` counts as a branch, so the
// complexity score here measures defensiveness rather than logic: one line of
// `v?.a ?? v?.b ?? 'x'` scores 7 on its own.
// eslint-disable-next-line complexity
function deferVar(value, context) {
  const property = value?.propertyId?.property ?? 'a property';
  const parts = value?.value ?? [];

  if (parts.length === 1 && parts[0]?.type === 'function' && GRADIENTS.has(parts[0].value?.name)) {
    return deferGradient(parts[0], context);
  }
  const layers = gradientLayers(parts);
  if (layers) {
    // A layered background with a var() in any layer: every layer a template, painted together.
    const templates = layers.map((layer) => deferGradient(layer, context).gradient);
    return { props: ['experimental_backgroundImage'], gradient: templates };
  }

  if (parts.length === 1 && parts[0]?.type === 'function' && parts[0].value?.name === 'color-mix') {
    return deferColorMix(parts[0].value, property, context);
  }
  // A relative colour from a token, `oklch(from var(--brand) l c h / 0.2)`, worked out on device;
  // or one colour with no token in it at all, a light-dark() side beside one that has.
  if (kindOf(property) === 'color' && (isRelativeColour(parts) || isLoneLiteral(parts))) {
    return { props: propsFor(property), within: { __colour: colourExpression(parts, context) } };
  }

  // A shadow written out with a token in its colour. A whole shadow that is one token, as
  // Bootstrap's `var(--bs-box-shadow-sm)`, is a shadow token and read as one below.
  const written = parts.filter(
    (part) => !(part.type === 'token' && part.value?.type === 'white-space'),
  );
  if (property === 'box-shadow' && !(written.length === 1 && written[0].type === 'var')) {
    return { props: ['boxShadow'], within: shadowsWithColourTokens(parts, context) };
  }

  if (SLOTTED[property] && written.every((part) => part.type === 'var')) {
    const { marker, prop } = SLOTTED[property];
    const within = written.map((part) => listSlot(part, marker, context));
    return { props: [prop], within };
  }

  const channels = parts.length === 1 ? deferChannels(parts[0], property, context) : null;
  if (channels) return channels;

  const motion = motionWithTokens(property, parts, context);
  if (motion) return motion;

  const arithmetic =
    parts.length === 1 && parts[0]?.type === 'function' ? linear(parts[0], context) : null;
  const varPart = arithmetic ? arithmetic.reference : parts.length === 1 ? parts[0] : null;

  if (varPart?.type !== 'var') {
    // More than one token in a calc(), worked out on device as a tree.
    const tokened = calcWithTokens(parts, kindOf(property), context);
    if (tokened !== null) return { props: propsFor(property), within: tokened };
    throw new CssUnsupported(
      `${context}: '${property}' mixes var() with other values, which needs a parser on device. ` +
        `calc() of tokens, numbers and points, max(var(--x), <length>), colours and transforms ` +
        `are understood; anything else has to be worked out at build time.`,
    );
  }

  const kind = kindOf(property);
  if (kind === null) {
    throw new CssUnsupported(
      `${context}: var() cannot be used in the '${property}' shorthand, because which native ` +
        `property the value lands in depends on the value, and there is no CSS parser on device. ` +
        `Use the longhand.`,
    );
  }

  const reference = varPart.value?.name?.ident;
  if (!reference) throw new CssUnsupported(`${context}: could not read the var() reference`);

  if (arithmetic && kind !== 'length') {
    throw new CssUnsupported(
      `${context}: arithmetic on var() only makes sense for a length, and '${property}' is not`,
    );
  }

  return {
    props: propsFor(property),
    kind,
    reference,
    ...(arithmetic?.adjust ? { adjust: arithmetic.adjust } : {}),
    ...fallbacks(varPart, kind, context),
    ...(property in UNSET ? { unset: UNSET[property] } : {}),
  };
}

/**
 * A property's initial value, where it differs from leaving the property out on native: what a
 * browser gives a property whose `var()` cannot be substituted, and what the engine writes then.
 */
const UNSET = { 'flex-grow': 0, 'flex-shrink': 1, 'flex-basis': 'auto' };

/** Why an at-rule where a style rule was expected is refused, naming the at-rule as written. */
function refusedAtRule(rule, context) {
  if (rule.type === 'keyframes') {
    // Only reachable from inside a query: at the top level `compileRule` takes them first.
    return new CssUnsupported(
      `${context}: a @keyframes inside @media is not supported. Keyframes are global here, so ` +
        `there is nothing for the condition to attach to; write it at the top level.`,
    );
  }
  // The rule type is the at-rule's own keyword. Only an at-rule lightningcss does not know
  // carries its keyword in `name`: a container query's `name` is the container's.
  const name =
    rule.type === 'unknown' && typeof rule.value?.name === 'string'
      ? rule.value.name
      : (AT_RULE_NAMES[rule.type] ?? rule.type);
  return new CssUnsupported(
    `${context}: '@${name}' is not supported. Media queries and keyframes are the only ` +
      `at-rules with a runtime meaning here.`,
  );
}

/** Rule types whose at-rule is spelled differently in a stylesheet. */
const AT_RULE_NAMES = { 'layer-block': 'layer', 'layer-statement': 'layer' };

/** The pseudo-classes that count siblings by element type, which the matcher does not track. */
const OF_TYPE = new Set([
  'first-of-type',
  'last-of-type',
  'only-of-type',
  'nth-of-type',
  'nth-last-of-type',
]);

/** Range operators, as the runtime spells them. */
const RANGE_OPS = {
  'greater-than': 'gt',
  'greater-than-equal': 'gte',
  'less-than': 'lt',
  'less-than-equal': 'lte',
  equal: 'eq',
};

/** An operator read from the other side: '300px < width' is 'width > 300px'. */
const FLIPPED = {
  'greater-than': 'less-than',
  'greater-than-equal': 'less-than-equal',
  'less-than': 'greater-than',
  'less-than-equal': 'greater-than-equal',
  equal: 'equal',
};

/** The size of an em in a media query, which is the initial font size and not the one in scope. */
const MEDIA_EM = 16;

/** A width or height a media query compares the viewport with, in points. */
function mediaLength(value, context) {
  const dimension = value?.value?.value;
  if (value?.type === 'length' && dimension?.unit === 'em') return dimension.value * MEDIA_EM;
  const points = length(value, `${context} (media query)`);
  if (typeof points !== 'number') {
    throw new CssUnsupported(`${context}: a media query compares the viewport with px, em or rem`);
  }
  return points;
}

/** Features answerable from a viewport size and the user's settings. */
const PLAIN_FEATURES = new Set(['orientation', 'prefers-color-scheme', 'prefers-reduced-motion']);

/**
 * A media query condition, compiled to a tree the runtime can walk without parsing anything.
 *
 * Only features a device can actually answer are accepted. `hover`, `pointer` and the print media
 * type have no meaning here, and a query that silently never matches is worse than a build warning.
 */
// Navigating lightningcss's untyped AST. Every `?.` and `??` counts as a branch, so the
// complexity score here measures defensiveness rather than logic: one line of
// `v?.a ?? v?.b ?? 'x'` scores 7 on its own.
// eslint-disable-next-line complexity
function mediaCondition(condition, context) {
  if (!condition) return null;

  if (condition.type === 'operation') {
    const parts = condition.conditions.map((c) => mediaCondition(c, context));
    if (condition.operator === 'and') return { all: parts };
    if (condition.operator === 'or') return { any: parts };
    throw new CssUnsupported(
      `${context}: the '${condition.operator}' media operator is not supported`,
    );
  }

  if (condition.type === 'feature') {
    const feature = condition.value;
    const measured = feature.name === 'width' || feature.name === 'height';
    if (measured && feature.type === 'plain') {
      return { feature: feature.name, op: 'eq', value: mediaLength(feature.value, context) };
    }
    if (measured && feature.type === 'interval') {
      // '300px < width <= 400px': the start is on the left of the feature, so its operator reads
      // the other way round from the feature's side.
      const start = RANGE_OPS[FLIPPED[feature.startOperator]];
      const end = RANGE_OPS[feature.endOperator];
      return {
        all: [
          { feature: feature.name, op: start, value: mediaLength(feature.start, context) },
          { feature: feature.name, op: end, value: mediaLength(feature.end, context) },
        ],
      };
    }
    if (feature.type === 'range' || feature.type === 'boolean') {
      const op = RANGE_OPS[feature.operator];
      if (!op || !measured) {
        throw new CssUnsupported(
          `${context}: '${feature.name}' is not a media feature a device can answer ` +
            `(width, height, orientation, prefers-color-scheme and prefers-reduced-motion are)`,
        );
      }
      return { feature: feature.name, op, value: mediaLength(feature.value, context) };
    }
    if (feature.type === 'plain' && PLAIN_FEATURES.has(feature.name)) {
      return {
        feature: feature.name,
        value: keyword(feature.value, `${context} (${feature.name})`),
      };
    }
    throw new CssUnsupported(
      `${context}: '${feature.name ?? feature.type}' is not a media feature a device can answer ` +
        `(width, height, orientation, prefers-color-scheme and prefers-reduced-motion are)`,
    );
  }

  throw new CssUnsupported(`${context}: unsupported media condition '${condition.type}'`);
}

/** The whole query list. A comma is an or, so several queries become `any`. */
function mediaQuery(query, context) {
  const parts = (query?.mediaQueries ?? []).map((one) => {
    if (one.qualifier === 'not') {
      throw new CssUnsupported(`${context}: 'not' media queries are not supported yet`);
    }
    if (one.mediaType && one.mediaType !== 'all' && one.mediaType !== 'screen') {
      throw new CssUnsupported(
        `${context}: the '${one.mediaType}' media type has no meaning on a device`,
      );
    }
    return mediaCondition(one.condition, context) ?? { all: [] };
  });
  return parts.length === 1 ? parts[0] : { any: parts };
}

/** CSS attribute operators we can answer from a prop. */
const ATTR_OPERATORS = {
  equal: 'equal',
  prefix: 'prefix',
  suffix: 'suffix',
  substring: 'substring',
  includes: 'includes',
  'dash-match': 'dash-match',
};

/**
 * Compile one compound: the run of simple selectors between combinators.
 *
 * Returns the compound plus its specificity parts, because `:is()` and `:not()` take the
 * specificity of their most specific argument and `:where()` takes none, so the caller cannot
 * work it out from the shape alone.
 */
// eslint-disable-next-line complexity -- a dispatch table: one flat case per CSS form
function compound(parts, context) {
  const out = { classes: [] };
  let ids = 0;
  let classes = 0;
  let types = 0;

  for (const part of parts) {
    switch (part.type) {
      case 'type':
        // No element on native is called `html`. The document element is the top of the tree,
        // which is what `:root` already answers, and that is where a stylesheet written for the
        // web puts its tokens: Open Props defines every one of them under `:where(html)`.
        if (part.name === 'html') out.root = true;
        else out.type = part.name;
        types++;
        break;
      case 'class':
        out.classes.push(part.name);
        classes++;
        break;
      case 'id':
        out.id = part.name;
        ids++;
        break;
      case 'universal':
        break;
      case 'attribute': {
        const operation = part.operation;
        if (operation && !ATTR_OPERATORS[operation.operator]) {
          throw new CssUnsupported(
            `${context}: the '${operation.operator}' attribute operator is not supported yet`,
          );
        }
        (out.attributes ??= []).push(
          operation
            ? {
                name: part.name,
                operator: ATTR_OPERATORS[operation.operator],
                // The i flag: `[type="submit" i]` compares without case.
                ...(operation.caseSensitivity === 'ascii-case-insensitive'
                  ? { value: operation.value.toLowerCase(), insensitive: true }
                  : { value: operation.value }),
              }
            : { name: part.name },
        );
        classes++;
        break;
      }
      case 'pseudo-class': {
        // `:disabled` is not really state: it is a prop, so it reduces to the attribute test we
        // already have, and inherits its specificity for free.
        if (part.kind === 'disabled') {
          (out.attributes ??= []).push({ name: 'disabled' });
          classes++;
          break;
        }
        if (part.kind === 'focus' || part.kind === 'active') {
          (out.pseudo ??= []).push(part.kind);
          classes++;
          break;
        }
        if (part.kind === 'root') {
          out.root = true;
          classes++;
          break;
        }
        if (part.kind === 'empty') {
          out.empty = true;
          classes++;
          break;
        }
        {
          const counts = positionTests(part);
          if (counts) {
            (out.nth ??= []).push(...counts);
            classes++;
            break;
          }
        }
        if (part.kind === 'host') {
          out.host = true;
          // `:host` counts as a class, as an encapsulation attribute would.
          classes++;
          if (part.selectors) {
            const inner = compound(part.selectors, context);
            Object.assign(out, inner.compound, {
              host: true,
              classes: out.classes.concat(inner.compound.classes),
            });
            ids += inner.ids;
            classes += inner.classes;
            types += inner.types;
          }
          break;
        }
        if (part.kind === 'custom-function' && part.name === 'host-context') {
          out.host = true;
          classes++;
          const inner = compound(tokensToCompoundParts(part.arguments, context), context);
          out.hostContext = [inner.compound];
          ids += inner.ids;
          classes += inner.classes;
          types += inner.types;
          break;
        }
        const nested = functionalPseudo(part, context);
        if (nested === null) {
          // lightningcss files a pseudo-class it does not know as `custom`, with its name beside.
          const name = part.kind.startsWith('custom') ? part.name : part.kind;
          throw refusedPseudoClass(part, name, context);
        }
        // `:is()` and `:not()` take their most specific argument; `:where()` takes nothing.
        if (part.kind !== 'where') {
          ids += nested.ids;
          classes += nested.classes;
          types += nested.types;
        }
        if (nested.ancestors?.length) (out.ancestors ??= []).push(...nested.ancestors);
        if (part.kind === 'not') (out.not ??= []).push(...nested.compounds);
        else if (nested.compounds.length) (out.is ??= []).push(nested.compounds);
        break;
      }
      case 'pseudo-element':
        throw new CssUnsupported(
          `${context}: pseudo-elements like ::before are never supported. They would mean ` +
            `synthesising nodes no template declares, which puts the style engine in the ` +
            `business of creating view hierarchy.`,
        );
      default:
        throw new CssUnsupported(`${context}: unsupported selector part '${part.type}'`);
    }
  }

  return { compound: out, ids, classes, types };
}

/** Pseudo-classes about a pointer or about where focus came from, neither of which native has. */
/** Whether a value is one relative colour, `oklch(from var(--brand) l c h)`. */
function isRelativeColour(parts) {
  const written = meaningful(parts);
  return written.length === 1 && written[0].type === 'function' && isRelative(written[0]);
}

/** Whether a value is one term with no `var()` in it: a colour to read as written. */
function isLoneLiteral(parts) {
  const written = meaningful(parts);
  return written.length === 1 && !mentionsVar(written);
}

/** The query a rule's dark side is under: native has the app's one scheme, which this reads. */
const DARK = { feature: 'prefers-color-scheme', value: 'dark' };

/** A rule with only its declarations that have a `light-dark()` in them, on their dark side. */
function darkSide(rule) {
  const { declarations, importantDeclarations } = rule.value.declarations;
  const dark = (list) => schemeSide((list ?? []).filter(mentionsLightDark), 'dark');
  return {
    ...rule,
    value: {
      ...rule.value,
      declarations: {
        declarations: dark(declarations),
        importantDeclarations: dark(importantDeclarations),
      },
    },
  };
}

const HOVER_OR_FOCUS = new Set(['hover', 'focus-visible', 'focus-within']);

/** Form-control state the web keeps on the element and native keeps in a component's inputs. */
const CONTROL_STATE = new Set(['checked', 'indeterminate', 'default']);

/** Why a pseudo-class the matcher has no answer for is refused, said for the one it is. */
function refusedPseudoClass(part, name, context) {
  if (OF_TYPE.has(part.kind)) {
    return new CssUnsupported(
      `${context}: ':${name}' is not supported yet. It counts the siblings of one element type, ` +
        `which the matcher does not track; ':nth-child()' it does.`,
    );
  }
  if (part.kind === 'nth-child' || part.kind === 'nth-last-child') {
    return new CssUnsupported(
      `${context}: ':${name}()' with 'of <selector>' is not supported: counting only the siblings ` +
        `that match a selector needs a second matching pass for every sibling. ':${name}()' ` +
        `without 'of' is supported.`,
    );
  }
  if (part.kind === 'has') {
    return new CssUnsupported(
      `${context}: ':has()' is not supported. It styles a node by its descendants or later ` +
        `siblings, so any change beneath it would mean matching it again. Put a class on the ` +
        `node from the state it depends on.`,
    );
  }
  if (CONTROL_STATE.has(part.kind)) {
    return new CssUnsupported(
      `${context}: ':${name}' has no state on native to read: whether a control is checked is ` +
        `an input of its component, not a prop a selector can see. Bind an attribute from the ` +
        `same signal, such as [attr.data-checked], and select on that.`,
    );
  }
  if (HOVER_OR_FOCUS.has(part.kind)) {
    return new CssUnsupported(
      `${context}: ':${name}' is not supported. Native has no hover or focus cascade: use ` +
        `':active' or ':focus', which the engine tracks, or a bound attribute such as ` +
        `[attr.data-hover].`,
    );
  }
  return new CssUnsupported(
    `${context}: ':${name}' is not supported. Nothing on native answers it; bind a class or an ` +
      `attribute from the state it stands for, and select on that.`,
  );
}

/**
 * Rebuild selector parts from the raw token list lightningcss hands back for `:host-context()`,
 * which it does not recognise and so reports as a custom function.
 *
 * Only a single compound of type, class and id is recoverable this way, which is all
 * `:host-context()` is used for in practice.
 */
// Navigating lightningcss's untyped AST. Every `?.` and `??` counts as a branch, so the
// complexity score here measures defensiveness rather than logic: one line of
// `v?.a ?? v?.b ?? 'x'` scores 7 on its own.
// eslint-disable-next-line complexity
function tokensToCompoundParts(tokens, context) {
  const parts = [];
  let pending = null;

  for (const token of tokens ?? []) {
    const value = token?.value;
    if (value?.type === 'delim' && value.value === '.') {
      pending = 'class';
    } else if (value?.type === 'hash' || value?.type === 'id-hash') {
      parts.push({ type: 'id', name: value.value });
    } else if (value?.type === 'ident') {
      parts.push({ type: pending === 'class' ? 'class' : 'type', name: value.value });
      pending = null;
    } else if (value?.type === 'whitespace') {
      throw new CssUnsupported(
        `${context}: ':host-context()' takes one compound selector, not a combinator`,
      );
    } else {
      throw new CssUnsupported(`${context}: could not read the argument of ':host-context()'`);
    }
  }

  if (!parts.length) throw new CssUnsupported(`${context}: ':host-context()' needs an argument`);
  return parts;
}

/**
 * `:is(<compound> *)`: an ancestor test, which is the one combinator worth having in here.
 *
 * Tailwind's whole `group-*` family compiles to this shape - `group-data-[size=sm]:w-6` becomes
 * `:is(:where(.group)[data-size="sm"] *)` - and it says nothing a second matching pass is needed
 * for. "Some ancestor matches this compound" is what `:host-context()` already means, and the
 * matcher already walks the tree to answer it.
 *
 * @returns the ancestor compound, or null if this is not that shape.
 */
function ancestorArgument(argument) {
  if (argument.length < 3) return null;
  const last = argument[argument.length - 1];
  const combinator = argument[argument.length - 2];
  if (last?.type !== 'universal') return null;
  if (combinator?.type !== 'combinator' || combinator.value !== 'descendant') return null;
  const rest = argument.slice(0, -2);
  return rest.some((piece) => piece.type === 'combinator') ? null : rest;
}

/**
 * A selector as the selectors it is the union of, wherever `:is()` or `:where()` has an ancestor
 * test among other alternatives: `.x:where(.dark, .dark *)` is `.x:where(.dark)` or
 * `.x:where(.dark *)`.
 *
 * An ancestor test is a requirement of the whole compound, not one alternative of a list, so kept
 * in the list it was required alongside the others: an element that was dark and inside something
 * dark. That is Tailwind's own class-based dark mode, and it matched nothing, silently. Split, each
 * alternative is a rule of its own and any one of them matching is a match, which is what a list is.
 */
function alternatives(parts) {
  let variants = [[]];
  for (const part of parts) {
    const options = partAlternatives(part);
    variants = variants.flatMap((variant) => options.map((option) => [...variant, ...option]));
  }
  return variants;
}

/** One part of a selector as the parts it may be instead: itself, or one per alternative. */
function partAlternatives(part) {
  const functional = part.type === 'pseudo-class' && (part.kind === 'is' || part.kind === 'where');
  if (!functional || !part.selectors) return [[part]];
  // An argument can hold alternatives of its own, which are more alternatives of this one.
  const args = part.selectors.flatMap(alternatives);
  if (args.length < 2 || !args.some(ancestorArgument)) return [[{ ...part, selectors: args }]];
  return args.map((argument) => [{ ...part, selectors: [argument] }]);
}

/** The two combinators that relate a node to its siblings rather than its ancestors. */
const SIBLING = new Set(['next-sibling', 'later-sibling']);

/**
 * `:is(<compound> ~ *)` in a compound, taken out of it: a sibling test, which is how Tailwind 4
 * writes every `peer-*` variant. `.x:is(:where(.peer):focus ~ *)` is an element with an earlier
 * sibling that matches, which is `:where(.peer):focus ~ .x` - and that the matcher already does.
 *
 * Moving the sibling out in front keeps the rest of the selector true: a sibling has the same
 * parent and ancestors as the element, so whatever came before the element comes before it.
 * Only one argument is read this way, which is the only form Tailwind writes; a list of them is
 * left to be refused with the other combinators.
 *
 * @returns the compound's own parts, and the sibling test if there was one.
 */
function siblingTest(parts) {
  const at = parts.findIndex(
    (part) =>
      part.type === 'pseudo-class' &&
      (part.kind === 'is' || part.kind === 'where') &&
      part.selectors?.length === 1 &&
      siblingArgument(part.selectors[0]),
  );
  if (at === -1) return { own: parts, sibling: null };
  const { kind, selectors } = parts[at];
  const argument = selectors[0];
  return {
    own: [...parts.slice(0, at), ...parts.slice(at + 1)],
    sibling: { kind, parts: argument.slice(0, -2), combinator: argument.at(-2).value },
  };
}

/** Whether an argument is `<compound> ~ *` or `<compound> + *`. */
function siblingArgument(argument) {
  if (argument.length < 3 || argument.at(-1)?.type !== 'universal') return false;
  const combinator = argument.at(-2);
  if (combinator?.type !== 'combinator' || !SIBLING.has(combinator.value)) return false;
  return !argument.slice(0, -2).some((piece) => piece.type === 'combinator');
}

/**
 * The arguments of `:is()`, `:where()` or `:not()`, each of which must be a single compound.
 *
 * Any other combinator inside would need a second, independent matching pass rooted at this node,
 * which the matcher has no shape for; it is refused rather than half-implemented.
 */
function functionalPseudo(part, context) {
  if (part.kind !== 'is' && part.kind !== 'where' && part.kind !== 'not') return null;

  const compounds = [];
  const ancestors = [];
  let ids = 0;
  let classes = 0;
  let types = 0;

  for (const argument of part.selectors) {
    const ancestor = part.kind !== 'not' && ancestorArgument(argument);
    if (ancestor) {
      const built = compound(ancestor, context);
      ancestors.push(built.compound);
      if (pack(built.ids, built.classes, built.types) > pack(ids, classes, types)) {
        ids = built.ids;
        classes = built.classes;
        types = built.types;
      }
      continue;
    }
    if (argument.some((piece) => piece.type === 'combinator')) {
      throw new CssUnsupported(
        `${context}: ':${part.kind}()' cannot contain a combinator, only a compound selector, ` +
          `'<compound> *', which is an ancestor test, or '<compound> ~ *', a sibling test.`,
      );
    }
    const built = compound(argument, context);
    compounds.push(built.compound);
    // The single most specific argument wins, taken whole. Not the maximum of each component
    // independently: `:is(.a, #b)` is as specific as `#b`, not as `#b.a`.
    if (pack(built.ids, built.classes, built.types) > pack(ids, classes, types)) {
      ids = built.ids;
      classes = built.classes;
      types = built.types;
    }
  }

  return { compounds, ancestors, ids, classes, types };
}

function selector(parts, context) {
  const compounds = [];
  const combinators = [];
  let current = [];
  let ids = 0;
  let classes = 0;
  let types = 0;

  const add = (built, counts = true) => {
    compounds.push(built.compound);
    if (!counts) return;
    ids += built.ids;
    classes += built.classes;
    types += built.types;
  };

  const flush = () => {
    const { own, sibling } = siblingTest(current);
    if (sibling) {
      if (SIBLING.has(combinators.at(-1))) {
        throw new CssUnsupported(
          `${context}: a sibling test inside ':${sibling.kind}()' cannot follow a sibling ` +
            `combinator: the two siblings could be in either order, which one selector cannot say.`,
        );
      }
      // `:is()` counts its argument, which is the sibling's compound; `:where()` counts nothing.
      add(compound(sibling.parts, context), sibling.kind === 'is');
      combinators.push(sibling.combinator);
    }
    add(compound(own, context));
    current = [];
  };

  for (const part of parts) {
    if (part.type === 'combinator') {
      if (!COMBINATORS.has(part.value)) {
        throw new CssUnsupported(
          `${context}: the '${part.value}' combinator has no meaning here. Descendant, child and ` +
            `the two sibling combinators are the ones a node's position can answer.`,
        );
      }
      flush();
      combinators.push(part.value);
    } else {
      current.push(part);
    }
  }
  flush();

  return { compounds, combinators, specificity: pack(ids, classes, types) };
}

/**
 * @returns {{rules: Array<{compounds: object[], combinators: string[], specificity: number,
 *   order: number, declarations: object, important?: object}>}}
 */
/**
 * Serialise the raw token list lightningcss hands back for a property it does not know, so a
 * value like `isolate` can still be read as a keyword. Only single-word values are worth
 * recovering; anything longer is a shorthand we would be guessing at.
 */
function tokenKeyword(tokens) {
  if (!Array.isArray(tokens) || tokens.length !== 1) return null;
  const token = tokens[0];
  // A plain token only: a length or an angle holds its number here too, and read as one it lost
  // its unit, so `line-clamp: 13px` was thirteen lines.
  if (token?.type !== 'token') return null;
  const value = token?.value?.value ?? token?.value;
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

/**
 * Several words, as a list, for a property lightningcss does not know that takes a list of them:
 * `font-variant-numeric: oldstyle-nums proportional-nums`. Null for anything that is not words.
 */
function tokenWords(tokens) {
  const words = (tokens ?? []).filter((token) => token?.value?.type !== 'white-space');
  if (words.length < 2 || words.some((token) => token?.value?.type !== 'ident')) return null;
  return words.map((token) => token.value.value);
}

/**
 * A colour CSS has no property for, such as `tint-color`. Read like a token's value, which is the
 * same token list: a colour settles here, a var() is looked up on device. False when it is neither.
 */
function addCustomColor(name, parts, out, deferred, context) {
  const value = tokenValue(parts, context);
  if (value?.color !== undefined) {
    out[camel(name)] = value.color;
    return true;
  }
  if (!value?.alias) return false;
  deferred.push(deferVar({ propertyId: { property: name }, value: parts }, context));
  return true;
}

/** The clamps, which lightningcss does not parse and which take a number of lines. */
const LINE_CLAMP = new Set(['line-clamp', '-webkit-line-clamp']);

/** Lengths CSS gives no percentage to, which lightningcss does not know and so cannot refuse. */
const NO_PERCENT = new Set(['outline-offset']);

/**
 * A length lightningcss does not know: an older spelling, `grid-column-gap` for `column-gap`, or
 * a property it has no parser for, `outline-offset`. It arrives as raw tokens, and is read as a
 * token is, so a unit is not lost on the way: read as a word, 1.25rem was 1.25.
 */
function addAliased(name, parts, out, deferred, context) {
  const value = tokenValue(parts, context);
  if (value?.alias) {
    deferred.push(deferVar({ propertyId: { property: name }, value: parts }, context));
    return;
  }
  if (value?.length === undefined) throw unsupported(name, context);
  if (typeof value.length === 'string' && value.length.endsWith('%') && NO_PERCENT.has(name)) {
    throw new CssUnsupported(`${context}: '${name}' takes a length, not a percentage`);
  }
  for (const prop of propsFor(name)) out[prop] = value.length;
}

/** A `--x` definition's value, in every form it can be read as. */
function customToken(name, parts, context) {
  const value =
    deferHslToken(parts) ??
    deferChannelsToken(parts, context) ??
    tokenValue(parts, `${context} (${name})`);
  if (value === null) {
    throw new CssUnsupported(`${context}: '${name}' has a value native cannot express in any form`);
  }
  return value;
}

/** A `--x` definition, or a property lightningcss does not know but React Native supports. */
function addCustom(declaration, out, tokens, deferred, context) {
  const name = String(declaration.value?.name ?? '(unknown)');
  const parts = declaration.value?.value;

  if (name.startsWith('--')) {
    tokens[name] = customToken(name, parts, context);
    return;
  }

  if (kindOf(name) === 'color' && addCustomColor(name, parts, out, deferred, context)) return;

  if (ALIASES[name] || kindOf(name) === 'length') {
    addAliased(name, parts, out, deferred, context);
    return;
  }

  // `font-variant-numeric: var(--tw-ordinal,) ...`: a list of slots, which lightningcss hands over
  // as a property it does not know.
  if (SLOTTED[name] && parts?.some((part) => part.type === 'var')) {
    deferred.push(deferVar({ propertyId: { property: name }, value: parts }, context));
    return;
  }

  addCustomWord(name, parts, out, context);
}

/**
 * A property lightningcss does not know that takes a word or a number: `line-clamp: 3`, or
 * `font-variant-numeric: oldstyle-nums proportional-nums`.
 */
function addCustomWord(name, parts, out, context) {
  const word = tokenKeyword(parts) ?? tokenWords(parts);
  // A clamp given a length or an angle: the value is wrong, not the property, and the fallback
  // below would call `-webkit-line-clamp` a vendor property native does not read, which it does.
  const kind = parts?.length === 1 ? parts[0]?.type : undefined;
  if (word === null && LINE_CLAMP.has(name) && ['length', 'angle', 'time'].includes(kind)) {
    throw new CssUnsupported(`${context}: '${name}' takes no ${kind} here`);
  }
  if (word === null) throw unsupported(name, context);
  translate(name, word, out, context);
}

/**
 * Whether a raw value has nothing in it for the device to settle. One side of a light-dark() may
 * have no var() left in it, but it is still raw terms, which the path for tokens reads, literal
 * colours and all.
 */
const settledAsWritten = (declaration) =>
  !mentionsVar(declaration.value?.value) && !declaration.schemeSide;

/** Whether a raw value has a `var()` anywhere in it, however deeply inside a function. */
function mentionsVar(parts) {
  return (parts ?? []).some((part) => part?.type === 'var' || mentionsVar(part?.value?.arguments));
}

/** The value's one word, if it is a single identifier. */
function onlyWord(parts) {
  const [only, ...rest] = parts;
  if (rest.length || only?.type !== 'token' || only.value?.type !== 'ident') return null;
  return only.value.value;
}

/** The CSS-wide keywords, which every property takes and which lightningcss leaves unparsed. */
const CSS_WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

/**
 * A value lightningcss could not parse that has no `var()` in it either.
 *
 * These arrive exactly as a `var()` does, and every one used to be reported as mixing var() with
 * other values: `color: inherit` and `flex-basis: content` included. They get their own message,
 * and the one of them native can say - `box-shadow: none`, which lightningcss leaves unparsed for
 * reasons of its own - is said.
 */
function unparsedValue(value, out, context) {
  const property = value?.propertyId?.property ?? 'a property';
  const parts = terms(value?.value);
  const word = onlyWord(parts);
  if (property === 'box-shadow' && word === 'none') {
    out.boxShadow = [];
    return;
  }
  if (CSS_WIDE.has(word)) {
    throw new CssUnsupported(
      `${context}: '${property}: ${word}' is a CSS-wide keyword, which this cascade does not ` +
        `implement. Write the value it stands for.`,
    );
  }
  // A bare number `markUnitless` tagged, which lightningcss hands over as an unknown dimension.
  const bare = parts.find((part) => part.value?.unit === '__unitless');
  if (bare) length({ type: 'dimension', value: bare.value }, context);
  const text = parts.map((part) => part.value?.value ?? part.value?.name ?? part.type).join(' ');
  throw new CssUnsupported(`${context}: '${property}: ${text}' is not a value native can take`);
}

/** The environment values a device supplies, which the host publishes as tokens of these names. */
const ENVIRONMENT = new Set([
  'safe-area-inset-top',
  'safe-area-inset-right',
  'safe-area-inset-bottom',
  'safe-area-inset-left',
]);

/**
 * An unparsed value with every `env()` in it read as the `var()` of the token the host publishes,
 * so `env(safe-area-inset-top, 20px)` is `var(--safe-area-inset-top, 20px)`. A stylesheet shared
 * with the web writes the first, and it was refused as an '[object Object]' value.
 */
function withEnvAsVar(value, context) {
  const rewrite = (parts) =>
    Array.isArray(parts)
      ? parts.map((part) => {
          if (part?.type === 'env') {
            const name = part.value?.name?.value;
            if (!ENVIRONMENT.has(name)) {
              throw new CssUnsupported(
                `${context}: env(${name}) is not something a device supplies. The safe-area ` +
                  `insets are, as env(safe-area-inset-top) and the other three sides.`,
              );
            }
            const fallback = part.value.fallback ? rewrite(part.value.fallback) : null;
            return { type: 'var', value: { name: { ident: `--${name}`, from: null }, fallback } };
          }
          const args = part?.value?.arguments;
          return Array.isArray(args)
            ? { ...part, value: { ...part.value, arguments: rewrite(args) } }
            : part;
        })
      : parts;
  return value?.value ? { ...value, value: rewrite(value.value) } : value;
}

/** A declaration lightningcss left as raw terms: a var() in it, or a side of a light-dark(). */
function addUnparsed(declaration, out, deferred, context) {
  declaration = { ...declaration, value: withEnvAsVar(declaration.value, context) };
  // A platform colour is not deferred: it is a static value that only needs the platform, which
  // the device knows and the build does not. It belongs in the declarations like any colour.
  const platform = asPlatformColor(declaration.value, context);
  if (platform) {
    for (const prop of platform.props) out[prop] = platform.value;
    return;
  }
  if (settledAsWritten(declaration)) {
    unparsedValue(declaration.value, out, context);
    return;
  }
  const property = declaration.value?.propertyId?.property;
  if (animationTimeWithTokens(property, declaration.value.value ?? [], out, context)) return;
  const expanded = expandShorthand(declaration.value, context, linear);
  if (expanded) {
    Object.assign(out, expanded.declarations);
    deferred.push(...expanded.deferred);
    return;
  }
  deferred.push(deferVar(declaration.value, context));
}

/**
 * Translate one declaration into `out`, or record it as a token or a deferred value.
 *
 * lightningcss reports anything it does not recognise as `custom`, so a genuine custom property
 * and a misspelled or web-only one arrive the same way. The `--` prefix is what tells them apart,
 * and the messages need to differ. `custom` also covers properties React Native supports but CSS
 * has no standard for, so a plain keyword is recovered rather than refusing them sight unseen.
 */
function addDeclaration(declaration, out, tokens, deferred, context) {
  if (declaration.property === 'custom') {
    addCustom(declaration, out, tokens, deferred, context);
    return;
  }

  if (declaration.property === 'unparsed') {
    addUnparsed(declaration, out, deferred, context);
    return;
  }

  translate(declaration.property, declaration.value, out, context);

  // `length()` marks a unit it cannot settle at build time rather than throwing. Lift those out of
  // the declarations and into the deferred list, whatever property they landed in, so every
  // shorthand gets them for free.
  for (const key of Object.keys(out)) {
    const marker = out[key]?.__defer;
    if (marker) {
      delete out[key];
      deferred.push({ props: [key], compute: marker });
    } else if (holdsMarker(out[key])) {
      // Inside a list or a record: a transform, a shadow, a filter. Fabric drops the whole prop
      // when one part of it is a marker, so the value goes to the device to be filled in.
      deferred.push({ props: [key], within: out[key] });
      delete out[key];
    }
  }
}

/** Whether a structured value has a length in it that only the device can settle. */
function holdsMarker(value) {
  if (value === null || typeof value !== 'object') return false;
  if (value.__defer || value.__colour || value.__length || value.__shadows || value.__inset) {
    return true;
  }
  return Object.values(value).some(holdsMarker);
}

/**
 * One declaration in a keyframe. A frame is played as it was compiled, with no node's cascade to
 * settle a value against, so a var(), an em or a viewport unit is refused here: each used to leave
 * the frame empty, and the animation ran without moving.
 */
function addFrameDeclaration(declaration, out, tokens, _deferred, context) {
  const deferred = [];
  addDeclaration(declaration, out, tokens, deferred, context);
  if (deferred.length) {
    for (const one of deferred) for (const prop of one.props) delete out[prop];
    throw new CssUnsupported(
      `${context}: a keyframe's values are settled at build time, so var(), em and the ` +
        `viewport units cannot be used in one. Write the value in px, rem or %.`,
    );
  }
}

/** `from` and `to` are 0 and 1; a percentage already arrives as a fraction. */
function keyframeOffset(selector) {
  if (selector.type === 'from') return 0;
  if (selector.type === 'to') return 1;
  return Math.round(selector.value * 1e4) / 1e4;
}

/**
 * `<where>: <what>: <why>`, naming the place once. A refusal already starts with where it was
 * found, which is the same place or a line within it, so that is the one kept.
 */
function reported(context, what, message) {
  const at = message.startsWith(context) ? message.indexOf(': ', context.length) : -1;
  if (at === -1) return `${context}: ${what}: ${message}`;
  return `${message.slice(0, at)}: ${what}: ${message.slice(at + 2)}`;
}

/** A syntax error, which lightningcss places on a line of the text it was given, placed in the sheet. */
function placed(error, where) {
  if (error instanceof CssUnsupported || typeof error?.loc?.line !== 'number') return error;
  return new Error(`${where(error.loc.line)}: ${error.message}`);
}

/** Both native platforms, which is who a sheet is for when the build does not say. */
const NATIVE = ['ios', 'android'];

/** The class `mount` puts on the root for each platform, which is how a rule is scoped to one. */
const PLATFORM_CLASS = { 'platform-ios': 'ios', 'platform-android': 'android' };

/**
 * The platforms named by `.platform-*` classes in one selector: in any compound, or inside an
 * `:is()` or `:where()` of a single argument. A class another compound must have is a condition on
 * the tree, and the root carries exactly one of these.
 */
function platformClasses(parts, found = new Set()) {
  for (const part of parts) {
    if (part.type === 'class' && PLATFORM_CLASS[part.name]) found.add(PLATFORM_CLASS[part.name]);
    const single = part.type === 'pseudo-class' && (part.kind === 'is' || part.kind === 'where');
    if (single && part.selectors?.length === 1) platformClasses(part.selectors[0], found);
  }
  return found;
}

/**
 * The platforms a rule can apply on: those its selectors are scoped to, if any, within those the
 * sheet is built for. A selector list applies wherever any one of its selectors does.
 */
function rulePlatforms(selectors, targets) {
  const platforms = new Set();
  for (const parts of selectors ?? []) {
    const named = platformClasses(parts);
    // Two platform classes in one selector ask for a root that is both, which never exists.
    const scope = named.size === 0 ? NATIVE : named.size === 1 ? [...named] : [];
    for (const platform of scope) if (targets.includes(platform)) platforms.add(platform);
  }
  return [...platforms];
}

/**
 * Refuse a declaration that one of the platforms its rule applies on would ignore. Today that is
 * a filter function iOS does not draw. The declaration is taken back out first, so a sheet that
 * dropped with a warning keeps the rest of the rule.
 */
function assertDrawn(out, deferred, from, platforms, context) {
  if (!platforms.includes('ios')) return;
  const settled = undrawnOnIos(out.filter);
  const pending = deferred
    .slice(from)
    .filter((one) => one.props?.includes('filter') && undrawnOnIos(one.within));
  const name = settled ?? (pending.length ? undrawnOnIos(pending[0].within) : null);
  if (!name) return;

  if (settled) delete out.filter;
  for (const one of pending) deferred.splice(deferred.indexOf(one), 1);
  throw undrawn(name, context);
}

/**
 * The same for a filter token, refused where it is set: `blur-sm` sets `--tw-blur` and has every
 * filter slot read on device, so this is the last place that knows which platforms it is for.
 */
function assertTokenDrawn(tokens, name, platforms, context) {
  if (!platforms.includes('ios') || typeof name !== 'string') return;
  const fn = undrawnOnIos(tokens[name]?.filter);
  if (!fn) return;
  delete tokens[name];
  throw undrawn(fn, context);
}

/**
 * Refuse a font variant list whose rule sets one of its slots to a variant native has no way to
 * ask a font for: `slashed-zero` sets `--tw-slashed-zero` and reads it in the same rule. Checked
 * there, since on device the slot would be left out without a word.
 */
function assertVariantsKnown(tokens, deferred, from) {
  for (const one of deferred.slice(from)) {
    if (!one.props?.includes('fontVariant') || !Array.isArray(one.within)) continue;
    for (const slot of one.within) {
      const token = tokens[slot?.__variants?.reference];
      if (!token || token.fontVariant) continue;
      deferred.splice(deferred.indexOf(one), 1);
      delete tokens[slot.__variants.reference];
      throw new CssUnsupported(
        `font-variant-numeric: '${token.keyword}' is not a font variant native can ask a font for.`,
      );
    }
  }
}

/**
 * Take the props a declaration just wrote out of what an earlier declaration in the same rule
 * left to the device: `flex: var(--g); flex-shrink: 0` shrinks by 0, as the web's source order
 * says. A rule's deferred values are applied after its written ones, so without this the earlier
 * one won.
 */
function supersede(deferred, before, written) {
  if (!written.size) return;
  for (let i = before - 1; i >= 0; i--) {
    const one = deferred[i];
    if (!one.props?.some((prop) => written.has(prop))) continue;
    const props = one.props.filter((prop) => !written.has(prop));
    if (props.length) deferred[i] = { ...one, props };
    else deferred.splice(i, 1);
  }
}

/** Refuse what one of the platforms a rule applies on would not draw: see the checks below. */
function assertDrawnEverywhere(declaration, out, tokens, deferred, from, platforms, context) {
  const name = declaration.value?.name;
  assertDrawn(out, deferred, from, platforms, context);
  assertTokenDrawn(tokens, name, platforms, context);
  assertSkewDrawn(out, tokens, deferred, from, name, platforms, context);
}

/**
 * The first skew in a compiled transform list, or null. React Native on Android breaks a transform
 * down into the rotation, scale and translation an Android view has, and a view has no skew:
 * `skewX()` is left out, and `skewY()` comes out as a rotation. A skew of 0 draws the same there.
 */
function skewIn(list, tokens = {}) {
  if (!Array.isArray(list)) return null;
  const entry = list.find(
    (one) => one && ['skewX', 'skewY'].some((key) => key in one && skews(one[key], tokens)),
  );
  return entry ? Object.keys(entry)[0] : null;
}

/**
 * Whether one skew angle is a skew: a written angle other than 0, or a token the same rule sets to
 * one, or a fallback that is one. Tailwind 3's every transform reads `var(--tw-skew-x)`, which the reset sets to 0, so a slot
 * the rule does not set is no skew; `skew-x-12`, which sets it to 12deg, is.
 */
function skews(angle, tokens) {
  const expression = angle?.__calc?.expression;
  if (expression?.reference === undefined) {
    return typeof angle !== 'object' && parseFloat(angle) !== 0;
  }
  // The rule's own token, or the fallback written beside it, which is what draws where the token
  // is set nowhere.
  const token = tokens[expression.reference];
  const value = token ? (token.angle ?? token.number) : expression.fallback;
  return value !== undefined && value !== 0;
}

/**
 * Refuse a skew in a rule that can apply on Android, where it is not drawn: in the transform, in
 * one settled on device, or in a transform token the rule sets. The mirror of `assertDrawn`.
 */
function assertSkewDrawn(out, tokens, deferred, from, name, platforms, context) {
  if (!platforms.includes('android')) return;
  const pending = deferred
    .slice(from)
    .filter((one) => one.props?.includes('transform') && skewIn(one.within, tokens));
  const token = typeof name === 'string' ? skewIn(tokens[name]?.transform) : null;
  const skew =
    skewIn(out.transform) ?? token ?? (pending.length ? skewIn(pending[0].within, tokens) : null);
  if (!skew) return;
  if (skewIn(out.transform)) delete out.transform;
  if (token) delete tokens[name];
  for (const one of pending) deferred.splice(deferred.indexOf(one), 1);
  throw new CssUnsupported(
    `${context}: transform: ${skew}() is not drawn on Android. React Native breaks a transform ` +
      `down into the rotation, scale and translation an Android view has, and a view has no skew, ` +
      `so this would leave the view unskewed, or turned, on an Android phone. Scope the rule to ` +
      `iOS with a .platform-ios ancestor (Tailwind's ios: variant).`,
  );
}

function undrawn(name, context) {
  return new CssUnsupported(
    `${context}: filter: ${name}() is not drawn on iOS. React Native draws brightness() and ` +
      `opacity() on both platforms and every other filter function on Android only, so this ` +
      `would leave the view unchanged on an iPhone. Scope the rule to Android with a ` +
      `.platform-android ancestor (Tailwind's android: variant), or use brightness() or opacity().`,
  );
}

/**
 * @param source CSS text.
 * @param context Name used in messages, normally the file and component.
 * @param options `onUnsupported` receives a message for each declaration or rule native cannot
 *   express, naming where it is, what was dropped and why, and the compile goes on without it.
 *   Every build path passes one: Metro prints each as a build warning, and Tailwind's step and the
 *   docs preview collect them. Without one, the first thing that cannot be expressed throws a
 *   `CssUnsupported` with the same message. CSS that does not parse throws either way.
 */
function compileCss(source, context = 'styles', options = {}) {
  const rules = [];
  /** `@keyframes` by name. Global within a sheet, exactly as they are within a document. */
  const keyframes = {};
  /** `@font-face`, in the order declared. Registered with the platform before anything is laid out. */
  const fonts = [];
  const { onUnsupported } = options;
  /** The platforms this sheet is built for: the one Metro is bundling, or both when it is not said. */
  const targets = NATIVE.includes(options.platform) ? [options.platform] : NATIVE;
  let order = 0;

  /**
   * Whether a rule ended up with nothing to apply.
   *
   * Keeping one is not free: an unselective rule (`:root`, `*`, `:host`) has no key class, so it
   * lands in the bucket every node is offered and is tested against the whole tree. Tailwind leaves
   * several behind, its theme being custom properties that are substituted at build time and its
   * resets being browser-only properties this engine drops.
   */
  function translatedToNothing(shared, important, tokens, deferred) {
    return (
      !Object.keys(shared).length &&
      !Object.keys(important).length &&
      !Object.keys(tokens).length &&
      !deferred.length
    );
  }

  /**
   * One declaration, or with `onUnsupported` given, the report of why it was dropped. Rules and
   * keyframes both come through here, so a declaration costs only itself wherever it is written.
   */
  function declare(
    declaration,
    out,
    tokens,
    deferred,
    context,
    add = addDeclaration,
    platforms = targets,
  ) {
    const before = deferred.length;
    const written = new Set();
    const tracked = new Proxy(out, {
      set(target, key, value) {
        written.add(key);
        target[key] = value;
        return true;
      },
    });
    try {
      add(declaration, tracked, tokens, deferred, context);
      assertDrawnEverywhere(declaration, out, tokens, deferred, before, platforms, context);
      // The whole rule: a slot can be set after the declaration that reads it.
      assertVariantsKnown(tokens, deferred, 0);
      supersede(deferred, before, written);
    } catch (error) {
      if (!onUnsupported || !(error instanceof CssUnsupported)) throw error;
      // A var() arrives as `unparsed`, which names the parser's shape rather than the property.
      const name =
        declaration.property === 'custom'
          ? declaration.value?.name
          : declaration.property === 'unparsed'
            ? declaration.value?.propertyId?.property
            : declaration.property;
      onUnsupported(reported(context, `dropped '${name}'`, error.message));
    }
  }

  /**
   * A rule this compiler cannot express is dropped and reported to `onUnsupported`, and throws
   * when there is none to report to.
   *
   * Only the rule is dropped, and the reason is reported the same way an unsupported declaration
   * is. Inside `@media` that means the one rule, not the block around it.
   */
  function guarded(compile, location = context) {
    if (!onUnsupported) return compile();
    try {
      return compile();
    } catch (error) {
      if (!(error instanceof CssUnsupported)) throw error;
      onUnsupported(reported(location, 'dropped a rule', error.message));
      return [];
    }
  }

  /**
   * Where a line of the sheet is, as a message names it: `file:line`, which an editor turns into a
   * link. A caller that compiled several files as one text says where each line came from.
   */
  function where(line) {
    const original = flattened.lineOf(line);
    return options.locate?.(original) ?? `${context}:${original}`;
  }

  /** Where a rule is. lightningcss counts its lines from zero. */
  function locationOf(rule) {
    const loc = rule.value?.loc;
    return loc?.line === undefined ? context : where(loc.line + 1);
  }

  /** Compile one plain style rule into the flat list. */
  function styleRule(rule) {
    const context = locationOf(rule);
    if (rule.type !== 'style') throw refusedAtRule(rule, context);

    // Compiled once per set of platforms its selectors can apply on, because a declaration one
    // platform ignores is refused only where it could apply there. A selector list is one rule to
    // lightningcss, which also merges identical neighbours into one, so `grayscale` and
    // `android:grayscale` can arrive as a single rule, and the second must not lose its filter.
    const selectors = rule.value.selectors;
    const first = order;
    order += selectors.length;
    if (!mentionsLightDark(rule.value.declarations)) {
      return styleVariant(rule, (parts) => first + selectors.indexOf(parts), context);
    }
    // light-dark(): the light rule, then a dark copy of what differs under the scheme's query,
    // ordered after every selector of this rule and before the next rule's.
    styleVariant(schemeSide(rule, 'light'), (parts) => first + selectors.indexOf(parts), context);
    const before = rules.length;
    styleVariant(darkSide(rule), () => order - 0.5, context);
    for (let i = before; i < rules.length; i++) rules[i].condition = DARK;
  }

  /** A style rule's selectors and declarations as rules, each at the place `orderOf` gives it. */
  function styleVariant(rule, orderOf, context) {
    const groups = new Map();
    for (const parts of rule.value.selectors) {
      // One selector the engine cannot match is dropped on its own, not with the list it is in:
      // lightningcss merges neighbouring rules with the same declarations, so a list is often
      // several unrelated utilities that happen to share a colour.
      const compiled = selectorOrDropped(parts, context, rule.value.selectors.length === 1);
      if (!compiled) continue;
      const platforms = rulePlatforms([parts], targets);
      const key = platforms.join();
      if (!groups.has(key)) groups.set(key, { platforms, selectors: [] });
      groups.get(key).selectors.push({ parts, compiled });
    }
    for (const { platforms, selectors: group } of groups.values()) {
      const built = buildRule(rule, platforms, context);
      if (!built) continue;
      for (const { parts, compiled } of group) {
        // One rule per alternative an ancestor test is among; each as specific as the selector
        // written, which is what `:is()` makes all of them.
        for (const one of alternatives(parts)) {
          const alternative = one === parts ? compiled : selector(one, context);
          rules.push({
            ...alternative,
            specificity: compiled.specificity,
            order: orderOf(parts),
            ...built,
          });
        }
      }
    }
  }

  /** One selector compiled, or null and reported when the engine cannot match it. */
  function selectorOrDropped(parts, context, alone) {
    if (!onUnsupported) return selector(parts, context);
    try {
      return selector(parts, context);
    } catch (error) {
      if (!(error instanceof CssUnsupported)) throw error;
      onUnsupported(
        reported(context, alone ? 'dropped a rule' : 'dropped a selector', error.message),
      );
      return null;
    }
  }

  /** A rule's declarations, as the selectors that apply on `platforms` get them; null if none. */
  function buildRule(rule, platforms, context) {
    const { declarations, importantDeclarations } = rule.value.declarations;
    const tokens = {};
    const deferred = [];

    /** Translate one list of declarations, collecting tokens and deferred values as it goes. */
    const build = (list) => {
      const out = {};
      for (const declaration of list ?? []) {
        declare(declaration, out, tokens, deferred, context, addDeclaration, platforms);
      }
      // The transition longhands are meaningless one at a time: a duration list is sized by the
      // property list, which may be declared after it. This is where the rule is complete.
      finishTransition(out, context);
      finishAnimation(out, context);
      // A spec with a token in its timing is settled on device, as any value with one is.
      if (out['$animation'] && JSON.stringify(out['$animation']).includes('"__calc"')) {
        deferred.push({ props: ['$animation'], within: out['$animation'] });
        delete out['$animation'];
      }
      finishBox(out, context);
      return out;
    };

    const shared = build(declarations);
    const normalCount = deferred.length;
    const important = build(importantDeclarations);
    // A value settled on device keeps its importance, or the cascade cannot rank it. Without it
    // an important var() lost to any later plain declaration and beat every earlier important one.
    for (let i = normalCount; i < deferred.length; i++) {
      deferred[i] = { ...deferred[i], important: true };
    }

    // A rule that translated to nothing cannot affect a node, and keeping it is not free: an
    // unselective one (`:root`, `*`, `:host`) is tested against every node in the tree. Tailwind
    // leaves several behind, because its theme rules are all custom properties and those are
    // substituted at build time.
    if (translatedToNothing(shared, important, tokens, deferred)) return null;

    return {
      declarations: shared,
      ...(Object.keys(important).length ? { important } : {}),
      ...(Object.keys(tokens).length ? { tokens } : {}),
      ...(deferred.length ? { deferred } : {}),
    };
  }

  /**
   * One `@keyframes` block. Every frame's declarations go through the same translation a rule's
   * do, so a property native cannot express fails here rather than silently doing nothing.
   */
  function keyframesRule(rule) {
    const name = rule.value.name?.value ?? rule.value.name;
    const context = `${locationOf(rule)} (@keyframes ${name})`;

    const frames = [];
    for (const frame of rule.value.keyframes ?? []) frames.push(...keyframeBlock(frame, context));
    frames.sort((a, b) => a.offset - b.offset);
    keyframes[name] = frames;
  }

  /** One `{ ... }` inside a keyframes block. Several offsets can share it: `0%, 100% { ... }`. */
  function keyframeBlock(frame, context) {
    const declarations = {};
    for (const declaration of frame.declarations?.declarations ?? []) {
      declare(declaration, declarations, {}, [], context, addFrameDeclaration, targets);
    }
    finishBox(declarations, context);
    const easing = frameEasing(declarations, context);
    return (frame.selectors ?? []).map((selector) => ({
      offset: keyframeOffset(selector),
      declarations,
      ...(easing ? { easing } : {}),
    }));
  }

  const flattened = flatten(source, context);
  try {
    lightning.transform({
      filename: `${context}.css`,
      code: Buffer.from(markUnitless(flattened.code)),
      visitor: {
        Rule(rule) {
          return guarded(() => compileRule(rule), locationOf(rule));
        },
      },
    });
  } catch (error) {
    throw placed(error, where);
  }

  function compileRule(rule) {
    if (rule.type === 'font-face') {
      fonts.push(fontFace(rule.value, context));
      return [];
    }
    if (rule.type === 'keyframes') {
      keyframesRule(rule);
      // Keep it out of the emitted CSS; nothing downstream reads it.
      return [];
    }
    if (rule.type === 'media') {
      // Compile the inner rules and hang the condition off each. The visitor is not called
      // again for nested rules, so this recursion is how they are reached at all.
      const condition = mediaQuery(rule.value.query, context);
      for (const inner of rule.value.rules ?? []) {
        const before = rules.length;
        // Conditioned even when it throws: a selector list can fail part way, after the selectors
        // before the bad one were already added, and those must not apply unconditionally.
        guarded(() => styleRule(inner), locationOf(inner));
        for (let i = before; i < rules.length; i++) {
          const own = rules[i].condition;
          rules[i].condition = own ? { all: [condition, own] } : condition;
        }
      }
      // Replace it with nothing, or the visitor descends and compiles the inner rules a
      // second time, unconditioned, which would make every query appear to always match.
      return [];
    }
    styleRule(rule);
  }

  // Cascade order is decided here, so the device only walks the list.
  rules.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  return {
    rules,
    ...(fonts.length ? { fonts } : {}),
    ...(Object.keys(keyframes).length ? { keyframes } : {}),
    // Said once, on the sheet, because what it costs is not matching but invalidation: adding a
    // row changes what its neighbours match while nothing about those neighbours moved. The
    // engine only has to watch a child list where some sheet actually asks about one.
    ...(rules.some(asksAboutSiblings) ? { structural: true } : {}),
  };
}

/**
 * One `@font-face`, as the registration the platform needs.
 *
 * The source is left as a marker rather than a value: the bundler turns it into a `require` on
 * the way out, because a font file is a module the bundler has to see, not a string.
 *
 * There is no font *matching* here, and there is none on the device either: native looks a family
 * up by name and that is all. So a weight is kept beside the family rather than folded into it,
 * and two faces of one family are two families as far as anything downstream is concerned.
 */
function fontFace(value, context) {
  const properties = value?.properties ?? [];
  const read = (type) => properties.find((property) => property.type === type)?.value;

  const family = read('font-family');
  if (typeof family !== 'string') {
    throw new CssUnsupported(`${context}: an @font-face needs a font-family to be known by`);
  }

  const weight = read('font-weight')?.[0]?.value?.value;
  const style = read('font-style')?.type;
  return {
    family,
    // Replaced with a `require` by the transformer. A plain string here would be a path the
    // bundler never sees and a font that is missing on device with nothing to say why.
    source: { asset: fontUrl(read('source'), family, context) },
    ...(typeof weight === 'number' ? { weight } : {}),
    ...(style && style !== 'normal' ? { style } : {}),
  };
}

/** The file a face comes from. Anything but a `url()` is a font the bundle would not contain. */
function fontUrl(sources, family, context) {
  const list = sources ?? [];
  const url = list.find((source) => source.type === 'url')?.value?.url?.url;
  if (url) return url;

  const what = list.length ? `'${list[0].type}()' is not a file this can bundle` : 'none';
  throw new CssUnsupported(
    `${context}: @font-face '${family}' needs a src: url() naming a file in the app (${what}).`,
  );
}

/** Whether a rule's outcome can change because a sibling appeared or left. */
function asksAboutSiblings(rule) {
  if (rule.combinators.some((one) => one === 'next-sibling' || one === 'later-sibling'))
    return true;
  return rule.compounds.some(asksAboutPosition);
}

/**
 * Whether a compound, or any compound nested in it, asks about a child list: its place in its
 * parent's, or whether its own is empty. `:not(:last-child)` asks as much as `:last-child` does.
 */
function asksAboutPosition(compound) {
  if (compound.nth !== undefined || compound.empty !== undefined) return true;
  const nested = [
    ...(compound.not ?? []),
    ...(compound.is ?? []).flat(),
    ...(compound.ancestors ?? []),
    ...(compound.hostContext ?? []),
  ];
  return nested.some(asksAboutPosition);
}

/**
 * `platform-color(label, ?attr/textColorPrimary)`: a colour the *system* defines.
 *
 * Held as the list of names rather than resolved, because which one is right is a runtime
 * question - the same declaration is `{semantic: [...]}` on iOS and `{resource_paths: [...]}` on
 * Android, and a build step that produced either would be a stylesheet that works on one platform.
 * Several names are allowed for exactly that reason: native takes the first that resolves, so one
 * declaration can name iOS's colour and Android's.
 */
const PLATFORM_COLOR = 'platform-color';

/** The declaration a `platform-color()` value produces, or null if this is not one. */
function asPlatformColor(value, context) {
  const parts = value?.value ?? [];
  const part = parts.length === 1 ? parts[0] : null;
  if (part?.type !== 'function' || part.value?.name !== PLATFORM_COLOR) return null;

  const property = value?.propertyId?.property ?? 'a property';
  const props = propsFor(property);
  if (!props.length) {
    throw new CssUnsupported(`${context}: '${property}' does not take a colour`);
  }
  return { props, value: platformColor(part, context) };
}

function platformColor(part, context) {
  const names = (part.value?.arguments ?? [])
    .filter(
      (term) => !(term.type === 'token' && ['white-space', 'comma'].includes(term.value?.type)),
    )
    .map((term) => nameOf(term, context));

  if (!names.length) {
    throw new CssUnsupported(
      `${context}: platform-color() needs at least one name, or it is a colour that never resolves`,
    );
  }
  return { platformColor: names };
}

/** A name is an ident, or a string where it has to be - Android's are `?attr/...`. */
function nameOf(term, context) {
  const token = term?.type === 'token' ? term.value : null;
  if (token?.type === 'ident' || token?.type === 'string') return token.value;
  // `?attr/textColorPrimary` is not one token, so it arrives as several; a quoted string is the
  // spelling that survives, and saying so beats silently taking the first word.
  throw new CssUnsupported(
    `${context}: '${JSON.stringify(term).slice(0, 40)}' is not a platform colour name. ` +
      `Quote it if it is not a plain word: platform-color("?attr/textColorPrimary").`,
  );
}

/** The combinators a node's own position can answer, which is all four of the real ones. */
const COMBINATORS = new Set(['descendant', 'child', 'next-sibling', 'later-sibling']);

/**
 * `:first-child` and its family, as the counting tests they are defined as.
 *
 * CSS says all four in terms of `an + b`: `:first-child` is the first from the start,
 * `:last-child` the first from the end, and `:only-child` is both at once. Reducing them here
 * means the matcher has one thing to evaluate rather than five.
 */
function positionTests(part) {
  switch (part.kind) {
    case 'first-child':
      return [{ a: 0, b: 1 }];
    case 'last-child':
      return [{ a: 0, b: 1, fromEnd: true }];
    case 'only-child':
      return [
        { a: 0, b: 1 },
        { a: 0, b: 1, fromEnd: true },
      ];
    case 'nth-child':
    case 'nth-last-child': {
      // `of <selector>` restricts what is counted, which needs a second matching pass per sibling.
      if (part.of) return null;
      const test = { a: part.a, b: part.b };
      return [part.kind === 'nth-last-child' ? { ...test, fromEnd: true } : test];
    }
    default:
      return null;
  }
}

/**
 * Nested rules, lowered into the flat ones they stand for.
 *
 * A visitor sees the parsed selector, where nesting is still an `&`, and lowering it is not a
 * substitution: `&` can appear anywhere in a selector, more than once, and inside `:is()`. The
 * parser already knows how to do it exactly, so it is asked, in a pass of its own.
 *
 * Skipped unless the sheet actually nests, because it is a second parse of every stylesheet.
 */
/**
 * Each bare number in a length's value tagged with a unit of its own, so it reaches the compiler
 * as the mistake it is.
 *
 * A browser drops `margin-top: 3`: only 0 may be written without a unit. lightningcss reads it as
 * 3px, so Tailwind's `m-[3]` was a margin on a phone and nothing on the web, and the compiler had
 * no way to tell. Tagged `3__unitless`, it arrives as a dimension no length has, and is refused
 * as one that needs a unit. Only at the top level of the value: a number inside `calc()` is a
 * factor, and custom properties and `line-height` take bare numbers.
 */
function markUnitless(code) {
  return code.replace(
    /([{;]\s*)([a-z][a-z-]*)(\s*:)([^;{}]*)/g,
    (whole, before, name, colon, value) =>
      takesUnits(name) ? `${before}${name}${colon}${tagBareNumbers(value)}` : whole,
  );
}

/** Whether a property's bare numbers other than 0 are an error: every length but line-height. */
const takesUnits = (name) =>
  name !== 'line-height' && (kindOf(name) === 'length' || UNIT_SHORTHANDS.has(name));

/** Lengths `kindOf` does not name, whose values are one or more lengths. */
const UNIT_SHORTHANDS = new Set([
  'translate',
  'gap',
  'inset',
  'inset-inline',
  'inset-block',
  'margin-inline',
  'margin-block',
  'padding-inline',
  'padding-block',
  'border-width',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-inline',
  'border-inline-start',
  'border-inline-end',
  'border-block',
  'border-block-start',
  'border-block-end',
  'outline',
  'border-inline-width',
  'border-block-width',
  'border-radius',
  'transform-origin',
  'background-size',
  'background-position',
  'background-position-x',
  'background-position-y',
]);

/** A value's top-level bare numbers, other than 0, with the unit that says they had none. */
function tagBareNumbers(value) {
  let depth = 0;
  let out = '';
  // A calc() of numbers alone is a number too: `-inset-[3]` is `calc(3 * -1)`.
  const numeric = value.replace(/calc\(([-+*/\d.\s]+)\)/gi, (whole, inside) => {
    const result = arithmetic(inside);
    return result === null ? whole : String(result);
  });
  for (const token of numeric.split(/(\s+|,|\(|\))/)) {
    if (token === '(') depth++;
    else if (token === ')') depth--;
    const bare = depth === 0 && /^[+-]?(\d+\.?\d*|\.\d+)$/.test(token) && Number(token) !== 0;
    out += bare ? `${token}__unitless` : token;
  }
  return out;
}

/** Plain-number arithmetic: `3 * -1`. Null for anything with more than numbers in it. */
function arithmetic(text) {
  if (!/^[-+*/\d.\s]+$/.test(text)) return null;
  const result = Function(`"use strict"; return (${text});`)();
  return Number.isFinite(result) ? Math.round(result * 1000) / 1000 : null;
}

function flatten(source, context) {
  const unchanged = { code: source, lineOf: (line) => line };
  if (!source.includes('&') && !NESTED_BLOCK.test(source)) return unchanged;
  try {
    // Nesting is the only feature asked to be lowered. A browser target lowered everything that
    // browser lacked as well: the media range syntax became 'not' queries, which are refused, and
    // a colour became a list of fallbacks, so a sheet read differently for having a media query.
    //
    // `translate`, `rotate` and `scale` are hidden from it as custom properties, because its
    // printer folds them into a `transform` in the same block: in the wrong order, and dropping
    // them outright when `transform` comes second. They are separate properties, and the engine
    // composes them itself.
    const hidden = source.replace(INDIVIDUAL_TRANSFORM, `$1${HIDDEN_TRANSFORM}$2$3`);
    const lowered = lightning.transform({
      filename: `${context}.css`,
      code: Buffer.from(hidden),
      include: lightning.Features.Nesting,
      // The lowered text is printed afresh, so its lines are not the sheet's. The map says which
      // line each came from, so an error can still name the line somebody wrote.
      sourceMap: true,
    });
    return {
      code: lowered.code.toString().replaceAll(HIDDEN_TRANSFORM, ''),
      lineOf: sourceLines(lowered.map),
    };
  } catch {
    // Left to the real pass, which says where the syntax error is rather than that there is one.
    return unchanged;
  }
}

/** Base64's alphabet, which a source map's VLQ digits are written in. */
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * The source line of each printed line, read off a source map, as a function from a printed line
 * to the line it came from (both from 1). Only lines matter here, so each segment is read for its
 * third field and the rest skipped. Read by hand because the compiler also runs in a browser,
 * where a map comes back as bytes and there is no package to read it with.
 */
function sourceLines(map) {
  if (!map) return (line) => line;
  const { mappings } = JSON.parse(typeof map === 'string' ? map : new TextDecoder().decode(map));
  const lines = [];
  let source = 0;
  for (const printed of mappings.split(';')) {
    let first;
    for (const segment of printed.split(',')) {
      const fields = vlq(segment);
      if (fields.length < 4) continue;
      source += fields[2];
      first ??= source;
    }
    // A printed line with no segment of its own continues the one above it.
    lines.push(first ?? lines.at(-1) ?? 0);
  }
  return (line) => (lines[line - 1] ?? lines.at(-1) ?? 0) + 1;
}

/** One source map segment's fields, decoded from base64 VLQ. */
function vlq(segment) {
  const fields = [];
  let value = 0;
  let shift = 0;
  for (const character of segment) {
    const digit = BASE64.indexOf(character);
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
      continue;
    }
    fields.push(value & 1 ? -(value >>> 1) : value >>> 1);
    value = 0;
    shift = 0;
  }
  return fields;
}

/**
 * A block opening inside a block: the implicit nesting that needs no `&`.
 *
 * Deliberately loose. A false positive costs one extra parse of a sheet that did not need it; a
 * false negative is a rule that silently never matches.
 */
const NESTED_BLOCK = /\{[^{}]*\{/;

/** A `translate`, `rotate` or `scale` declaration's name, and what comes before and after it. */
const INDIVIDUAL_TRANSFORM = /([{;\s])(translate|rotate|scale)(\s*:)/g;
const HIDDEN_TRANSFORM = '--solid-native-individual-';

module.exports = { compileCss, CssUnsupported, deferHslToken, linear, markUnitless, opacityOf };
