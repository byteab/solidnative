/**
 * A colour written with a `var()` in it, read from lightningcss's raw token stream into the
 * expression the device resolves once the tokens are known: a literal colour, a token, or a
 * `color-mix()` of two such.
 *
 * lightningcss parses no value with a `var()` anywhere in it, so a gradient stop, a shadow colour
 * or a colour property that mixes from a token arrives as tokens. What can be settled here is: the
 * literal colours, the space and hue method, the percentages. Only the token itself waits.
 */
const { CssUnsupported, color, length, round } = require('./values.cjs');

/** The spaces the device mixes in, which are the ones this compiler also folds a literal mix in. */
const MIX_SPACES = new Set(['srgb', 'oklab', 'oklch', 'lab', 'lch', 'hsl', 'hwb']);
const HUE_METHODS = new Set(['shorter', 'longer', 'increasing', 'decreasing']);

/** Tokens that carry meaning: white space dropped. */
const meaningful = (terms) =>
  (terms ?? []).filter((term) => !(term?.type === 'token' && term.value?.type === 'white-space'));

/** The terms between commas. */
function commaSeparated(terms) {
  const groups = [[]];
  for (const term of terms) {
    if (term?.type === 'token' && term.value?.type === 'comma') groups.push([]);
    else groups[groups.length - 1].push(term);
  }
  return groups;
}

/** Whether a term, or anything inside it, is a `var()`. */
function mentionsVar(term) {
  if (term?.type === 'var') return true;
  if (term?.type === 'function') return (term.value?.arguments ?? []).some(mentionsVar);
  return false;
}

/**
 * One colour, as the terms that spell it: `var(--x)`, a literal colour, or a `color-mix()`.
 *
 * Returns the expression the device resolves. A colour with no `var()` in it is settled into a
 * literal here, so the device never mixes what the build could have.
 */
function colourExpression(terms, context) {
  const parts = meaningful(terms);
  if (parts.length !== 1) {
    throw new CssUnsupported(`${context}: expected one colour here, not ${parts.length} values`);
  }
  const [part] = parts;
  if (part.type === 'var') return reference(part, context);
  if (part.type === 'function') return functionColour(part, context);
  return { color: literal(part, context) };
}

/** A colour function: `color-mix()`, `rgba()` of token channels, an `hsl()` of tokens. */
function functionColour(part, context) {
  if (part.value?.name === 'color-mix') return mixExpression(part.value.arguments, context);
  if (isRelative(part)) return relativeExpression(part, context);
  const tokened = channelsColour(part, context) ?? require('./compile.cjs').deferHslToken([part]);
  if (tokened) return tokened;
  if (mentionsVar(part)) {
    throw new CssUnsupported(
      `${context}: ${part.value?.name}() with a var() in it is only understood as a whole colour ` +
        `token, inside color-mix(), as rgba(var(--channels), <alpha>) or as an hsl() of tokens. ` +
        `Put the whole colour in the variable instead.`,
    );
  }
  return { color: literal(part, context) };
}

/** Whether a colour function is a relative colour: its first word is `from`. */
function isRelative(part) {
  const [first] = meaningful(part.value?.arguments);
  return first?.type === 'token' && first.value?.type === 'ident' && first.value.value === 'from';
}

/**
 * `rgb(var(--channels))` or `rgba(var(--channels), <alpha>)`: a colour whose channels are a token,
 * as Bootstrap writes its focus rings, with an alpha written beside them or taken from a token.
 */
function channelsColour(part, context) {
  const name = part.value?.name?.toLowerCase();
  if (name !== 'rgb' && name !== 'rgba') return null;
  const args = meaningful(part.value.arguments).filter(
    (term) => !(term.type === 'token' && term.value?.type === 'comma'),
  );
  const [channels, alpha, ...rest] = args;
  if (channels?.type !== 'var' || rest.length) return null;
  const opacity = require('./compile.cjs').opacityOf(alpha, context);
  return {
    channels: { reference: channels.value.name.ident },
    ...(opacity.adjust ? { alpha: opacity.adjust.alpha } : {}),
    ...(opacity.alpha ? { alpha: opacity.alpha } : {}),
  };
}

/** A literal colour token: a parsed colour, or a named one lightningcss left as a word. */
function literal(part, context) {
  if (part.type === 'color') return color(part.value, context);
  if (part.type === 'token' && part.value?.type === 'ident')
    return color(part.value.value, context);
  if (part.type === 'token' && part.value?.type === 'hash') return `#${part.value.value}`;
  throw new CssUnsupported(`${context}: expected a colour, not '${part.type}'`);
}

/** `var(--x)`, with a fallback colour if one is written and the var() alternatives it names. */
function reference(part, context) {
  const name = part.value?.name?.ident;
  const fallback = meaningful(part.value?.fallback);
  const alternatives = [];
  let literalFallback;
  let next = fallback;
  while (next.length === 1 && next[0].type === 'var') {
    alternatives.push(next[0].value?.name?.ident);
    next = meaningful(next[0].value?.fallback);
  }
  if (next.length) literalFallback = literal(next[0], `${context} (fallback)`);
  return {
    reference: name,
    ...(alternatives.length ? { alternatives } : {}),
    ...(literalFallback === undefined ? {} : { fallback: literalFallback }),
  };
}

/**
 * `color-mix(in <space> [<method> hue], <colour> [p%], <colour> [q%])`.
 *
 * The percentages are kept as written, missing ones included: CSS says what a missing one is
 * worth, and the device works it out with the other side in front of it.
 */
function mixExpression(args, context) {
  const [method, ...sides] = commaSeparated(meaningful(args));
  const words = method.map((term) => term.value?.value);
  if (words[0] !== 'in' || !MIX_SPACES.has(words[1])) {
    throw new CssUnsupported(
      `${context}: color-mix() with a var() in it is worked out on device in ` +
        `${[...MIX_SPACES].join(', ')}; '${words.slice(1).join(' ')}' is not one of them.`,
    );
  }
  const hue =
    words.length === 4 && words[3] === 'hue' && HUE_METHODS.has(words[2]) ? words[2] : undefined;
  if (words.length > 2 && hue === undefined) {
    throw new CssUnsupported(`${context}: '${words.slice(2).join(' ')}' is not a hue method`);
  }
  if (sides.length !== 2) {
    throw new CssUnsupported(`${context}: color-mix() takes two colours, not ${sides.length}`);
  }
  const [a, b] = sides.map((side) => mixSide(side, context));
  return {
    mix: {
      space: words[1],
      ...(hue ? { hue } : {}),
      a: a.expression,
      ...(a.percentage === undefined ? {} : { aPercentage: a.percentage }),
      b: b.expression,
      ...(b.percentage === undefined ? {} : { bPercentage: b.percentage }),
    },
  };
}

/** One side of a mix: its colour, and the percentage written before or after it. */
function mixSide(terms, context) {
  const isPercentage = (term) => term?.type === 'token' && term.value?.type === 'percentage';
  const percentages = terms.filter(isPercentage);
  const colour = terms.filter((term) => !isPercentage(term));
  if (percentages.length > 1) {
    throw new CssUnsupported(`${context}: one percentage per colour in a color-mix()`);
  }
  return {
    expression: colourExpression(colour, context),
    percentage: percentages.length ? round(percentages[0].value.value * 100) : undefined,
  };
}

/**
 * `box-shadow` with a `var()` in a colour, as the shadow maps Fabric reads, each colour a marker
 * the device fills in: `{ __colour: <expression> }`. Lengths are settled here as for any shadow.
 */
function shadowsWithColourTokens(terms, context) {
  return commaSeparated(meaningful(terms)).map((shadow) => oneShadow(shadow, context));
}

/** One shadow of a list, or a whole shadow token standing in for some. */
function oneShadow(shadow, context) {
  // A whole shadow that is a token, in a list of others: Pico's hover shadow, then its ring.
  if (shadow.length === 1 && shadow[0].type === 'var') return shadowToken(shadow[0], context);
  // `var(--tw-ring-inset,)`: a token that is the word `inset` or nothing, which is what an empty
  // fallback in a shadow can only be. Settled on device, from whichever class set it.
  const slot = shadow.find(isInsetSlot);
  const inset = slot ? { __inset: { reference: slot.value.name.ident } } : shadow.some(isInset);
  const lengths = [];
  const colour = [];
  for (const term of shadow.filter((one) => !isInset(one) && one !== slot)) {
    if (isLength(term) || (term.type === 'var' && isLengthSlot(shadow, term))) {
      lengths.push(shadowLength(term, context));
    } else {
      colour.push(term);
    }
  }
  checkLengths(shadow, lengths, context);
  const expression = shadowColour(colour, slot, context);
  return {
    offsetX: lengths[0],
    offsetY: lengths[1],
    blurRadius: lengths[2] ?? 0,
    spreadDistance: lengths[3] ?? 0,
    color: isDeferred(expression) ? { __colour: expression } : expression.color,
    inset,
  };
}

/**
 * A shadow's colour: its colour terms; or with none, the empty-fallback token, which is the colour
 * or the word inset, and what the token holds says which (Tailwind's ring, which has a colour of
 * its own, is the other kind); or black.
 */
function shadowColour(colour, slot, context) {
  if (colour.length) return colourExpression(colour, context);
  if (slot) return { reference: slot.value.name.ident, fallback: 'black' };
  return { color: 'black' };
}

/** A `var()` with an empty fallback, which in a shadow can only stand for `inset` or nothing. */
const isInsetSlot = (term) =>
  term.type === 'var' &&
  Array.isArray(term.value?.fallback) &&
  meaningful(term.value.fallback).length === 0;

const isInset = (term) =>
  term.type === 'token' && term.value?.type === 'ident' && term.value.value === 'inset';

function checkLengths(shadow, lengths, context) {
  if (lengths.length < 2 && shadow.some((term) => term.type === 'var')) {
    throw new CssUnsupported(
      `${context}: a shadow whose lengths are one token, such as 'var(--size) <colour>', ` +
        `needs its lengths written out or the whole shadow in the token: a token is read in ` +
        `one form, and one length is not four.`,
    );
  }
  if (lengths.length < 2 || lengths.length > 4) {
    throw new CssUnsupported(
      `${context}: a shadow takes two to four lengths, not ${lengths.length}`,
    );
  }
}

function isLength(term) {
  if (term.type === 'length') return true;
  if (term.type === 'function' && ['calc', 'max'].includes(term.value?.name)) return true;
  return term.type === 'token' && ['number', 'dimension'].includes(term.value?.type);
}

/**
 * A shadow's length: written out, a token (`0 0 0 var(--ring-width)`, a focus ring's width), or
 * arithmetic around one (`calc(-1 * var(--border))`), the token looked up on device.
 */
function shadowLength(term, context) {
  if (term.type === 'var') return { __length: lengthReference(term, undefined, context) };
  if (term.type === 'function') {
    const arithmetic = require('./compile.cjs').linear(term, context);
    if (!arithmetic) {
      throw new CssUnsupported(`${context}: a shadow length with more than one var() in it`);
    }
    return { __length: lengthReference(arithmetic.reference, arithmetic.adjust, context) };
  }
  return settledLength(term, context);
}

function lengthReference(reference, adjust, context) {
  const fallback = meaningful(reference.value?.fallback);
  return {
    reference: reference.value?.name?.ident,
    ...(adjust && Object.keys(adjust).length ? { adjust } : {}),
    ...(fallback.length === 1 ? { fallback: settledLength(fallback[0], context) } : {}),
  };
}

/** A whole shadow from a token, with the fallback shadows written after the name, if any. */
function shadowToken(term, context) {
  const fallback = meaningful(term.value?.fallback);
  return {
    __shadows: {
      reference: term.value?.name?.ident,
      ...(fallback.length ? { fallback: shadowsWithColourTokens(fallback, context) } : {}),
    },
  };
}

function settledLength(term, context) {
  if (term.type === 'token' && term.value?.type === 'number') {
    if (term.value.value !== 0) throw new CssUnsupported(`${context}: a length needs a unit`);
    return 0;
  }
  return length(term.type === 'token' ? term.value : term, context);
}

/**
 * Whether a `var()` in a shadow is one of its lengths rather than its colour: a colour comes last,
 * so a var() followed by anything but nothing is a length, and so is one while fewer than two
 * lengths have been read.
 */
function isLengthSlot(shadow, term) {
  const index = shadow.indexOf(term);
  const after = shadow
    .slice(index + 1)
    .filter(
      (next) =>
        !(next.type === 'token' && next.value?.type === 'ident' && next.value.value === 'inset'),
    );
  if (after.length) return true;
  const lengthsBefore = shadow.slice(0, index).filter((one) => isLength(one) || one.type === 'var');
  return lengthsBefore.length < 2;
}

/** Whether an expression needs the device: anything but a literal. */
const isDeferred = (expression) => !('color' in expression);

/**
 * Each relative colour function: the space it works in, its channel keywords, and what 100% of
 * each channel is, `null` where a percentage is not allowed (a hue). The keywords stand for the
 * numbers CSS Color 5 gives them: `r g b` 0 to 255, `s l w b` of hsl and hwb 0 to 100.
 */
const RELATIVE = {
  rgb: { space: 'srgb', keywords: ['r', 'g', 'b'], full: [255, 255, 255] },
  rgba: { space: 'srgb', keywords: ['r', 'g', 'b'], full: [255, 255, 255] },
  hsl: { space: 'hsl', keywords: ['h', 's', 'l'], full: [null, 100, 100] },
  hsla: { space: 'hsl', keywords: ['h', 's', 'l'], full: [null, 100, 100] },
  hwb: { space: 'hwb', keywords: ['h', 'w', 'b'], full: [null, 100, 100] },
  lab: { space: 'lab', keywords: ['l', 'a', 'b'], full: [100, 125, 125] },
  lch: { space: 'lch', keywords: ['l', 'c', 'h'], full: [100, 150, null] },
  oklab: { space: 'oklab', keywords: ['l', 'a', 'b'], full: [1, 0.4, 0.4] },
  oklch: { space: 'oklch', keywords: ['l', 'c', 'h'], full: [1, 0.4, null] },
};

/** An angle in degrees, the unit a hue is a number of. */
const DEGREES = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

/** lightningcss reads numbers as 32-bit floats: 0.1 arrives as 0.10000000149011612. */
const exact = (value) => Math.round(value * 1e6) / 1e6;

/**
 * `<space>(from <colour> <channel> <channel> <channel> [/ <alpha>])` with a `var()` in it, which
 * the device works out: the origin converted into the space, each keyword the number it is there.
 *
 * A channel is a number, a keyword, or `calc()` arithmetic of them, kept as `[op, a, b]`. A bare
 * percentage or angle is settled here, since what it is a share of is the channel's own range;
 * inside `calc()` it is refused, as CSS refuses it: the keywords are numbers, and a number plus a
 * percentage is not one.
 */
function relativeExpression(part, context) {
  const name = part.value.name.toLowerCase();
  const spec = RELATIVE[name];
  if (!spec) {
    throw new CssUnsupported(
      `${context}: a relative ${name}() colour is not worked out on device; ` +
        `write it as ${Object.keys(RELATIVE).join(', ')}.`,
    );
  }
  const [, ...rest] = meaningful(part.value.arguments);
  const slash = rest.findIndex(
    (term) => term.type === 'token' && term.value?.type === 'delim' && term.value.value === '/',
  );
  const before = slash === -1 ? rest : rest.slice(0, slash);
  const alphaTerms = slash === -1 ? [] : rest.slice(slash + 1);
  const [origin, ...channelTerms] = before;
  if (!origin || channelTerms.length !== 3 || (slash !== -1 && alphaTerms.length !== 1)) {
    throw new CssUnsupported(
      `${context}: a relative ${name}() colour takes its origin, three channels and an optional ` +
        `alpha after a '/'`,
    );
  }
  const keywords = [...spec.keywords, 'alpha'];
  const channel = (term, index) =>
    channelOf(term, { keywords, full: index === 3 ? 1 : spec.full[index], name, context });
  return {
    relative: {
      space: spec.space,
      from: colourExpression([origin], context),
      channels: channelTerms.map(channel),
      ...(alphaTerms.length ? { alpha: channel(alphaTerms[0], 3) } : {}),
    },
  };
}

/** One channel of a relative colour: a bare value, or a `calc()` of keywords and numbers. */
function channelOf(term, place) {
  const { full, context } = place;
  if (term.type === 'angle' && full === null) {
    return exact(term.value.value * (DEGREES[term.value.type] ?? NaN));
  }
  if (term.type === 'token' && term.value?.type === 'percentage' && full !== null) {
    return exact(term.value.value * full);
  }
  if (term.type === 'function' && term.value?.name === 'calc') {
    const terms = meaningful(term.value.arguments);
    const parsed = arithmetic(terms, 0, place);
    if (parsed.next !== terms.length) throw badChannel(place, 'is not arithmetic');
    return parsed.value;
  }
  return operand(term, place);
}

/** A number or a keyword: the only things a relative channel's arithmetic is made of. */
function operand(term, { keywords, context, name }) {
  if (term.type === 'token' && term.value?.type === 'number') return exact(term.value.value);
  if (
    term.type === 'token' &&
    term.value?.type === 'ident' &&
    keywords.includes(term.value.value)
  ) {
    return term.value.value;
  }
  throw badChannel({ context, name }, `cannot take '${term.value?.value ?? term.type}' here`);
}

const badChannel = ({ context, name }, why) =>
  new CssUnsupported(
    `${context}: a channel of a relative ${name}() colour ${why}. Its keywords are numbers, so ` +
      `arithmetic on them is numbers and keywords; a percentage or an angle stands alone.`,
  );

const operatorOf = (term) =>
  term?.type === 'token' && term.value?.type === 'delim' ? term.value.value : undefined;

/** `a + b - c`, each side a product. Returns the tree and where it stopped reading. */
function arithmetic(terms, start, place) {
  let { value, next } = product(terms, start, place);
  while (operatorOf(terms[next]) === '+' || operatorOf(terms[next]) === '-') {
    const op = operatorOf(terms[next]);
    const right = product(terms, next + 1, place);
    value = [op, value, right.value];
    next = right.next;
  }
  return { value, next };
}

/** `a * b / c`, each side a number, a keyword, or arithmetic in brackets. */
function product(terms, start, place) {
  let { value, next } = factor(terms, start, place);
  while (operatorOf(terms[next]) === '*' || operatorOf(terms[next]) === '/') {
    const op = operatorOf(terms[next]);
    const right = factor(terms, next + 1, place);
    value = [op, value, right.value];
    next = right.next;
  }
  return { value, next };
}

function factor(terms, start, place) {
  const term = terms[start];
  if (term?.type === 'token' && term.value?.type === 'parenthesis-block') {
    const inner = arithmetic(terms, start + 1, place);
    if (terms[inner.next]?.value?.type !== 'close-parenthesis') {
      throw badChannel(place, 'has an unclosed bracket');
    }
    return { value: inner.value, next: inner.next + 1 };
  }
  if (!term) throw badChannel(place, 'ends too soon');
  return { value: operand(term, place), next: start + 1 };
}

/** Whether a parsed value has a `light-dark()` anywhere in it, in either of lightningcss's forms. */
function mentionsLightDark(value) {
  if (Array.isArray(value)) return value.some(mentionsLightDark);
  if (value === null || typeof value !== 'object') return false;
  if (value.type === 'light-dark') return true;
  return Object.values(value).some(mentionsLightDark);
}

/**
 * A parsed value with every `light-dark()` in it replaced by its `light` or `dark` side.
 *
 * lightningcss parses one of literal colours into a colour of type `light-dark`, and leaves one
 * with a `var()` in it as an `unresolved-color` of terms, which are spliced into the list around it.
 */
function schemeSide(value, side) {
  if (Array.isArray(value)) {
    return value.flatMap((term) =>
      term?.type === 'unresolved-color' && term.value?.type === 'light-dark'
        ? schemeSide(term.value[side], side)
        : [schemeSide(term, side)],
    );
  }
  if (value === null || typeof value !== 'object') return value;
  if (value.type === 'light-dark') return schemeSide(value[side], side);
  const sided = Object.fromEntries(
    Object.entries(value).map(([key, part]) => [key, schemeSide(part, side)]),
  );
  // A declaration lightningcss left as terms stays terms, and says why: it is not a value that
  // failed to parse, but one side of a value that could not be parsed until it was chosen.
  return value.property === 'unparsed' && mentionsLightDark(value)
    ? { ...sided, schemeSide: side }
    : sided;
}

module.exports = {
  colourExpression,
  isRelative,
  mentionsLightDark,
  schemeSide,
  commaSeparated,
  isDeferred,
  meaningful,
  mentionsVar,
  shadowsWithColourTokens,
};
