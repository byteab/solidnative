/**
 * CSS value -> React Native style value.
 *
 * lightningcss hands us a parsed, longhand-expanded, typed AST, so this translates structured
 * data rather than parsing strings. Anything it cannot express throws: a style that silently
 * does nothing is the failure mode this project keeps being bitten by.
 */
const { toSrgb, SPACES } = require('./color-spaces.cjs');

/** Root font size for `rem`. RN has no notion of one, so we pick the web default. */
const REM = 16;

class CssUnsupported extends Error {
  constructor(message) {
    super(message);
    this.name = 'CssUnsupported';
  }
}

/**
 * The largest length worth sending native, and what an infinite one becomes.
 *
 * `border-radius: calc(infinity * 1px)` is how Tailwind writes `rounded-full`, and it arrives as
 * f32's own ceiling because that is where lightningcss stores it. Native cannot paint 3.4e38: the
 * corners come out square, silently, which is how a pill button and a round radio were rectangles.
 * What the CSS means is "as round as it goes", and a big finite number is how native says that -
 * 9999 being React Native's own idiom for it.
 */
const HUGE = 9999;
/** Anything at or beyond this was `infinity` before lightningcss stored it in 32 bits. */
const F32_CEILING = 3.4e38;

/**
 * Trim 32-bit float noise. lightningcss stores numbers as f32, so `opacity: 0.4` comes back as
 * 0.4000000059604645 and would ship that way in every bundle.
 *
 * An infinite value is clamped rather than rounded. See `HUGE`.
 */
const round = (value) => {
  if (typeof value !== 'number') return value;
  if (!Number.isFinite(value) || Math.abs(value) >= F32_CEILING) {
    return value < 0 ? -HUGE : HUGE;
  }
  // `+ 0` makes a negative zero zero, which JSON would anyway, and the module Metro writes is JSON.
  return Math.round(value * 1e5) / 1e5 + 0;
};

const camel = (property) => property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** What a value that is not a length is, for the message that says so. */
const NOT_A_LENGTH = { color: 'a colour', time: 'a time', angle: 'an angle', string: 'a string' };

/** A length, in the numbers RN wants (points) or a percentage string. */
// eslint-disable-next-line complexity -- a dispatch table: one flat case per CSS form
function length(value, context) {
  if (value == null) return undefined;
  if (typeof value === 'number') return round(value);

  switch (value.type) {
    case 'length-percentage':
    case 'length':
      return length(value.value, context);
    case 'percentage':
      // Rounded like every other number here: lightningcss stores these as f32, so 20% arrives
      // as 20.000000298023224 and would ship that way in every bundle.
      return `${round(value.value * 100)}%`;
    case 'dimension': {
      const { unit, value: n } = value.value ?? value;
      if (unit === 'px') return round(n);
      // Tagged by `markUnitless` in compile.cjs: a bare number, which a browser drops.
      if (unit === '__unitless') {
        throw new CssUnsupported(
          `${context}: a length needs a unit: '${round(n)}' is a bare number, which a browser drops. ` +
            `Write ${round(n)}px, or 0 for none.`,
        );
      }
      if (unit === 'rem') return round(n * REM);
      // Relative to something known only after the cascade has run, or that changes while the app
      // is open. Marked here and resolved at match time, beside var().
      if (unit === 'em' || unit === 'vw' || unit === 'vh' || unit === 'vmin' || unit === 'vmax') {
        return { __defer: { unit, factor: round(n) } };
      }
      throw new CssUnsupported(
        `${context}: unit '${unit}' has no meaning on native ` +
          `(px, rem, em, %, vw, vh, vmin and vmax are)`,
      );
    }
    case 'calc': {
      const { offset, unit, factor } = evaluateCalc(value.value, context);
      if (!unit) return round(offset);
      return { __defer: { unit, factor: round(factor), offset: round(offset) } };
    }
    case 'value':
      return length(value.value, context);
    case 'auto':
      return 'auto';
    // A border or outline width. `medium` is also what lightningcss fills in for a shorthand that
    // left the width out, so it arrives from `border: none` as often as from anyone writing it.
    case 'thin':
      return 1;
    case 'medium':
      return 3;
    case 'thick':
      return 5;
    default:
      if ('unit' in value) return length({ type: 'dimension', value }, context);
      throw new CssUnsupported(
        `${context}: expected a length, and ${NOT_A_LENGTH[value?.type] ?? `'${value?.type}'`} is not one`,
      );
  }
}

/**
 * A `calc()` reduced to `offset + factor * unit`, where the unit is one the device resolves (a
 * viewport unit or `em`) or absent.
 *
 * lightningcss keeps the tree rather than folding it, because on the web a percentage may survive
 * to layout. Here it may not, since there is nothing on device that could finish the sum. But a
 * sum of an absolute length and one relative length is linear, and the device already resolves
 * the relative one, so `calc(1.375rem + 1.5vw)` - Bootstrap's responsive type - defers exactly as
 * `1.5vw` does, carrying the rest as an offset.
 */
// eslint-disable-next-line complexity -- one flat case per calc node
function evaluateCalc(node, context) {
  if (node == null) throw new CssUnsupported(`${context}: could not read calc()`);
  switch (node.type) {
    case 'function':
    case 'calc':
      return evaluateCalc(node.value, context);
    case 'sum':
      return node.value.map((part) => evaluateCalc(part, context)).reduce(sum(context));
    case 'product':
      return node.value.map((part) => evaluateCalc(part, context)).reduce(product(context));
    case 'number':
      return { offset: node.value };
    case 'min':
    case 'max':
    case 'clamp':
      return { offset: extremum(node, context) };
    case 'value': {
      const resolved = length(node.value, context);
      if (typeof resolved === 'number') return { offset: resolved };
      if (resolved?.__defer) return { offset: 0, ...resolved.__defer };
      throw new CssUnsupported(
        `${context}: calc() can only combine absolute lengths here. A percentage is resolved ` +
          `during native layout, and there is no expression evaluator on device to finish it.`,
      );
    }
    default:
      throw new CssUnsupported(`${context}: calc() cannot use '${node.type}' here`);
  }
}

/** Add two linear terms. Two different relative units would need a calc engine on device. */
const sum = (context) => (a, b) => {
  if (a.unit && b.unit && a.unit !== b.unit) {
    throw new CssUnsupported(
      `${context}: calc() can combine one relative unit with absolute lengths, not ` +
        `${a.unit} with ${b.unit}: that needs evaluating on device.`,
    );
  }
  const unit = a.unit ?? b.unit;
  return unit
    ? { offset: a.offset + b.offset, unit, factor: (a.factor ?? 0) + (b.factor ?? 0) }
    : { offset: a.offset + b.offset };
};

/** Multiply two terms, at most one of which is relative: anything else is not linear. */
const product = (context) => (a, b) => {
  if (a.unit && b.unit) throw new CssUnsupported(`${context}: calc() cannot multiply two lengths`);
  const [relative, scalar] = a.unit ? [a, b] : [b, a];
  if (!relative.unit) return { offset: a.offset * b.offset };
  return {
    offset: relative.offset * scalar.offset,
    unit: relative.unit,
    factor: relative.factor * scalar.offset,
  };
};

/** `min()`, `max()` or `clamp()`, folded. Only over absolute lengths: the comparison happens here. */
function extremum(node, context) {
  const values = node.value.map((part) => {
    const term = evaluateCalc(part, context);
    if (term.unit) {
      throw new CssUnsupported(
        `${context}: ${node.type}() over a ${term.unit} length needs the comparison made on ` +
          `device, and there is no expression evaluator there. Only absolute lengths fold.`,
      );
    }
    return term.offset;
  });
  if (node.type === 'min') return Math.min(...values);
  if (node.type === 'max') return Math.max(...values);
  const [low, preferred, high] = values;
  return Math.max(low, Math.min(preferred, high));
}

/**
 * A CSS named colour, resolved by the parser rather than by a table copied out of the spec.
 *
 * A bare `red` reaches a custom property as an ident and nothing else here can tell it from
 * `center`, so `--brand: red` would otherwise be a colour that resolves to nothing wherever it is
 * used. Cached, because the same handful of names appear all over a sheet.
 */
const named = new Map();
function namedColor(word) {
  if (named.has(word)) return named.get(word);
  let resolved = null;
  require('lightningcss').transform({
    filename: 'color.css',
    code: Buffer.from(`a{color:${word}}`),
    visitor: {
      Declaration(declaration) {
        if (declaration.property === 'color' && declaration.value?.type === 'rgb') {
          resolved = declaration.value;
        }
      },
    },
  });
  named.set(word, resolved);
  return resolved;
}

/**
 * A bare word read as a colour, if it is one.
 *
 * The word arrives either as a raw token or already unwrapped, depending on which caller got
 * there first, and only the parser can say whether `red` is a colour and `center` is not.
 */
function resolveNamed(value) {
  const word =
    value?.type === 'ident'
      ? value.value
      : value?.value?.type === 'ident'
        ? value.value.value
        : null;
  return typeof word === 'string' ? namedColor(word) : null;
}

/** A colour, as an `rgba()` string: RN's processColor handles those, and they survive the bundle. */
function color(value, context) {
  if (typeof value === 'string') return value;
  const named = resolveNamed(value);
  if (named) return color(named, context);

  switch (value?.type) {
    case 'rgb':
      return value.alpha === 1
        ? `rgb(${value.r}, ${value.g}, ${value.b})`
        : `rgba(${value.r}, ${value.g}, ${value.b}, ${alpha(value.alpha)})`;
    case 'currentcolor':
      throw new CssUnsupported(`${context}: currentColor has no equivalent without a cascade root`);
    default:
      // A static `color-mix()` in one of these spaces arrives here too: lightningcss works the
      // mix out itself and hands it back in the space it was mixed in.
      if (SPACES.has(value?.type)) return color({ type: 'rgb', ...toSrgb(value) }, context);
      throw refusedColour(value, context);
  }
}

/**
 * An alpha, printed the way a browser prints it.
 *
 * lightningcss round-trips alpha through eight bits, so `.5` arrives as 128/255, or 0.50196.
 * Printing that to three places gave 0.502 where every browser says 0.5: CSSOM serialises the
 * shortest of two or three decimals that comes back to the same eight bits, which is this.
 */
function alpha(value) {
  // `none` arrives as NaN, and CSS Color 4 treats a missing component as zero.
  if (!Number.isFinite(value)) return 0;
  const byte = Math.round(value * 255);
  const two = Math.round(value * 100) / 100;
  return Math.round(two * 255) === byte ? two : Math.round(value * 1000) / 1000;
}

/** Why a colour could not be converted, said in words rather than as the parser's JSON. */
function refusedColour(value, context) {
  // lightningcss folds these to rgb itself, and hands one back as it is only when it has none in it.
  if (value?.type === 'hsl' || value?.type === 'hwb') {
    return new CssUnsupported(
      `${context}: an ${value.type}() colour with a 'none' component is not converted; write 0.`,
    );
  }
  const space = typeof value?.type === 'string' ? `'${value.type}' colours are` : 'this colour is';
  return new CssUnsupported(
    `${context}: ${space} not converted. Write it as a hex, rgb(), hsl(), hwb(), lab(), lch(), ` +
      `oklab() or oklch() colour, which are converted to the sRGB native paints.`,
  );
}

/** A bare keyword, e.g. `center`, `absolute`, `row`. */
/**
 * The four shapes lightningcss hands back for what is, in the source, a bare identifier.
 *
 * A plain string; a one-key object whose `type` is the keyword; an object carrying it under
 * `value`; and `{ type: 'sticky', value: [] }`, the keyword-with-an-empty-argument-list form. That
 * last one used to fall through to "expected a keyword", which reads like a parser bug rather than
 * like the unsupported value it is, and hid the real explanation from the per-property allowlist
 * in `properties.cjs`.
 */
const KEYWORD_SHAPES = [
  (value) => (typeof value === 'string' ? value : undefined),
  (value) => (value?.type && Object.keys(value).length === 1 ? value.type : undefined),
  (value) => (typeof value?.value === 'string' ? value.value : undefined),
  (value) => (value?.value?.type ? value.value.type : undefined),
  // The list, when it is not empty, is vendor prefixes: `position: -webkit-sticky` is `sticky`.
  (value) =>
    typeof value?.type === 'string' &&
    Array.isArray(value.value) &&
    value.value.every((prefix) => typeof prefix === 'string')
      ? value.type
      : undefined,
];

function keyword(value, context) {
  for (const shape of KEYWORD_SHAPES) {
    const found = shape(value);
    if (found !== undefined) return found;
  }
  throw new CssUnsupported(
    `${context}: expected a keyword, got ${JSON.stringify(value).slice(0, 60)}`,
  );
}

/** Degrees per unit, for the angle units CSS allows. RN only understands deg and rad. */
const PER_TURN = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

/** An angle, as the `'45deg'` string RN's transform operations take. */
function angle(value, context) {
  if (typeof value === 'number') return `${value}deg`;
  const unit = value?.type;
  if (unit && unit in PER_TURN) {
    return `${Math.round(value.value * PER_TURN[unit] * 1000) / 1000}deg`;
  }
  if (value?.value !== undefined) return angle(value.value, context);
  throw new CssUnsupported(
    `${context}: expected an angle, got ${JSON.stringify(value).slice(0, 60)}`,
  );
}

/** A bare number, e.g. the argument to `scale()` or a unitless `line-height`. */
function number(value, context) {
  if (typeof value === 'number') return round(value);
  if (value?.type === 'number' && typeof value.value === 'number') return round(value.value);
  if (value?.value !== undefined) return number(value.value, context);
  throw new CssUnsupported(
    `${context}: expected a number, got ${JSON.stringify(value).slice(0, 60)}`,
  );
}

const NAMED_WEIGHTS = { bold: '700', normal: '400' };

/**
 * A numeric weight as one native draws. Fabric takes the nine hundreds and no other number, and
 * reads anything else - `550`, `1000` - as the regular weight, with only a native log line to say
 * so. The nearest hundred is also where CSS's own font matching lands for a family without that
 * exact weight.
 */
const nearestWeight = (value) =>
  String(Math.min(900, Math.max(100, Math.round(value / 100) * 100)));

/**
 * A font weight, as the string React Native's `fontWeight` takes. Its own form rather than a
 * number, because `bold` and `normal` are weights too and a number cannot hold them.
 */
function weight(value) {
  const inner = typeof value === 'object' && value !== null ? value.value : value;
  if (typeof inner === 'number')
    return inner >= 1 && inner <= 1000 ? nearestWeight(inner) : undefined;
  const ident = typeof inner === 'object' && inner !== null ? inner.value : inner;
  return NAMED_WEIGHTS[ident];
}

/**
 * A custom property's value, pre-converted into every form a use site might ask for.
 *
 * The definition does not know how it will be used, and the device has no CSS parser, so the
 * conversion has to happen here and cover every case. Forms that do not apply are simply absent,
 * and a use site asking for one of those falls back exactly as an undefined token would.
 */
function tokenValue(parts, context) {
  if (!Array.isArray(parts)) return null;
  if (parts.length !== 1) return listValue(parts);
  const part = parts[0];

  if (part?.type === 'var') return aliasValue(part, context);

  const out = {};

  const attempt = (kind, fn) => {
    try {
      const value = fn();
      if (value !== undefined) out[kind] = value;
    } catch {
      // Not expressible in this form, which is not an error until something asks for it.
    }
  };

  attempt('length', () => length(part.value ?? part, context));
  attempt('color', () => color(part.value ?? part, context));
  attempt('keyword', () => keyword(part.value ?? part, context));
  // Not a length or a time: `13px` read as 13 scaled a box thirteen times, where a browser drops
  // the declaration.
  if (!hasUnit(part)) attempt('number', () => number(part.value ?? part, context));
  attempt('weight', () => weight(part.value ?? part));
  Object.assign(out, unitForms(part));
  if (part.value?.type === 'number') Object.assign(out, bareNumber(part.value.value));
  const filter = functionForm(part, 'filter', FILTER_FUNCTIONS) ?? dropShadowWithTokens(part);
  if (filter !== undefined) out.filter = filter;
  const transform = functionForm(part, 'transform', TRANSFORM_FUNCTIONS);
  if (transform !== undefined) out.transform = transform;
  Object.assign(out, variantForm(out.keyword));

  return Object.keys(out).length ? out : null;
}

/**
 * A font variant, as the one-entry list `fontVariant` takes: a slot of Tailwind's numeric ones.
 * Required here rather than at the top: properties.cjs requires this module.
 */
const variantForm = (word) =>
  require('./properties.cjs').FONT_VARIANTS.has(word) ? { fontVariant: [word] } : {};

/**
 * Whether a token is a length or a time, which are not numbers. An angle keeps its number: a hue
 * is written `221deg` and read as the number of degrees by an `hsl()` of tokens.
 */
function hasUnit(part) {
  if (['length', 'time', 'resolution'].includes(part?.type)) return true;
  const inner = part?.value;
  return (
    inner?.type === 'dimension' || (typeof inner === 'object' && inner !== null && 'unit' in inner)
  );
}

/**
 * The forms a time or an angle has, in the one unit the engine counts each in: milliseconds, as
 * an animation's delay and duration are timed, and degrees, so a quarter turn is a rotation of 90.
 */
function unitForms(part) {
  if (part.type === 'time') {
    return { time: round(part.value.value * (part.value.type === 'seconds' ? 1000 : 1)) };
  }
  if (part.type === 'angle' && part.value?.type in PER_TURN) {
    return { angle: round(part.value.value * PER_TURN[part.value.type]) };
  }
  return {};
}

/**
 * Another token by name: kept as a reference and resolved on device, where the cascade decides
 * which definition of it is in scope. A palette token renamed for its purpose is how a design
 * system is written, and dark mode redefines exactly these.
 */
function aliasValue(part, context) {
  const alias = part.value?.name?.ident;
  if (!alias) return null;
  const fallback = part.value?.fallback ? tokenValue(part.value.fallback, context) : null;
  return fallback ? { alias, fallback } : { alias };
}

/**
 * The forms a bare number has beyond being one. It is a multiple of the font size when it is a
 * line-height, which is how every design system writes one, settled where it is used because
 * that is where the font size is known. And CSS takes a bare 0 wherever it takes a length, which
 * is how design systems write their zero tokens: `--bs-gutter-y: 0`.
 */
function bareNumber(value) {
  return {
    lineHeight: { __defer: { unit: 'em', factor: round(value) } },
    ...(value === 0 ? { length: 0 } : {}),
  };
}

/**
 * What a form a token lacks can be read from instead. A length is already a line-height, and a
 * single word is already a family, so neither is stored twice in every token that is one.
 */
const STAND_IN = { lineHeight: 'length', family: 'keyword' };

/** A token's value in one form, allowing for the forms another stands in for. */
function formOf(token, kind) {
  return token?.[kind] ?? token?.[STAND_IN[kind]];
}

/**
 * A token written as more than one token: a font stack, or a ratio. Anything else of several
 * parts is a shorthand's worth of values, which no single native property can take.
 */
function listValue(parts) {
  const values = parts.map((part) => part?.value).filter((value) => value?.type !== 'white-space');
  const ratio = ratioOf(values);
  if (ratio !== null) return { number: ratio };
  const channels = channelsOf(values);
  if (channels !== null) return { channels };
  const family = firstFamily(parts);
  if (family !== null) return { family };
  const filter = filterListForm(parts);
  if (filter !== undefined) return { filter };
  const shadow = shadowForm(parts) ?? shadowWithTokens(parts);
  return shadow === undefined ? null : { shadow };
}

/**
 * A slot holding several filter functions, as Tailwind 3's `drop-shadow` puts two `drop-shadow()`s
 * in `--tw-drop-shadow`: the list `filter` takes, spliced whole where the slot is read.
 */
function filterListForm(parts) {
  const functions = parts.filter((part) => part?.value?.type !== 'white-space');
  if (functions.length < 2) return undefined;
  if (
    !functions.every((part) => part?.type === 'function' && FILTER_FUNCTIONS.has(part.value?.name))
  ) {
    return undefined;
  }
  const text = cssText(functions);
  if (text === null) return undefined;
  let parsed;
  try {
    require('lightningcss').transform({
      filename: 'token.css',
      code: Buffer.from(`a{filter:${text}}`),
      visitor: {
        Declaration(declaration) {
          if (declaration.property === 'filter') parsed = declaration.value;
        },
      },
    });
    if (!parsed) return undefined;
    const out = {};
    require('./properties.cjs').translate('filter', parsed, out);
    return out.filter;
  } catch {
    return undefined;
  }
}

/**
 * A shadow token with another token for its colour, `0 0 0 2px var(--tw-ring-color, ...)`, as
 * the list `box-shadow` would defer: each colour a marker the device fills in where the token is
 * used, from the tokens in scope there. What `ring-2` beside `ring-blue-500` is.
 */
function shadowWithTokens(parts) {
  try {
    // Required here rather than at the top: colour-expression.cjs requires this module.
    return require('./colour-expression.cjs').shadowsWithColourTokens(parts, 'token');
  } catch {
    return undefined;
  }
}

/**
 * A `drop-shadow()` token with another token for its colour,
 * `drop-shadow(0 4px 4px var(--tw-drop-shadow-color, ...))`, as the one-entry filter list it
 * stands for, its colour settled on device as `shadowWithTokens` settles a shadow's. What
 * `drop-shadow-lg` beside `drop-shadow-red-500` is.
 */
function dropShadowWithTokens(part) {
  if (part?.type !== 'function' || part.value?.name !== 'drop-shadow') return undefined;
  try {
    const [shadow, ...more] = require('./colour-expression.cjs').shadowsWithColourTokens(
      part.value.arguments,
      'token',
    );
    // A drop shadow has no spread and is never inset.
    if (more.length || shadow.spreadDistance !== 0 || shadow.inset !== false) return undefined;
    const { offsetX, offsetY, blurRadius, color } = shadow;
    return [{ dropShadow: { offsetX, offsetY, standardDeviation: blurRadius, color } }];
  } catch {
    return undefined;
  }
}

const isNumber = (value) => value?.type === 'number';

/** `16 / 9`, as the one number aspect-ratio takes. */
function ratioOf(values) {
  const [a, slash, b, ...rest] = values;
  if (rest.length || slash?.type !== 'delim' || slash.value !== '/') return null;
  return isNumber(a) && isNumber(b) && b.value ? round(a.value / b.value) : null;
}

/**
 * Bare colour channels, `13, 110, 253`: how Bootstrap stores every colour so that an opacity token
 * can be put beside it with `rgba(var(--bs-primary-rgb), var(--bs-bg-opacity))`.
 */
function channelsOf(values) {
  const numbers = values.filter((value) => value?.type !== 'comma');
  if (numbers.length !== 3 || values.length !== 5 || !numbers.every(isNumber)) return null;
  return numbers.map((value) => round(value.value));
}

/**
 * A token holding a whole shadow list, as `box-shadow` would compile it:
 * `--bs-box-shadow-sm: 0 .125rem .25rem rgba(0, 0, 0, .075)`.
 *
 * The value is written back out as CSS and parsed once more as a `box-shadow`, which is the only
 * honest way to read it: the parser already knows every order the parts of a shadow come in. A
 * token with a `var()` inside cannot be read this way, and has no shadow form.
 */
function shadowForm(parts) {
  const text = cssText(parts);
  if (text === null) return undefined;
  let parsed;
  try {
    require('lightningcss').transform({
      filename: 'token.css',
      code: Buffer.from(`a{box-shadow:${text}}`),
      visitor: {
        Declaration(declaration) {
          if (declaration.property === 'box-shadow') parsed = declaration.value;
        },
      },
    });
    if (!parsed) return undefined;
    // Required here rather than at the top: properties.cjs requires this module.
    const out = {};
    require('./properties.cjs').translate('box-shadow', parsed, out);
    return out.boxShadow;
  } catch {
    return undefined;
  }
}

/** The filter functions, which a token can hold one of: Tailwind gives each its own slot. */
const FILTER_FUNCTIONS = new Set([
  'blur',
  'brightness',
  'contrast',
  'drop-shadow',
  'grayscale',
  'hue-rotate',
  'invert',
  'opacity',
  'saturate',
  'sepia',
]);

/** The transform functions Tailwind gives a slot of their own: its 3D rotations and skews. */
const TRANSFORM_FUNCTIONS = new Set(['rotateX', 'rotateY', 'rotateZ', 'skewX', 'skewY']);

/**
 * A token holding one function of a list property, as that property would compile it:
 * `--tw-grayscale: grayscale(100%)` as a `filter`, `--tw-rotate-x: rotateX(12deg)` as a
 * `transform`. Parsed as the property for the same reason `shadowForm` parses a shadow.
 */
function functionForm(part, property, names) {
  if (part?.type !== 'function' || !names.has(part.value?.name)) return undefined;
  const text = cssText([part]);
  if (text === null) return undefined;
  let parsed;
  try {
    require('lightningcss').transform({
      filename: 'token.css',
      code: Buffer.from(`a{${property}:${text}}`),
      visitor: {
        Declaration(declaration) {
          if (declaration.property === property) parsed = declaration.value;
        },
      },
    });
    if (!parsed) return undefined;
    const out = {};
    require('./properties.cjs').translate(property, parsed, out);
    return out[property === 'filter' ? 'filter' : 'transform'];
  } catch {
    return undefined;
  }
}

/** A raw token list as CSS text again, or null if it holds anything this cannot write back. */
function cssText(parts) {
  let text = '';
  for (const part of parts) {
    const piece = partText(part);
    if (piece === null) return null;
    text += piece;
  }
  return text;
}

// eslint-disable-next-line complexity -- one flat case per token shape
function partText(part) {
  const value = part?.value;
  if (part?.type === 'length') return `${value.value}${value.unit}`;
  if (part?.type === 'angle') return `${value.value}${value.type}`;
  if (part?.type === 'function') {
    const inner = cssText(value.arguments ?? []);
    return inner === null ? null : `${value.name}(${inner})`;
  }
  if (part?.type === 'color') {
    try {
      return color(value, 'token');
    } catch {
      return null;
    }
  }
  if (part?.type !== 'token') return null;
  switch (value?.type) {
    case 'white-space':
      return ' ';
    case 'comma':
      return ',';
    case 'number':
      return String(value.value);
    case 'percentage':
      return `${value.value * 100}%`;
    case 'ident':
    case 'delim':
      return value.value;
    default:
      return null;
  }
}

/**
 * The first family of a stack, as `font-family` takes it. A family can be quoted, or be several
 * bare words that mean one name (`Segoe UI`), so it runs to the first comma.
 */
function firstFamily(parts) {
  const words = [];
  for (const part of parts) {
    const type = part?.type === 'token' ? part.value?.type : null;
    if (type === 'comma') break;
    if (type === 'white-space') continue;
    if (!WORDS.has(type)) return null;
    words.push(part.value.value);
  }
  return words.length ? words.join(' ') : null;
}

/** The tokens a family name is made of. */
const WORDS = new Set(['ident', 'string']);

/**
 * A `var()`'s fallback, as the fields of the deferred declaration it belongs to.
 *
 * A fallback can itself be a `var()`, with a fallback of its own: `var(--a, var(--b, green))`.
 * Those tokens are looked up on device, in turn, so they are listed as `alternatives`, and what is
 * left at the end of the chain is the written `fallback`, in the form the use site needs.
 */
function fallbacks(varPart, kind, context) {
  const raw = varPart.value?.fallback;
  let converted = raw ? tokenValue(raw, `${context} (fallback)`) : null;
  const alternatives = [];
  while (converted?.alias) {
    alternatives.push(converted.alias);
    converted = converted.fallback;
  }
  const fallback = formOf(converted, kind);
  return {
    ...(alternatives.length ? { alternatives } : {}),
    ...(fallback === undefined ? {} : { fallback }),
  };
}

module.exports = {
  CssUnsupported,
  fallbacks,
  camel,
  round,
  length,
  color,
  keyword,
  angle,
  number,
  tokenValue,
  formOf,
  nearestWeight,
  REM,
};
