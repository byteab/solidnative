/**
 * `filter` and the background sizing properties, in the shapes Fabric reads.
 *
 * Both are lists of records rather than strings, and both leave the whole property alone if any
 * part of it is malformed - which is web behaviour, and is why a value that cannot be expressed
 * is refused here rather than half-translated.
 */
const { CssUnsupported, color, length, number, round } = require('./values.cjs');

/** Degrees per unit, for the one filter that takes an angle. */
const DEGREES = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

/** CSS name -> the key native looks the primitive up by. Everything else it has no name for. */
const PRIMITIVES = {
  blur: 'blur',
  brightness: 'brightness',
  contrast: 'contrast',
  grayscale: 'grayscale',
  'hue-rotate': 'hueRotate',
  invert: 'invert',
  opacity: 'opacity',
  saturate: 'saturate',
  sepia: 'sepia',
  'drop-shadow': 'dropShadow',
};

/**
 * The filters iOS draws, by native key. React Native 0.86 draws brightness() and opacity() there;
 * the others are behind `enableSwiftUIBasedFilters`, a feature flag that is off, so they are
 * accepted and leave the view unchanged. Android draws all ten.
 */
const DRAWN_ON_IOS = new Set(['brightness', 'opacity']);

/** The CSS name of each native key, for a message that names what was written. */
const CSS_NAMES = Object.fromEntries(Object.entries(PRIMITIVES).map(([css, key]) => [key, css]));

/**
 * The first function in a compiled filter list that iOS does not draw, as CSS names it, or null.
 * A list whose lengths are settled on device is the same list with markers in it, and reads the
 * same way.
 */
function undrawnOnIos(list) {
  if (!Array.isArray(list)) return null;
  for (const primitive of list) {
    const key = Object.keys(primitive ?? {})[0];
    // A slot filled from a token on device, whose token was checked where it was set.
    if (key === '__filters') continue;
    if (key && !DRAWN_ON_IOS.has(key)) return CSS_NAMES[key] ?? key;
  }
  return null;
}

/** `filter`, as the list of one-key records native takes. Order matters: filters compose. */
function filter(value, context) {
  if (value?.type !== 'filters') {
    throw new CssUnsupported(
      `${context}: only a list of filter functions is supported; '${value?.type}' is not one.`,
    );
  }
  return value.value.map((primitive) => {
    const name = PRIMITIVES[primitive.type];
    if (!name) {
      throw new CssUnsupported(`${context}: native has no '${primitive.type}()' filter.`);
    }
    return { [name]: primitiveValue(name, primitive.value, context) };
  });
}

function primitiveValue(name, value, context) {
  if (name === 'dropShadow') return dropShadow(value, context);
  if (name === 'hueRotate') return degrees(value, context);
  if (name === 'blur') return length(value, context);
  // A percentage means the fraction it is: `brightness(50%)` and `brightness(0.5)` are one value.
  if (value?.type === 'percentage') return round(value.value);
  return number(value, context);
}

function degrees(value, context) {
  const unit = value?.type;
  if (unit && unit in DEGREES) return round(value.value * DEGREES[unit]);
  // `0` alone is a legal angle and the only unitless one.
  if (unit === 'number' && value.value === 0) return 0;
  throw new CssUnsupported(`${context}: expected an angle for hue-rotate()`);
}

/**
 * `drop-shadow()`, whose parameters native names differently from CSS.
 *
 * The blur radius is a standard deviation here, which is half of what CSS calls the blur radius
 * on the web - but it is what RN's own JS passes through unchanged, so the two agree.
 */
function dropShadow(value, context) {
  return {
    offsetX: length(value.xOffset, context),
    offsetY: length(value.yOffset, context),
    ...(value.blur ? { standardDeviation: length(value.blur, context) } : {}),
    ...(value.color ? { color: color(value.color, context) } : {}),
  };
}

/** `background-size`: a keyword, or an explicit pair where either axis may be `auto`. */
function backgroundSize(value, context) {
  return value.map((size) => {
    if (size.type === 'cover' || size.type === 'contain') return size.type;
    return { x: axisSize(size.width, context), y: axisSize(size.height, context) };
  });
}

const axisSize = (value, context) => (value?.type === 'auto' ? 'auto' : length(value, context));

/** `background-repeat`: one keyword per axis, which is how native stores it. */
function backgroundRepeat(value, context) {
  return value.map(({ x, y }) => ({ x: repeatWord(x, context), y: repeatWord(y, context) }));
}

const REPEATS = new Set(['repeat', 'space', 'round', 'no-repeat']);
function repeatWord(word, context) {
  if (!REPEATS.has(word)) {
    throw new CssUnsupported(`${context}: '${word}' is not a repetition native understands.`);
  }
  return word;
}

/**
 * `background-position`, as the pair of edges native measures from.
 *
 * `right 10px` is ten points from the right, not `calc(100% - 10px)` from the left, and native
 * reads whichever pair of keys it finds - so which edge the author named has to be kept.
 */
function backgroundPosition(value, context) {
  return value.map((position) => ({
    ...edge(position.x, 'left', 'right', context),
    ...edge(position.y, 'top', 'bottom', context),
  }));
}

function edge(value, start, end, context) {
  if (value?.type === 'center') return { [start]: '50%' };
  if (value?.type === 'length') return { [start]: length(value.value, context) };
  if (value?.type === 'side') {
    const from = value.side === end ? end : start;
    return { [from]: value.offset ? length(value.offset, context) : 0 };
  }
  return { [start]: '50%' };
}

module.exports = { filter, undrawnOnIos, backgroundSize, backgroundRepeat, backgroundPosition };
