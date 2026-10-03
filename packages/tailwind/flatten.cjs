/**
 * Tailwind's CSS, made into CSS the engine's compiler accepts.
 *
 * Tailwind 4 emits for a browser, and most of what it emits is about being one: cascade layers,
 * `@property` declarations, feature detection, pseudo-element resets, `oklch()` colours, and a
 * spacing scale expressed as `calc(var(--spacing) * n)`. This turns that into the subset a
 * renderer with no CSS parser on device can compile, without changing what any declaration means.
 *
 * The rule of thumb throughout: **anything that is only a browser question is answered here**, at
 * build time, and anything that is a real cascade question is left for the engine, which has a
 * cascade. That is the whole difference from NativeWind, which has to rebuild one.
 *
 * Import `tailwindcss/theme.css` and `tailwindcss/utilities.css` rather than `tailwindcss`, and
 * preflight never arrives - it is `html`, `::before` and `-webkit-*` from end to end. This copes
 * if it does arrive, by dropping what it cannot express, but the warnings are noise nobody needs.
 */
const { transform, Features } = require('lightningcss');
const { markUnitless } = require('@solid-native/metro/css/compile.cjs');

/** `@layer a, b;` - the statement that orders layers, which is meaningless once they are gone. */
const LAYER_STATEMENT = /@layer\s+[^;{]+;/g;

/**
 * Remove an at-rule and everything inside it, or unwrap it and keep its contents.
 *
 * Written by hand rather than with a regex because the bodies nest: `@supports` holds rules, and
 * `@layer` holds `@supports`. Brace counting is the whole of it.
 */
function rewriteAtRule(css, prelude, keepBody) {
  let out = css;
  for (let at = out.indexOf(prelude); at !== -1; at = out.indexOf(prelude, at)) {
    const open = out.indexOf('{', at);
    if (open === -1) break;
    const close = blockEnd(out, open);
    if (close === -1) break;
    const body = keepBody ? out.slice(open + 1, close) : '';
    out = out.slice(0, at) + body + out.slice(close + 1);
  }
  return out;
}

/** The index of the brace that closes the block opened at `open`, or -1. */
function blockEnd(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** A custom property's value, less `!important`, which belongs to the declaration, not the value. */
function withoutImportant(value) {
  return value.replace(/\s*!\s*important\s*$/i, '').trim();
}

/**
 * The custom properties a sheet declares, and what they resolve to.
 *
 * Two sources: ordinary declarations, wherever they appear, and `@property`'s `initial-value`,
 * which is how Tailwind gives `--tw-border-style` a default of `solid` on the web. Both are
 * static by the time this runs; a custom property that changes at runtime is the app's business
 * and is left alone, because it is never one of these.
 */
function collectVariables(css) {
  const values = new Map();
  const conflicting = new Set();
  for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)[;}]/g)) {
    const trimmed = withoutImportant(value);
    if (values.has(name) && values.get(name) !== trimmed) conflicting.add(name);
    values.set(name, trimmed);
  }
  for (const [, name, body] of css.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)) {
    const initial = /initial-value\s*:\s*([^;}]+)/.exec(body);
    if (initial) values.set(name, initial[1].trim());
  }
  // A property with two different values is a themed one: `--primary` is one colour under `:root`
  // and another under `.dark`, and which applies is a question only the cascade can answer.
  // Substituting picks whichever was written last and paints the dark palette in daylight, so
  // these are left for the engine, which resolves `var()` per node against the tokens in scope.
  //
  // Tailwind's own `--tw-*` plumbing is exempt. Those are set by one utility and read by another
  // on the same node, and every one of them also has a reset value, so they all look themed and
  // none of them is. They stay substituted, which is what they have always been.
  for (const name of conflicting) {
    if (!name.startsWith('--tw-')) values.delete(name);
  }
  return values;
}

/**
 * Find the next `var(` and return the whole call, its name and its fallback.
 *
 * Scanned rather than matched: a fallback can be `calc(1.75 / 1.125)` or another `var()`, and a
 * regex that stops at the first `)` silently leaves those alone - which is how the type scale
 * came out empty the first time.
 */
function nextVar(css, from) {
  const at = css.indexOf('var(', from);
  if (at === -1) return null;
  let depth = 0;
  for (let i = at + 3; i < css.length; i++) {
    if (css[i] === '(') depth++;
    else if (css[i] === ')' && --depth === 0) {
      const inside = css.slice(at + 4, i);
      const comma = splitOnce(inside);
      return { at, end: i + 1, name: comma.name.trim(), fallback: comma.fallback };
    }
  }
  return null;
}

/**
 * Whether a value refers to the property it is the value of, which would substitute forever.
 *
 * Matched to the end of the name rather than by prefix. `--tw-shadow`'s value mentions
 * `--tw-shadow-color`, which starts with it, and treating that as a self-reference left every
 * Tailwind shadow unsubstituted - so the file-wide reset won instead and no app has ever painted
 * one.
 */
function selfReferential(value, name) {
  return new RegExp(`var\\(\\s*${name.replace(/[-]/g, '\\-')}\\s*[,)]`).test(value);
}

/** Split `--x, fallback` at the first comma that is not inside parentheses. */
function splitOnce(inside) {
  let depth = 0;
  for (let i = 0; i < inside.length; i++) {
    if (inside[i] === '(') depth++;
    else if (inside[i] === ')') depth--;
    else if (inside[i] === ',' && depth === 0) {
      return { name: inside.slice(0, i), fallback: inside.slice(i + 1).trim() };
    }
  }
  return { name: inside, fallback: undefined };
}

/** A rule that resets every `--tw-*` slot on every node: Tailwind's `*, ::before, ::after`. */
const RESET = /(^|,)\s*\*\s*(,|$)/;

/**
 * Custom properties the device supplies at runtime, which no build step can know.
 *
 * They have to survive this untouched, fallback and all: collapsing
 * `var(--safe-area-inset-bottom, 0px)` to `0px` here produces a layout that always sits under the
 * home indicator, and collapsing `var(--hairline, 1px)` to `1px` produces a divider three
 * physical pixels thick - both with nothing in the output to say why. Everything else is
 * substituted, because there is no CSS parser on device to do it later.
 *
 * A gradient's stops are here for a different reason: they are set by one class and read by
 * another, so no build step can know which pair a node will wear. See `expandGradients`.
 */
const RUNTIME_SUPPLIED =
  /^--(safe-area-inset-(top|right|bottom|left)|hairline|tw-gradient-(from|via|to)(-position)?)$/;

/**
 * The `--tw-*` slots one utility sets and another reads, which only the node can answer.
 *
 * `translate-x-2` sets `--tw-translate-x` and `translate-y-4` sets `--tw-translate-y`, and each
 * reads both. Substituted here, each rule takes the other axis from the `*` reset, and the one the
 * sheet writes last wins with its zero. Left as `var()`, the engine reads each slot from whatever
 * class set it on that node, which is what the web does.
 *
 * Only a slot the sheet sets somewhere other than the reset, read by a rule that does not set it
 * itself or set again by a rule that does not read it, and only where the engine resolves `var()`
 * per node: a transform, a shadow or a filter, or a part of a shadow slot, as `ring-blue-500` sets
 * the colour of `ring-2`'s. Anything else stays settled here.
 */
function crossRuleVariables(css) {
  const set = new Set();
  const setWithoutReading = new Set();
  const readElsewhere = new Set();
  const readWhereSet = new Set();
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectorList(selector).some((one) => one.trim() === '*')) continue;
    const declared = new Set([...body.matchAll(/(--tw-[\w-]+)\s*:/g)].map((match) => match[1]));
    const read = new Set();
    for (const [, property, value] of body.matchAll(/(-?-?[\w-]+)\s*:\s*([^;]+)/g)) {
      const perNode = RESOLVED_PER_NODE.test(property) || SHADOW_SLOT.test(property);
      for (const [, name] of value.matchAll(/var\(\s*(--tw-[\w-]+)/g)) {
        if (perNode || REVERSE_SLOT.test(name)) read.add(name);
      }
    }
    for (const name of declared) {
      set.add(name);
      if (!read.has(name)) setWithoutReading.add(name);
    }
    for (const name of read) (declared.has(name) ? readWhereSet : readElsewhere).add(name);
  }
  // A slot a rule reads where it sets it, which another rule sets without reading: `drop-shadow-lg`
  // reads the `--tw-drop-shadow` it sets, and `drop-shadow-red-500` sets it again, coloured.
  return new Set([
    ...[...readElsewhere].filter((name) => set.has(name)),
    ...[...readWhereSet].filter((name) => setWithoutReading.has(name)),
  ]);
}

/**
 * The 0 or 1 `space-x-reverse` and `divide-y-reverse` set, which `space-x-2` and `divide-y-2` read
 * inside a margin or border width's `calc()`: settled here, the reverse class does nothing.
 */
const REVERSE_SLOT = /^--tw-(space|divide)-[xy]-reverse$/;

/**
 * A bare number times a reverse slot: `divide-x-[3]` is `calc(3 * var(--tw-divide-x-reverse))`,
 * and the slot is 0 or 1, so the width has no unit and a browser drops it.
 */
const UNITLESS_REVERSE =
  /calc\((-?\d*\.?\d+)(\s*\*\s*(?:var\(--tw-(?:space|divide)-[xy]-reverse\)|calc\(1 - var\(--tw-(?:space|divide)-[xy]-reverse\)\)))\)/g;

/** Each such number tagged as `markUnitless` tags one, so it is refused as needing a unit. */
function markUnitlessReverse(css) {
  return css.replace(UNITLESS_REVERSE, (whole, number, rest) =>
    Number(number) === 0 ? whole : `calc(${number}__unitless${rest})`,
  );
}

/** Properties whose `var()` the engine resolves per node, from the tokens in scope there. */
const RESOLVED_PER_NODE =
  /^(translate|scale|rotate|transform|box-shadow|text-shadow|filter|font-variant-numeric)$/;

/**
 * A shadow slot, whose own parts another class may set: `ring-blue-500` its colour,
 * `ring-offset-2` the width it is pushed out by, `ring-inset` whether it is inset. A drop shadow
 * keeps its shape in `--tw-drop-shadow-size`, which `drop-shadow-red-500` colours.
 */
// Tailwind 3's `--tw-shadow-colored` too: the coloured copy of a shadow, which `shadow-red-500`
// swaps in and whose colour is a slot of its own.
const SHADOW_SLOT = /^--tw-[\w-]*shadow(-size|-colored)?$/;

/**
 * Replace `var()` with what it resolves to, repeatedly, because theme values reference each other.
 *
 * A reference that resolves to nothing is left as it is: the engine resolves `var()` on device
 * too, and a value the app supplies at runtime - a safe-area inset, say - has to survive this.
 */
/**
 * Substitute inside one rule, with that rule's own declarations taking precedence.
 *
 * Tailwind's shadows, rings and filters are all built this way: a `*` reset gives every slot a
 * no-op default, and the utility that needs one declares it in the very rule that reads it.
 * Taking the file-wide value means taking the reset, because it is written last - so `.shadow-lg`
 * resolved its own `--tw-shadow` to `0 0 #0000` and painted nothing, silently, in every app.
 *
 * Only the rule's own block is consulted, not its ancestors'. That is enough for the pattern this
 * exists for, and anything wider is a cascade question the engine answers on device.
 */
function substituteInRules(css, values, runtime) {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selector, body) => {
    const local = new Map(values);
    let changed = false;
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)[;}]?/g)) {
      const trimmed = withoutImportant(value);
      if (local.get(name) !== trimmed) changed = true;
      local.set(name, trimmed);
    }
    return changed ? `${selector}{${substituteVariables(body, local, runtime)}}` : whole;
  });
}

function substituteVariables(css, values, runtime) {
  let out = css;
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    let from = 0;
    for (let found = nextVar(out, from); found; found = nextVar(out, from)) {
      // A runtime-supplied property is left exactly as written, fallback and all, because only
      // the device can answer it.
      if (RUNTIME_SUPPLIED.test(found.name) || runtime.has(found.name)) {
        from = found.end;
        continue;
      }
      // `initial` in a custom property means it holds nothing, so `var()` takes its fallback.
      // Tailwind writes it in the reset for every optional slot - `--tw-shadow-color: initial` is
      // "nobody asked for a shadow colour" - and substituting the word itself produced a shadow
      // painted the colour `initial`, which is to say no shadow at all.
      const declared = values.get(found.name);
      const value = declared === undefined || declared === 'initial' ? found.fallback : declared;
      if (value === undefined || selfReferential(value, found.name)) {
        from = found.end;
        continue;
      }
      out = out.slice(0, found.at) + value + out.slice(found.end);
      from = found.at + value.length;
      changed = true;
    }
    if (!changed) break;
  }
  return out;
}

/**
 * A selector list split into its selectors: at a comma that is neither escaped, as in Tailwind's
 * `.placeholder-\\[rgb\\(1\\,2\\,3\\)\\]`, nor inside parentheses, as in `:is(.a, .b)`.
 */
function selectorList(selectors) {
  const list = [''];
  const at = { depth: 0, quote: null };
  for (let i = 0; i < selectors.length; i++) {
    const c = selectors[i];
    if (c === '\\') {
      list[list.length - 1] += c + (selectors[++i] ?? '');
      continue;
    }
    nest(at, c);
    if (c === ',' && at.depth === 0 && !at.quote) list.push('');
    else list[list.length - 1] += c;
  }
  return list;
}

/**
 * How deep a selector is at a character: inside brackets or parentheses, or a quoted attribute
 * value, where a comma is part of the value (`[data-x="1,2"]`) rather than between selectors.
 */
function nest(at, c) {
  if (at.quote) {
    if (c === at.quote) at.quote = null;
  } else if (c === '"' || c === "'") at.quote = c;
  else if (c === '(' || c === '[') at.depth++;
  else if (c === ')' || c === ']') at.depth--;
}

/**
 * Drop the pseudo-element selectors from a list that has others: Tailwind's reset is
 * `*, ::before, ::after, ::backdrop`, and only its `*` addresses anything a template declares.
 *
 * `::before`, `::file-selector-button` and friends would mean synthesising view hierarchy from a
 * stylesheet, which this project refuses on purpose - see ADR 0001. A rule that is *only*
 * pseudo-elements is left whole for the compiler, which refuses it with a warning that says so:
 * `placeholder:text-gray-400` is a class an app asked for, and dropped here it did nothing with
 * nothing to say why.
 */
function dropPseudoElementRules(css) {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selectors, body) => {
    if (!selectors.includes('::')) return whole;
    const all = selectorList(selectors).map((one) => one.trim());
    const kept = all.filter((one) => one && !one.includes('::'));
    // Tailwind 3's `::backdrop { --tw-...: ... }`, the reset again for a box native never draws: no
    // author wrote it, so it goes without a word.
    if (!kept.length && /^\s*(--tw-[\w-]+\s*:[^;{}]*;?\s*)*$/.test(body)) return '';
    return kept.length && kept.length < all.length ? `${kept.join(', ')} {${body}}` : whole;
  });
}

/**
 * Fold arithmetic, by handing it to lightningcss with an old target.
 *
 * `calc(0.25rem * 4)` becomes `1rem`, which the engine's own compiler can then translate. The
 * target is a browser old enough to need the lowering; nothing about it reaches a device.
 *
 * Excluding the media-query features is load-bearing rather than tidiness. A target that old
 * lowers everything a browser that age would lack, and that includes Tailwind's own `(width <
 * 500px)` breakpoint and container queries - rewritten as `not (min-width: 500px)`, which the
 * engine's compiler refuses outright (`compile.cjs`'s own `flatten()` hit the same thing for
 * nesting, and fixed it the same way: ask for only the feature that needs lowering, rather than
 * lowering for a target). Left in, every `max-*` variant and range media query compiled to
 * nothing.
 *
 * Colours are excluded too. `oklch()` and the other perceptual spaces are the compiler's to
 * convert, so that one converter decides what every colour is. lightningcss's lowering gamut-maps
 * by an earlier draft of CSS Color 4, in single precision, and most of the palette came out a step
 * or more from the same `oklch()` written in a component's stylesheet.
 */
function fold(css) {
  const out = transform({
    filename: 'tailwind.css',
    code: Buffer.from(css),
    minify: false,
    targets: { chrome: 90 << 16 },
    exclude:
      Features.MediaRangeSyntax |
      Features.MediaIntervalSyntax |
      Features.OklabColors |
      Features.LabColors |
      Features.ColorFunction,
  }).code.toString();
  // Lowering can reintroduce feature detection around what it just lowered.
  return rewriteAtRule(foldSimpleCalc(out), '@supports', true);
}

/**
 * The calc() lightningcss leaves: one of plain numbers, and any inside a custom property.
 *
 * Tailwind writes a negative integer as `calc(10 * -1)` for `-z-10`, a spacing slot as
 * `--tw-translate-x: calc(.25rem * 2)`, and a fraction as `calc(1/2 * 100%)`. lightningcss folds
 * none of them - it cannot know what a custom property will be used as - and the compiler refuses
 * all three. Only numbers in one unit are folded, with `*` and `/` before `+` and `-`; a calc() with
 * two units, a var() or brackets in it is left for the compiler to judge.
 */
function foldSimpleCalc(css) {
  // Innermost first, and again, so `calc(calc(1rem + 2px) * -1)` comes down to one length.
  for (let before = ''; before !== css;) {
    before = css;
    css = css.replace(/calc\(([^()]*)\)/gi, (whole, inside) => simpleCalc(inside) ?? whole);
  }
  return css;
}

/** Points in a rem: fixed, with no root element to change it. See `values.cjs`. */
const REM = 16;

/** One unit's arithmetic, as `<number><unit>`, or null when it is not that simple. */
function simpleCalc(expression) {
  const terms = [...expression.matchAll(/\s*(-?[\d.]+)([a-z%]*)\s*([*/]|\s[+-]\s|$)/gi)];
  if (terms.map((term) => term[0]).join('') !== expression) return null;
  const sum = products(terms);
  return sum === null ? null : added(sum);
}

/** Each run of `*` and `/` as one signed term of the sum around it; null when one cannot be. */
function products(terms) {
  const sum = [];
  let product = null;
  let op = '';
  let sign = 1;
  for (const [, digits, unit, next] of terms) {
    const value = { n: Number(digits), unit: unit.toLowerCase() };
    product = product === null ? value : combine(product, value, op);
    if (product === null) return null;
    op = next.trim();
    if (op === '*' || op === '/') continue;
    sum.push({ ...product, sign });
    product = null;
    sign = op === '-' ? -1 : 1;
  }
  return sum;
}

/** Signed terms added up, in their one unit; null when they are in two. */
function added(sum) {
  // A rem is 16 points in this engine, as the compiler reads one, so rem and px add up.
  if (sum.some((term) => term.unit === 'px')) {
    for (const term of sum)
      if (term.unit === 'rem') Object.assign(term, { n: term.n * REM, unit: 'px' });
  }
  // Two kinds of value do not add up, zero or not: `calc(0deg + 4px)` is dropped by a browser.
  // A length beside a percentage is one kind, where a zero of either drops out below.
  const kinds = new Set(sum.map((term) => kindOfUnit(term.unit)));
  if (kinds.size > 1 && !(kinds.size === 2 && kinds.has('length') && kinds.has('%'))) return null;
  const units = new Set(sum.filter((term) => term.n !== 0).map((term) => term.unit));
  if (units.size > 1) return null;
  const total = sum.reduce((acc, term) => acc + term.sign * term.n, 0);
  return `${round(total)}${[...units][0] ?? sum[0]?.unit ?? ''}`;
}

/** The kind of value a unit makes: a number, an angle, a time, a percentage or a length. */
function kindOfUnit(unit) {
  if (unit === '') return 'number';
  if (unit === '%') return '%';
  if (['deg', 'rad', 'grad', 'turn'].includes(unit)) return 'angle';
  if (['s', 'ms'].includes(unit)) return 'time';
  return 'length';
}

/** `a * b` or `a / b`, keeping the one unit a product may have; null when that is not so. */
function combine(a, b, op) {
  if (op === '*') {
    if (a.unit && b.unit) return null;
    return { n: a.n * b.n, unit: a.unit || b.unit };
  }
  if (b.unit || b.n === 0) return null;
  return { n: a.n / b.n, unit: a.unit };
}

/**
 * Turn a unitless `line-height` into a length, using the font size beside it.
 *
 * CSS reads `line-height: 1.5` as a ratio of the element's font size, and inherits the *ratio*;
 * React Native's `lineHeight` is a number of points and there is no ratio to inherit. Tailwind
 * always emits the two together - `.text-lg` is a size and its leading - so the multiplication can
 * be done here, once, where both are in the same rule. A ratio with no font size beside it is left
 * alone for the compiler to refuse, because guessing an inherited size would be worse than saying
 * nothing.
 */
function resolveUnitlessLineHeight(css) {
  return css.replace(/\{([^{}]*)\}/g, (whole, body) => {
    const ratio = /(^|;)\s*line-height\s*:\s*([0-9]*\.?[0-9]+)\s*(?=;|$)/.exec(body);
    if (!ratio) return whole;
    const size = /(^|;)\s*font-size\s*:\s*([0-9]*\.?[0-9]+)(rem|px)\s*(?=;|$)/.exec(body);
    if (!size) return whole;
    const height = Number(size[2]) * Number(ratio[2]);
    return whole.replace(ratio[0], `${ratio[1]} line-height: ${round(height)}${size[3]}`);
  });
}

/** Three decimal places is finer than a point on any screen, and keeps the output readable. */
function round(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * `border-top-style: solid` and its siblings, logical ones included: `border-y` is
 * `border-block-style` and `border-x` is `border-inline-style`.
 *
 * React Native has one `borderStyle` for the whole box, so a per-side one cannot be expressed;
 * `solid` is also its default, so Tailwind's `border-t` means nothing but its width. A side style
 * that is *not* solid is left to the compiler, which drops it and says so - the app asked for
 * something native cannot do, and should hear about it.
 */
function dropRedundantBorderStyles(css) {
  return css.replace(
    /\s*border-(top|right|bottom|left|(inline|block)(-start|-end)?)-style\s*:\s*solid\s*(!\s*important\s*)?;/g,
    '',
  );
}

/**
 * The `--tw-*` declarations nothing reads once the build has filled every `var()` it could.
 *
 * `ease-in` sets `--tw-ease` for `.transition` to read, and that read is settled here, so the
 * declaration is left over: a token in every bundle, and one the compiler warned about on every
 * `ease-*` class, since a cubic-bezier() is not a value a token can hold. A slot left for the
 * device is still read by a `var()` and stays.
 */
function dropUnreadSlots(css) {
  const read = new Set([...css.matchAll(/var\(\s*(--tw-[\w-]+)/g)].map((match) => match[1]));
  // Again until nothing changes: a match takes the `;` that ends its declaration, which is the one
  // the next declaration needs to be found, so one pass leaves every other slot behind.
  let out = css;
  for (let before = ''; before !== out;) {
    before = out;
    out = out.replace(/(^|[;{])\s*(--tw-[\w-]+)\s*:[^;{}]*;?/g, (whole, start, name) =>
      read.has(name) ? whole : start,
    );
  }
  return out;
}

/**
 * A declaration left with no value once its empty slots were substituted away.
 *
 * `.transform` is `transform: var(--tw-rotate-x,) ... var(--tw-skew-y,)`, five slots nobody set.
 * The web reads the empty result as invalid, which is `none`, so it is no transform at all; kept,
 * the compiler refuses `transform: ` with a warning. A custom property may be empty, and stays.
 */
function dropEmptyDeclarations(css) {
  return css.replace(/(^|[;{])\s*[a-z][\w-]*\s*:\s*(!\s*important\s*)?(?=;|})/gi, '$1');
}

/**
 * The stops a Tailwind gradient is built from, in the order they are painted.
 *
 * Each is set by its own utility class - `from-blue-500`, `via-purple-500`, `to-pink-500` - and
 * the position by another (`from-20%`), so none of them can be resolved here. The fallback is the
 * `@property` default, which is what a sheet that never sets one should paint.
 */
const GRADIENT_STOPS = ['from', 'via', 'to'];

/**
 * A gradient Tailwind composed out of custom properties, rewritten as one with holes in it.
 *
 * Tailwind joins the three colour classes to the direction class through `--tw-gradient-stops`,
 * whose value is a *string* of further `var()` references that the browser assembles at paint
 * time. That is a CSS parser's job, and there is no parser on device - so the indirection is
 * undone here, back into a gradient whose stops are plain references the engine's own cascade
 * fills in per node. The middle stop disappears on its own wherever no `via-*` class defined it.
 *
 * The direction is read from the same rule, which is where Tailwind puts it, so a sheet with
 * twenty `bg-linear-*` classes keeps twenty different directions.
 */
function expandGradients(css, values) {
  return css.replace(/([^{}]*)\{([^{}]*)\}/g, (rule, selector, body) => {
    if (!body.includes('var(--tw-gradient-stops)')) return rule;

    const position = /--tw-gradient-position\s*:\s*([^;}]+)/.exec(body)?.[1] ?? '';
    // `in oklab` asks for an interpolation space, which native has no say in.
    const prelude = withoutImportant(position.replace(/\bin\s+[\w-]+/g, ''));
    const stops = GRADIENT_STOPS.map((stop) => {
      const fallback = values.get(`--tw-gradient-${stop}-position`);
      const at = fallback
        ? `var(--tw-gradient-${stop}-position, ${fallback})`
        : `var(--tw-gradient-${stop}-position)`;
      return `var(--tw-gradient-${stop}) ${at}`;
    });

    const expanded = body
      .replace(/--tw-gradient-position\s*:[^;}]*;?/g, '')
      .replace(
        /(linear|radial)-gradient\(\s*var\(--tw-gradient-stops\)\s*\)/g,
        (_, kind) => `${kind}-gradient(${prelude ? `${prelude}, ` : ''}${stops.join(', ')})`,
      );
    return `${selector}{${expanded}}`;
  });
}

/**
 * Tailwind 3's gradients, rewritten in the shape Tailwind 4 writes them, for `expandGradients`.
 *
 * Tailwind 3 puts the direction inline, `linear-gradient(to right, var(--tw-gradient-stops))`, and
 * builds the stop list inside `from-*` and `via-*` rather than naming each stop: `via-white` is a
 * whole `--tw-gradient-stops` with `#fff` written into its middle. Each colour class is turned back
 * into the one stop it names, and each position reset, written as an empty value, into the default
 * Tailwind 4 gives it with `@property`.
 */
function normalizeV3Gradients(css) {
  return css
    .replace(
      /background-image\s*:\s*(linear|radial)-gradient\(\s*([^,()]+),\s*var\(--tw-gradient-stops\)\s*\)/g,
      '--tw-gradient-position: $2; background-image: $1-gradient(var(--tw-gradient-stops))',
    )
    .replace(
      /--tw-gradient-stops\s*:\s*var\(--tw-gradient-from\),\s*(.+?)\s+var\(--tw-gradient-via-position\),\s*var\(--tw-gradient-to\)/g,
      '--tw-gradient-via: $1',
    )
    .replace(/\s*var\(--tw-gradient-(from|via|to)-position\)/g, '')
    .replace(/--tw-gradient-(from|via|to)-position\s*:\s*;/g, (_, stop) => {
      return `--tw-gradient-${stop}-position: ${{ from: '0%', via: '50%', to: '100%' }[stop]};`;
    });
}

/** Tailwind 3's colour with a token alpha: `rgb(59 130 246 / var(--tw-bg-opacity, 1))`, or an `hsl()` one. */
const OPACITY_COLOUR =
  /([\w-]+)\s*:\s*(rgb|hsl)a?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?\s*\/\s*var\(\s*(--tw-[\w-]+-opacity)\s*,\s*1\s*\)\s*\)/g;

/**
 * An `hsl()` colour's channels in sRGB, as a browser gives them when it prints the colour: whole
 * numbers, since the channels token that carries them is read as an `rgb()`.
 */
function hslChannels(h, s, l) {
  const [hue, sat, light] = [(((h % 360) + 360) % 360) / 360, s / 100, l / 100];
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const channel = (t) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [hue + 1 / 3, hue, hue - 1 / 3].map((t) => Math.round(channel(t) * 255));
}

/**
 * Tailwind 3's `bg-opacity-50` and friends, as the channels-and-alpha colour the engine resolves.
 *
 * `.bg-blue-500` is `rgb(59 130 246 / var(--tw-bg-opacity, 1))`, and `.bg-opacity-50` sets only
 * the alpha. The engine has no colour made of written channels and a token alpha, but it does have
 * Bootstrap's `rgba(var(--channels), var(--alpha))`, so the channels move into a token declared
 * beside the colour. Only for an alpha some other rule sets: where none does, the colour is solid
 * and is substituted like any other. A ring's colour is left alone, being a token itself.
 *
 * @returns the rewritten CSS, and the alpha and channel tokens to leave for the engine
 */
function opacityChannels(css) {
  const setters = new Set();
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (RESET.test(selector.trim())) continue;
    if (/(rgb|hsl)a?\([^)]*var\(--tw-[\w-]+-opacity/.test(body)) continue;
    for (const [, name] of body.matchAll(/(--tw-[\w-]+-opacity)\s*:/g)) setters.add(name);
  }
  const runtime = new Set();
  const out = css.replace(OPACITY_COLOUR, (whole, property, space, a, b2, c, alpha) => {
    if (!setters.has(alpha)) return whole;
    const [r, g, b] = space === 'hsl' ? hslChannels(+a, +b2, +c) : [a, b2, c];
    // One per property: `border-color` and `border-top-color` are both faded by
    // `--tw-border-opacity`, and sharing channels would paint one's colour on the other's sides.
    const channels = `--tw-rgb-${property.replace(/^--tw-/, '')}`;
    runtime.add(alpha).add(channels);
    return `${channels}: ${r}, ${g}, ${b}; ${property}: rgba(var(${channels}), var(${alpha}, 1))`;
  });
  return { css: out, runtime };
}

/**
 * Tailwind 3's empty slots, read the way Tailwind 4 writes them: `var(--tw-blur,)`.
 *
 * Tailwind 3 resets an unused slot to nothing, `--tw-blur:  ;`, and reads it with no fallback, so a
 * filter or a ring is a row of `var()`s most of which hold nothing. The compiler drops a token with
 * no value, which left each of those `var()`s unresolved and the whole declaration with it. An
 * empty fallback says the same thing and is what the engine settles.
 */
function emptySlotFallbacks(css) {
  const empty = new Set();
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!RESET.test(selector.trim())) continue;
    for (const [, name, value] of body.matchAll(/(--tw-[\w-]+)\s*:([^;{}]*)/g)) {
      if (!value.trim()) empty.add(name);
    }
  }
  if (!empty.size) return css;
  return css.replace(/var\(\s*(--tw-[\w-]+)\s*\)/g, (whole, name) =>
    empty.has(name) ? `var(${name},)` : whole,
  );
}

/** A class selector, escapes and all: `.dark`, `.platform-android`, `.md\:p-4`. */
const CLASS = String.raw`\.(?:\\.|[\w-])+`;
// A trailing pseudo-class or attribute selector - `:active`, `[data-disabled]`, `:focus` - is what
// a same-node variant (`press:`, `focus:`, `disabled:`) stacked on top adds after the `:is()`.
const STACKED = new RegExp(
  String.raw`^\s*(${CLASS})\s+:is\((${CLASS})\s+((?:\\.|[^()\\])+)\)([^\s]*)\s*$`,
);

/**
 * Tailwind 3's spelling of the same thing, `.dark .platform-ios .x`, which has no `:is()`. Only
 * the preset's own ancestor classes, so a selector an app wrote is never rewritten.
 */
const ANCESTOR = String.raw`\.(?:dark|platform-(?:ios|android|web))`;
const STACKED_PLAIN_ONE = new RegExp(
  String.raw`^\s*(${ANCESTOR})\s+(${ANCESTOR})\s+([^\s].*?)\s*$`,
);
const STACKED_PLAIN = new RegExp(String.raw`(^|,)\s*${ANCESTOR}\s+${ANCESTOR}\s`);

/**
 * A stacked variant, rewritten as the ancestor tests it means.
 *
 * `android:dark:bg-black` comes out of Tailwind as `.dark :is(.platform-android .x)`: an element
 * with some `.platform-android` ancestor and some `.dark` ancestor, in either order or both on one
 * node. The engine refuses a combinator inside `:is()`, so the whole rule used to be dropped and
 * every stacked platform and dark variant silently did nothing. Written out, it is three shapes
 * the engine does match - which matters most for the last, since `mount` and `watchConditions`
 * put both classes on the root.
 *
 * A same-node variant stacked on top of two ancestor ones - `ios:dark:press:bg-red-500` - adds a
 * pseudo-class *after* the closing paren (`.dark :is(.platform-ios .x):active`), which the
 * original pattern did not account for: it only matched a selector ending at the paren, so this
 * shape passed through unexpanded and the compiler refused it the same way. The suffix belongs on
 * the class in each of the three shapes, since it is the thing that has to match on the node
 * itself alongside the ancestor tests.
 */
function expandStackedVariants(css) {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selectors, body) => {
    if (!selectors.includes(':is(') && !STACKED_PLAIN.test(selectors)) return whole;
    let changed = false;
    const expanded = selectorList(selectors).flatMap((selector) => {
      const match = STACKED.exec(selector) ?? STACKED_PLAIN_ONE.exec(selector);
      if (!match) return [selector.trim()];
      changed = true;
      const [, outer, inner, rest, suffix = ''] = match;
      const self = `${rest}${suffix}`;
      return [`${outer} ${inner} ${self}`, `${inner} ${outer} ${self}`, `${outer}${inner} ${self}`];
    });
    return changed ? `${expanded.join(', ')}{${body}}` : whole;
  });
}

/**
 * Tailwind's output, as CSS the engine compiles.
 *
 * @param {string} css the CSS the Tailwind CLI produced
 * @returns {string} CSS with the browser-only parts answered or removed
 */
/** A compound selector: no whitespace or combinator outside parentheses, escapes allowed. */
const COMPOUND = String.raw`(?:\\.|\((?:\\.|[^()\\])*\)|[^\s>+~,()\\])+`;
const WHERE_CHILD = new RegExp(String.raw`:where\((${COMPOUND})\s*>\s*(${COMPOUND})\)`, 'g');

/**
 * `:where(.space-x-2 > :not(:last-child))` as `:where(.space-x-2) > :where(:not(:last-child))`:
 * the same children, at the same zero specificity, in a form the compiler reads. Tailwind 4 writes
 * every `space-*` and `divide-*` utility this way, and the compiler takes only a compound inside
 * `:where()`.
 */
function childrenOfWhere(css) {
  return css.replace(WHERE_CHILD, ':where($1) > :where($2)');
}

/**
 * The `*` reset, less the reverse slots. On the web the reset is in a layer under every utility;
 * unwrapped here it comes after them, and ties with `space-x-reverse`, whose `:where()` has no
 * specificity to beat it by, so the reverse class set its slot to 1 and the reset put it back to
 * 0. Every rule that reads a reverse slot sets it to 0 itself, so the reset's copy says nothing.
 */
function resetWithoutReverseSlots(css) {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selector, body) =>
    selectorList(selector).some((one) => one.trim() === '*')
      ? `${selector}{${body.replace(/--tw-(space|divide)-[xy]-reverse\s*:[^;}]*;?/g, '')}}`
      : rule,
  );
}

function flattenTailwind(css) {
  // Before any pass of lightningcss here, which reads `m-[3]`'s bare 3 as 3px and hides it from
  // the compiler: see `markUnitless`.
  let out = childrenOfWhere(markUnitlessReverse(markUnitless(css)).replace(LAYER_STATEMENT, ''));
  out = rewriteAtRule(out, '@layer', true);
  out = rewriteAtRule(out, '@supports', true);
  out = resetWithoutReverseSlots(out);
  out = normalizeV3Gradients(out);
  // Tailwind 3's `space-*` and `divide-*` children: every child after a shown one. Native has no
  // `hidden`, so that is every child but the first, which the engine answers at once; the sibling
  // test is matched on every element and walks back through all its earlier siblings, so a long
  // list paid for it squared on every commit.
  out = out.replace(/>\s*:not\(\[hidden\]\)\s*~\s*:not\(\[hidden\]\)/g, '> :not(:first-child)');
  out = emptySlotFallbacks(out);
  // Tailwind 3's `transform-gpu`: a third dimension that is only a hint to a browser's compositor.
  out = out.replace(
    /translate3d\(([^,()]+(?:\([^()]*\))?),\s*([^,()]+(?:\([^()]*\))?),\s*0\)/g,
    'translate($1, $2)',
  );
  // A browser's vendor-prefixed copy of a property whose standard form is beside it, as Tailwind 3
  // writes `-moz-column-gap` next to `column-gap`. `-webkit-` stays: `-webkit-line-clamp` is how
  // truncation arrives.
  out = out.replace(/(^|[;{])\s*-(?:moz|ms|o)-[\w-]+\s*:[^;{}]*;?/gm, '$1');
  const opacity = opacityChannels(out);
  out = opacity.css;
  const values = collectVariables(out);
  const runtime = new Set([...crossRuleVariables(out), ...opacity.runtime]);
  out = rewriteAtRule(out, '@property', false);
  out = expandGradients(out, values);
  // `via-none` empties the chain, which is how the web takes a `via-*` stop back out. With the
  // chain gone, it says the same by leaving the middle stop with no colour, which is not painted.
  // Only where it is the rule's one declaration, which is `via-none`: the `*` reset writes the same
  // thing, and there it would give every element a token for nothing.
  out = out.replace(
    /\{\s*--tw-gradient-via-stops\s*:\s*initial\s*(!\s*important\s*)?;?\s*\}/g,
    (_, important) => `{ --tw-gradient-via: none${important ? ' !important' : ''}; }`,
  );
  // The chain the gradient used to be assembled through, now that nothing reads it. Left in, it
  // is a token per gradient class in every bundle, holding the word `initial`.
  out = out.replace(/--tw-gradient(-via)?-stops\s*:[^;}]*;?/g, '');
  // The middle stop's reset. Tailwind's fallback for browsers without `@property` gives every
  // element `--tw-gradient-via: #0000`, where the web only puts a via stop in the gradient at all
  // when a `via-*` class asks. Kept, every two-stop gradient paints a transparent stop halfway
  // along, and a dark card shows whatever is behind it through a streak across the middle. With
  // no colour the engine leaves the stop out, which is what the web draws.
  out = out.replace(/--tw-gradient-via\s*:\s*(#0000|transparent|initial)\s*;?/g, '');
  // Rule-local first: a property a rule declares and reads is that rule's business, and the
  // file-wide map holds the `*` reset that would otherwise win.
  out = substituteInRules(out, values, runtime);
  out = substituteVariables(out, values, runtime);
  out = dropUnreadSlots(out);
  out = dropPseudoElementRules(out);
  out = expandStackedVariants(out);
  out = dropRedundantBorderStyles(out);
  out = dropEmptyDeclarations(out);
  return resolveUnitlessLineHeight(fold(out));
}

module.exports = { flattenTailwind };
