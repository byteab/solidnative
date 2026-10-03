/**
 * CSS gradients, turned into the structure Fabric's C++ reads.
 *
 * Two things make this a build step rather than a runtime one. Fabric only parses a CSS gradient
 * string when `enableNativeCSSParsing` is on, which it is not by default, so what it actually
 * takes is a processed structure - direction as an angle or a keyword, each stop a colour and a
 * position. And React Native's own JS reaches that structure with a stack of regexes, run on
 * every render. There is a real CSS parser here at build time, so neither is needed.
 *
 * The prop is `experimental_backgroundImage`. The name is React Native's warning about its
 * stability, not ours, and it is the name Fabric's props parser matches on.
 */
const { CssUnsupported, color, length, round } = require('./values.cjs');
const { colourExpression } = require('./colour-expression.cjs');

/** A CSS angle in degrees, which is the only form the gradient direction takes. */
const DEGREES = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

/**
 * `background-image`, as a list of layers.
 *
 * Every layer must be a gradient: there is no image loader behind this prop, so a `url()` is a
 * silent blank box rather than a picture, which is the failure this compiler exists to prevent.
 */
function backgroundImage(value, context) {
  const layers = Array.isArray(value) ? value : [value];
  return layers.map((layer) => gradient(layer, context));
}

function gradient(layer, context) {
  if (layer?.type !== 'gradient') {
    const what = layer?.type === 'url' ? 'a url()' : `'${layer?.type}'`;
    throw new CssUnsupported(
      `${context}: ${what} is not something native can paint as a background. Only ` +
        `linear-gradient() and radial-gradient() are, and an image belongs in an <image>.`,
    );
  }

  const value = layer.value;
  if (value.type === 'linear') return linear(value, context);
  if (value.type === 'radial') return radial(value, context);
  throw new CssUnsupported(
    `${context}: a ${value.type}-gradient has no native equivalent; native paints linear and ` +
      `radial gradients only.`,
  );
}

function linear(value, context) {
  return {
    type: 'linear-gradient',
    direction: direction(value.direction, context),
    colorStops: colorStops(value.items, context),
  };
}

/**
 * Which way the gradient runs.
 *
 * CSS says `to right` and `45deg`; native takes either, one as a keyword and one as a number of
 * degrees. The default is `to bottom`, which native spells as 180 degrees.
 */
/**
 * The four straight edges, as the angles React Native turns them into.
 *
 * Only the corners survive as keywords. `processBackgroundImage`'s `getDirectionForKeyword` maps
 * `to top` to 0, `to right` to 90, `to bottom` to 180 and `to left` to 270, and native's parser
 * knows the four corner keywords and nothing else - so a `{type: 'keyword', value: 'to right'}`
 * is not an unusual spelling of the same thing, it is a value the parser rejects. It refuses the
 * whole gradient and paints nothing, with no error anywhere.
 */
const EDGE_ANGLES = { top: 0, right: 90, bottom: 180, left: 270 };
const VERTICAL = new Set(['top', 'bottom']);

/**
 * A `to ...` phrase, as the one shape native reads for it.
 *
 * Corners are named vertical first whichever order they were written in, because that is how
 * native's four keywords are spelt. Anything else is a direction this cannot express, and saying
 * so is better than emitting a value that is quietly refused.
 */
function towards(sides, context) {
  if (sides.length === 1) {
    const angle = EDGE_ANGLES[sides[0]];
    if (angle !== undefined) return { type: 'angle', value: angle };
  }
  if (sides.length === 2) {
    const vertical = sides.find((side) => VERTICAL.has(side));
    const horizontal = sides.find((side) => !VERTICAL.has(side));
    if (vertical && horizontal && EDGE_ANGLES[horizontal] !== undefined) {
      return { type: 'keyword', value: `to ${vertical} ${horizontal}` };
    }
  }
  throw new CssUnsupported(
    `${context}: 'to ${sides.join(' ')}' is not a gradient direction; write a side, a corner ` +
      `or an angle.`,
  );
}

function direction(value, context) {
  switch (value?.type) {
    case 'angle':
      return { type: 'angle', value: degrees(value.value, context) };
    case 'horizontal':
    case 'vertical':
      return towards([value.value], context);
    case 'corner':
      return towards([value.vertical, value.horizontal], context);
    default:
      return { type: 'angle', value: 180 };
  }
}

function degrees(value, context) {
  const unit = value?.type;
  if (typeof value === 'number') return round(value);
  if (unit && unit in DEGREES) return round(value.value * DEGREES[unit]);
  throw new CssUnsupported(`${context}: expected an angle for the gradient direction`);
}

/**
 * The stops, in the order they are painted.
 *
 * A stop with two positions - `red 0 50%`, a hard band - is written out as the two stops CSS says
 * it means, because native has room for one position per stop. A transition hint (a bare position
 * between two colours) has no native equivalent and is refused rather than silently straightened.
 */
function colorStops(items, context) {
  const stops = [];
  for (const item of items ?? []) {
    if (item.type !== 'color-stop') {
      throw new CssUnsupported(
        `${context}: a gradient transition hint has no native equivalent; give the stop a ` +
          `colour, or move the position onto the stops either side.`,
      );
    }
    const paint = color(item.color, context);
    const positions = [item.position, item.positionTo].filter((one) => one != null);
    // `position` is written even when there is none. Fabric looks the key up before it looks at
    // the value and skips a stop that has not got one, so a gradient written without positions
    // would lose every stop and paint nothing at all.
    if (!positions.length) stops.push({ color: paint, position: null });
    else {
      for (const position of positions) {
        stops.push({ color: paint, position: stop(position, context) });
      }
    }
  }
  return stops;
}

/** A position along the gradient: a percentage as a string, anything else in points. */
function stop(value, context) {
  if (value?.type === 'percentage') return percentage(value.value);
  return length(value, context);
}

const percentage = (fraction) => `${round(fraction * 100)}%`;

/**
 * A radial gradient.
 *
 * `size` is always written, even when it is the default: Fabric only looks for `position` inside
 * the branch that found a `size`, so a gradient that omits it is a gradient painted from the
 * centre whatever the author asked for.
 */
function radial(value, context) {
  const shape = value.shape ?? {};
  return {
    type: 'radial-gradient',
    shape: shape.type === 'circle' ? 'circle' : 'ellipse',
    size: extent(shape.value, context),
    position: position(value.position, context),
    colorStops: colorStops(value.items, context),
  };
}

/** How far the gradient reaches: one of CSS's four keywords, or an explicit pair of radii. */
function extent(value, context) {
  if (value?.type === 'extent') return value.value;
  if (value?.type === 'length')
    return { x: stop(value.value, context), y: stop(value.value, context) };
  if (value?.type === 'size') {
    return { x: stop(value.x, context), y: stop(value.y, context) };
  }
  return 'farthest-corner';
}

/**
 * Where the gradient is centred, as the pair of edges native measures from.
 *
 * Native reads `top`/`bottom` and `left`/`right`, taking whichever is present, so `at right
 * bottom` has to arrive as a distance from the right and the bottom rather than as a converted
 * distance from the top left.
 */
function position(value, context) {
  const { edge: firstEdge, offset: x } = edge(value?.x, 'left', 'right', context);
  const { edge: secondEdge, offset: y } = edge(value?.y, 'top', 'bottom', context);
  return { [firstEdge]: x, [secondEdge]: y };
}

function edge(value, start, end, context) {
  switch (value?.type) {
    case 'center':
      return { edge: start, offset: '50%' };
    case 'length':
      return { edge: start, offset: stop(value.value, context) };
    case 'side':
      return {
        edge: value.side === end ? end : start,
        offset: value.offset ? stop(value.offset, context) : 0,
      };
    default:
      return { edge: start, offset: '50%' };
  }
}

/** The gradient functions that reach this file, whether parsed or left as a token stream. */
const GRADIENTS = new Set(['linear-gradient', 'radial-gradient']);

/**
 * A gradient whose stops are custom properties, kept as a template and filled in at match time.
 *
 * A `var()` anywhere in a value makes lightningcss hand back the raw token stream instead of a
 * parsed gradient, so this reads the stream directly - which is the honest place to do it, a
 * build step with the whole declaration in front of it rather than a device with none of it.
 *
 * It exists because that is how a utility framework writes a gradient: the class that says which
 * way it runs, the class that gives the first colour and the class that gives the last are three
 * different classes, and only the cascade knows which of them a node is wearing. The stops are
 * therefore references, and a stop whose reference resolves to nothing is dropped - which is what
 * makes an optional middle colour optional.
 */
function deferGradient(part, context) {
  const name = part.value?.name;
  const args = split(meaningful(part.value?.arguments), 'comma');
  const prelude = isPrelude(args[0]) ? args.shift() : [];

  const template =
    name === 'linear-gradient'
      ? { type: 'linear-gradient', direction: preludeDirection(prelude, context) }
      : radialPrelude(prelude, context);

  const colorStops = args.map((stop) => deferredStop(stop, context));
  if (colorStops.length < 2) {
    throw new CssUnsupported(`${context}: a gradient needs at least two colour stops`);
  }

  return { props: ['experimental_backgroundImage'], gradient: { ...template, colorStops } };
}

/**
 * Whether the gradient's first comma group says which way it runs, rather than being a stop: an
 * angle, `to <side>`, or a radial gradient's shape, size or `at`.
 */
function isPrelude(terms) {
  const first = terms?.[0];
  // An angle is a direction; a lone length or percentage first is a radial gradient's radius.
  if (PRELUDE_TYPES.has(first?.type)) return true;
  const token = first?.type === 'token' ? first.value : null;
  if (PRELUDE_TYPES.has(token?.type)) return true;
  return token?.type === 'ident' && PRELUDE_WORDS.has(token.value);
}

const PRELUDE_TYPES = new Set(['angle', 'length', 'dimension', 'percentage']);

const PRELUDE_WORDS = new Set([
  'to',
  'at',
  'circle',
  'ellipse',
  'closest-side',
  'closest-corner',
  'farthest-side',
  'farthest-corner',
]);

/**
 * One stop: a colour and optionally a position that is a value or a `var()`. A colour that is a
 * `var()` on its own is a reference the cascade fills in, and dropped when it is undefined, which
 * is what makes an optional middle colour optional; any other colour - a literal, or a
 * `color-mix()` with a token in it - is an expression the device works out.
 */
function deferredStop(terms, context) {
  if (terms.length > 2) {
    throw new CssUnsupported(
      `${context}: a stop can carry one position here; native has room for one per stop.`,
    );
  }
  const [colour, position] = terms;
  // A bare token is the cheap reference; one with a fallback is a colour expression, which keeps it.
  if (colour?.type === 'var' && !colour.value?.fallback) {
    return { reference: colour.value?.name?.ident, ...deferredPosition(position, context) };
  }
  return { colour: colourExpression([colour], context), ...deferredPosition(position, context) };
}

/**
 * A stop's position: written out, deferred to a variable, or absent.
 *
 * A deferred one keeps its fallback as the literal position, which is what a variable with a
 * declared initial value means and what a sheet that never sets it should paint.
 */
function deferredPosition(term, context) {
  if (!term) return {};
  if (term.type !== 'var') return { position: stop(tokenLength(term, context), context) };

  const fallback = meaningful(term.value?.fallback);
  return {
    positionReference: term.value?.name?.ident,
    ...(fallback.length === 1
      ? { position: stop(tokenLength(fallback[0], context), context) }
      : {}),
  };
}

/** A length or percentage as it appears in a raw token stream rather than a parsed value. */
function tokenLength(term, context) {
  if (term?.type === 'length' || term?.type === 'percentage') return term.value;
  const token = term?.type === 'token' ? term.value : null;
  switch (token?.type) {
    case 'percentage':
      return { type: 'percentage', value: token.value };
    case 'dimension':
      return token;
    case 'number':
      if (token.value === 0) return 0;
      break;
    default:
      break;
  }
  throw new CssUnsupported(`${context}: expected a position for a gradient stop`);
}

/** `to right`, `to bottom left` or an angle, read from the tokens before the first stop. */
function preludeDirection(terms, context) {
  if (!terms.length) return { type: 'angle', value: 180 };

  const words = terms.map((term) => ident(term)).filter((word) => word !== null);
  if (words.length && words[0] === 'to') return towards(words.slice(1), context);

  const [only] = terms;
  if (only?.type === 'angle') return { type: 'angle', value: degrees(only.value, context) };
  if (only?.type === 'token' && only.value?.type === 'dimension') {
    return { type: 'angle', value: degrees(only.value, context) };
  }
  throw new CssUnsupported(
    `${context}: '${words.join(' ')}' is not a gradient direction this understands; write a ` +
      `side, a corner or an angle.`,
  );
}

/**
 * A radial gradient's prelude, which here may only be empty.
 *
 * A shape, an extent or a centre would each have to be parsed out of a raw token stream, and the
 * combinations are most of the radial-gradient grammar. A gradient that wants one can write its
 * stops out rather than deferring them.
 */
function radialPrelude(terms, context) {
  const at = terms.findIndex((term) => ident(term) === 'at');
  const before = at === -1 ? terms : terms.slice(0, at);
  const after = at === -1 ? [] : terms.slice(at + 1);
  let shape = 'ellipse';
  let size = 'farthest-corner';
  for (const term of before) {
    const word = ident(term);
    if (word === 'circle' || word === 'ellipse') shape = word;
    else if (EXTENTS.has(word)) size = word;
    else {
      throw new CssUnsupported(
        `${context}: a radial-gradient with var() stops takes its shape and size as keywords ` +
          `here; an explicit radius needs its stops written out.`,
      );
    }
  }
  return { type: 'radial-gradient', shape, size, position: tokenPosition(after, context) };
}

const EXTENTS = new Set(['closest-side', 'closest-corner', 'farthest-side', 'farthest-corner']);

/**
 * `at <x> <y>` from tokens, as the pair of edges native measures from: a keyword, a percentage or
 * a length for each axis, one of them alone meaning the other is centred, as CSS says.
 */
function tokenPosition(terms, context) {
  if (terms.length > 2) {
    throw new CssUnsupported(
      `${context}: a radial-gradient's position takes one or two values here, not ${terms.length}`,
    );
  }
  const vertical = (term) => ['top', 'bottom'].includes(ident(term));
  const [first, second] =
    terms.length === 2 && vertical(terms[0]) && !vertical(terms[1])
      ? [terms[1], terms[0]]
      : terms.length === 1 && vertical(terms[0])
        ? [undefined, terms[0]]
        : terms;
  const x = axis(first, 'left', 'right', context);
  const y = axis(second, 'top', 'bottom', context);
  return { [x.edge]: x.offset, [y.edge]: y.offset };
}

function axis(term, start, end, context) {
  const word = ident(term);
  if (!term || word === 'center') return { edge: start, offset: '50%' };
  if (word === start) return { edge: start, offset: 0 };
  if (word === end) return { edge: end, offset: 0 };
  if (term.type === 'var') return { edge: start, offset: positionToken(term, context) };
  return { edge: start, offset: stop(tokenLength(term, context), context) };
}

/** A position that is a token, read on device, with the one written after its name if unset. */
function positionToken(term, context) {
  const [fallback, ...rest] = meaningful(term.value?.fallback);
  if (rest.length) throw new CssUnsupported(`${context}: a position's fallback is one value`);
  return {
    reference: term.value.name.ident,
    ...(fallback ? { fallback: stop(tokenLength(fallback, context), context) } : {}),
  };
}

const ident = (term) =>
  term?.type === 'token' && term.value?.type === 'ident' ? term.value.value : null;

/** Whitespace separates nothing in an argument list, and is dropped before anything is read. */
const meaningful = (terms) =>
  (terms ?? []).filter((term) => !(term.type === 'token' && term.value?.type === 'white-space'));

/** Split an argument list on commas, which is where one stop ends and the next begins. */
function split(terms, on) {
  const parts = [[]];
  for (const term of terms) {
    if (term.type === 'token' && term.value?.type === on) parts.push([]);
    else parts[parts.length - 1].push(term);
  }
  return parts;
}

module.exports = { backgroundImage, deferGradient, GRADIENTS };
