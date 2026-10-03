/**
 * Arithmetic with tokens in it, carried to the device as a tree: a `calc()` with more than one
 * `var()`, and the transforms Tailwind writes with a token in every slot, `translate:
 * var(--tw-translate-x) var(--tw-translate-y)`.
 *
 * The device has no CSS parser, so what is left for it is a tree of numbers, operators and
 * token references, each leaf read in the form its slot wants: a length in points, an angle in
 * degrees, or a number. A single `var()` with arithmetic around it that is linear in it keeps
 * its cheaper path (`linear` in `compile.cjs`); this is for everything past that.
 */
const { CssUnsupported, fallbacks, length, round } = require('./values.cjs');

const PER_TURN = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

const isSpace = (term) => term?.type === 'token' && term.value?.type === 'white-space';
const meaningful = (terms) => (terms ?? []).filter((term) => !isSpace(term));
const operatorOf = (term) =>
  term?.type === 'token' && term.value?.type === 'delim' ? term.value.value : undefined;

/** Whether a term, or anything inside it, is a `var()`. */
function mentionsVar(term) {
  if (term?.type === 'var') return true;
  return (term?.value?.arguments ?? []).some(mentionsVar);
}

/**
 * One slot's value as a tree: a number, `{ reference, fallback? }`, or `[op, a, b]`. `kind` is
 * what the slot is - `length`, `angle`, `time` or `number` - which is the form a token is read in.
 */
function tree(term, kind, context) {
  if (term?.type === 'var') return leaf(term, kind, context);
  if (term?.type === 'function' && term.value?.name === 'calc') {
    const terms = meaningful(term.value.arguments);
    const parsed = sum(terms, 0, kind, context);
    if (parsed.next !== terms.length) throw unreadable(context, 'is not arithmetic');
    return parsed.value;
  }
  return literal(term, kind, context);
}

function leaf(term, kind, context) {
  const { fallback, alternatives } = fallbacks(term, kind, context);
  if (alternatives) throw unreadable(context, 'has a var() falling back to another var()');
  return {
    reference: term.value.name.ident,
    ...(typeof fallback === 'number' ? { fallback } : {}),
  };
}

/** A written number, length or angle, as the number its slot counts in. */
function literal(term, kind, context) {
  const value =
    numberOf(term) ?? degreesOf(term) ?? millisecondsOf(term) ?? pointsOf(term, context);
  if (value !== undefined) return value;
  const what = term?.value?.unit ?? term?.value?.type ?? term?.type;
  throw unreadable(context, `cannot take '${what}' here`);
}

const numberOf = (term) =>
  term?.type === 'token' && term.value?.type === 'number' ? round(term.value.value) : undefined;

const degreesOf = (term) =>
  term?.type === 'angle' && PER_TURN[term.value?.type]
    ? round(term.value.value * PER_TURN[term.value.type])
    : undefined;

const millisecondsOf = (term) =>
  term?.type === 'time'
    ? round(term.value.value * (term.value.type === 'seconds' ? 1000 : 1))
    : undefined;

function pointsOf(term, context) {
  if (term?.type !== 'length') return undefined;
  const points = length(term.value, context);
  return typeof points === 'number' ? points : undefined;
}

const unreadable = (context, why) =>
  new CssUnsupported(
    `${context}: arithmetic with tokens in it ${why}. What the device works out is numbers, ` +
      `points, degrees and var(), with + - * / and brackets; a percentage, an em or a viewport ` +
      `unit beside a token needs layout the device does not do here.`,
  );

function sum(terms, start, kind, context) {
  let { value, next } = product(terms, start, kind, context);
  while (operatorOf(terms[next]) === '+' || operatorOf(terms[next]) === '-') {
    const op = operatorOf(terms[next]);
    const right = product(terms, next + 1, kind, context);
    value = [op, value, right.value];
    next = right.next;
  }
  return { value, next };
}

function product(terms, start, kind, context) {
  let { value, next } = factor(terms, start, kind, context);
  while (operatorOf(terms[next]) === '*' || operatorOf(terms[next]) === '/') {
    const op = operatorOf(terms[next]);
    const right = factor(terms, next + 1, kind, context);
    value = [op, value, right.value];
    next = right.next;
  }
  return { value, next };
}

function factor(terms, start, kind, context) {
  const term = terms[start];
  if (term?.type === 'token' && term.value?.type === 'parenthesis-block') {
    const inner = sum(terms, start + 1, kind, context);
    if (terms[inner.next]?.value?.type !== 'close-parenthesis') {
      throw unreadable(context, 'has an unclosed bracket');
    }
    return { value: inner.value, next: inner.next + 1 };
  }
  if (!term) throw unreadable(context, 'ends too soon');
  return { value: tree(term, kind, context), next: start + 1 };
}

/** A slot's value for the device: settled if it has no token in it, a `__calc` marker if it has. */
function slot(term, kind, context) {
  const value = tree(term, kind, context);
  if (typeof value !== 'number') return { __calc: { expression: value, kind } };
  return kind === 'angle' ? `${value}deg` : value;
}

/**
 * `calc()` with more than one token in it, in a property that is one length or one number.
 * Null for anything else, which the caller refuses as before.
 */
function calcWithTokens(parts, kind, context) {
  const written = meaningful(parts);
  if (written.length !== 1 || written[0].type !== 'function' || written[0].value?.name !== 'calc') {
    return null;
  }
  if (kind !== 'length' && kind !== 'number') return null;
  return slot(written[0], kind, context);
}

/** Split a list of terms on commas. */
function commaSeparated(terms) {
  const groups = [[]];
  for (const term of terms) {
    if (term?.type === 'token' && term.value?.type === 'comma') groups.push([]);
    else groups[groups.length - 1].push(term);
  }
  return groups.map(meaningful);
}

/** What each transform function writes, from its arguments' slots. */
const FUNCTIONS = {
  translatex: (a) => [{ translateX: a('length', 0) }],
  translatey: (a) => [{ translateY: a('length', 0) }],
  translate: (a, n) => [{ translateX: a('length', 0) }, { translateY: n > 1 ? a('length', 1) : 0 }],
  scale: (a, n) => [{ scaleX: a('number', 0) }, { scaleY: a('number', n > 1 ? 1 : 0) }],
  scalex: (a) => [{ scaleX: a('number', 0) }],
  scaley: (a) => [{ scaleY: a('number', 0) }],
  rotate: (a) => [{ rotate: a('angle', 0) }],
  rotatez: (a) => [{ rotate: a('angle', 0) }],
  rotatex: (a) => [{ rotateX: a('angle', 0) }],
  rotatey: (a) => [{ rotateY: a('angle', 0) }],
  skewx: (a) => [{ skewX: a('angle', 0) }],
  skewy: (a) => [{ skewY: a('angle', 0) }],
};

/** `transform: translateY(var(--y)) rotate(var(--r))`: each function with its slots. */
function transformList(parts, context) {
  return meaningful(parts).flatMap((part) => {
    const name = part.type === 'function' ? part.value.name.toLowerCase() : undefined;
    const write = FUNCTIONS[name];
    if (!write) {
      throw new CssUnsupported(
        `${context}: a transform with a token in it takes ${Object.keys(FUNCTIONS).join(', ')}; ` +
          `'${name ?? part.type}' is not one of them`,
      );
    }
    const args = commaSeparated(part.value.arguments ?? []);
    const arg = (kind, index) => {
      if (args[index]?.length !== 1) throw unreadable(context, `leaves ${name}() short`);
      return slot(args[index][0], kind, context);
    };
    return write(arg, args.length);
  });
}

/**
 * `translate`, `rotate`, `scale` or `transform` with a token in it, as the structured value the
 * engine composes, with a marker wherever a token is. Null for any other property.
 */
function motionWithTokens(property, parts, context) {
  const values = meaningful(parts);
  const one = (kind, index) => slot(values[index], kind, context);
  switch (property) {
    case 'transform':
      return { props: ['transform'], within: transformList(parts, context) };
    case 'translate':
      if (values.length > 2) throw unreadable(context, 'moves in three dimensions');
      return {
        props: ['__translate'],
        within: [
          { translateX: one('length', 0) },
          { translateY: values[1] ? one('length', 1) : 0 },
        ],
      };
    case 'rotate':
      if (values.length !== 1) throw unreadable(context, 'turns about an axis');
      return { props: ['__rotate'], within: [{ rotate: one('angle', 0) }] };
    case 'scale':
      if (values.length > 2) throw unreadable(context, 'scales in three dimensions');
      return {
        props: ['__scale'],
        within: [{ scaleX: one('number', 0) }, { scaleY: one('number', values.length - 1) }],
      };
    default:
      return null;
  }
}

module.exports = { calcWithTokens, mentionsVar, motionWithTokens, slot };
