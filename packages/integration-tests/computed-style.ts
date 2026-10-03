/**
 * Whether the engine's resolved style says what Chrome's computed style says, one CSS property at
 * a time. Used by `tailwind-sweep.test.ts` against the recorded oracle.
 *
 * Chrome reports every longhand, logical and physical alike, in its own serialisation; the engine
 * has React Native's props, some of them one prop for several CSS properties. So each property is
 * read from the props that can hold it, in the order native reads them, and compared by the kind
 * of value it is. Chrome's logical properties are the physical ones again in a left-to-right,
 * horizontal layout, which is the only one compared, so only the physical ones are read.
 */

import { createRequire } from 'node:module';

const { compileCss } = createRequire(import.meta.url)('@solid-native/metro/css/compile.cjs') as {
  compileCss(css: string, context: string): { rules: { declarations: Record<string, unknown> }[] };
};

type Style = Readonly<Record<string, unknown>>;

/** How one property compares: the verdict, and what each side said, for a failure's message. */
export type Verdict =
  { readonly agrees: true } | { readonly agrees: false; readonly ours: unknown };

/** Chrome's logical duplicates of physical properties, and its `-webkit-` mirrors. */
const DUPLICATE =
  /^(-webkit-|inline-size|block-size|(min|max)-(inline|block)-size|(margin|padding|inset|scroll-margin|scroll-padding)-(inline|block)|border-(inline|block)|border-(start|end)-(start|end)-radius|overflow-(inline|block)|overscroll-behavior-(inline|block)|text-decoration$|font-variant$|contain-intrinsic-(inline|block))/;

/** True for a property Chrome reports that is another's duplicate, so compared as that one. */
export const isDuplicate = (property: string) => DUPLICATE.test(property);

/** The props a CSS property can be in, in the order native reads them. */
const EDGES: Record<string, readonly string[]> = {
  top: ['Top', 'Vertical', ''],
  right: ['End', 'Right', 'Horizontal', ''],
  bottom: ['Bottom', 'Vertical', ''],
  left: ['Start', 'Left', 'Horizontal', ''],
};

function first(style: Style, keys: readonly string[]): unknown {
  for (const key of keys) if (style[key] !== undefined) return style[key];
  return undefined;
}

const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Our value for one CSS property, read as native would read it. */
// eslint-disable-next-line complexity -- one flat case per family of properties
export function ours(style: Style, property: string): unknown {
  const edge = /^(padding|margin)-(top|right|bottom|left)$/.exec(property);
  if (edge)
    return first(
      style,
      EDGES[edge[2]!]!.map((suffix) => `${edge[1]}${suffix}`),
    );
  const border = /^border-(top|right|bottom|left)-(color|width|style)$/.exec(property);
  if (border) {
    const part = border[2] === 'color' ? 'Color' : border[2] === 'width' ? 'Width' : 'Style';
    // Native's default style is solid, which is what an unset one draws.
    if (part === 'Style') return style['borderStyle'] ?? 'solid';
    const side = {
      top: ['BlockStart', 'Block', 'Top'],
      right: ['End', 'Right'],
      bottom: ['BlockEnd', 'Block', 'Bottom'],
      left: ['Start', 'Left'],
    };
    return first(style, [
      ...side[border[1] as keyof typeof side].map((s) => `border${s}${part}`),
      `border${part}`,
    ]);
  }
  const corner = /^border-(top|bottom)-(left|right)-radius$/.exec(property);
  if (corner) {
    const [v, h] = [
      corner[1] === 'top' ? 'Top' : 'Bottom',
      corner[2] === 'left' ? 'Left' : 'Right',
    ];
    const [block, inline] = [v === 'Top' ? 'Start' : 'End', h === 'Left' ? 'Start' : 'End'];
    return first(style, [
      `border${block}${inline}Radius`,
      `border${v}${inline}Radius`,
      `border${v}${h}Radius`,
      'borderRadius',
    ]);
  }
  switch (property) {
    case 'left':
      return first(style, ['start', 'left']);
    case 'right':
      return first(style, ['end', 'right']);
    case 'row-gap':
      return first(style, ['rowGap', 'gap']);
    case 'column-gap':
      return first(style, ['columnGap', 'gap']);
    case 'overflow-x':
    case 'overflow-y':
      return style['overflow'];
    case 'translate':
      return style['__translate'];
    case 'rotate':
      return style['__rotate'];
    case 'scale':
      return style['__scale'];
    case 'background-image':
      return style['experimental_backgroundImage'];
    case 'background-position':
      return style['experimental_backgroundPosition'];
    case 'background-size':
      return style['experimental_backgroundSize'];
    case 'background-repeat':
      return style['experimental_backgroundRepeat'];
    case 'object-fit':
      return style['resizeMode'] ?? style['objectFit'];
    case 'text-wrap-mode':
      return style['numberOfLines'];
    case 'user-select':
      return style['selectable'];
    case 'text-overflow':
      return style['ellipsizeMode'];
    case 'animation-name':
    case 'animation-duration':
    case 'animation-timing-function':
    case 'animation-iteration-count':
    case 'animation-delay':
      return style['$animation'];
    case 'font-variant-numeric':
      return style['fontVariant'];
    case 'vertical-align':
      return style['textAlignVertical'];
    case 'text-decoration-line':
      return style['textDecorationLine'];
    case 'transition-duration':
      return style['$transitionDuration'] ?? style['$transition'];
    case 'transition-timing-function':
      return style['$transitionEasing'] ?? style['$transition'];
    case 'transition-delay':
      return style['$transitionDelay'] ?? style['$transition'];
    case 'transition-property':
      return style['$transition'];
    default:
      return style[camel(property)];
  }
}

const LENGTH =
  /^(width|height|(min|max)-(width|height)|(margin|padding)-(top|right|bottom|left)|top|right|bottom|left|(row|column)-gap|flex-basis|border-(top|right|bottom|left)-width|border-(top|bottom)-(left|right)-radius|font-size|line-height|letter-spacing|outline-width|outline-offset)$/;
const COLOUR = /-color$|^color$/;
const NUMBER = /^(opacity|z-index|flex-grow|flex-shrink|order)$/;

/** Keywords that mean the same on both sides, where the spelling differs. */
const SAME_KEYWORD: Record<string, Record<string, readonly unknown[]>> = {
  display: { block: ['flex', undefined], flex: ['flex'], none: ['none'], contents: ['contents'] },
  'justify-content': {
    start: ['flex-start'],
    end: ['flex-end'],
    left: ['flex-start'],
    right: ['flex-end'],
    normal: ['flex-start', undefined],
  },
  'align-items': {
    start: ['flex-start'],
    end: ['flex-end'],
    'self-start': ['flex-start'],
    'self-end': ['flex-end'],
  },
  'align-self': {
    start: ['flex-start'],
    end: ['flex-end'],
    'self-start': ['flex-start'],
    'self-end': ['flex-end'],
  },
  'align-content': { start: ['flex-start'], end: ['flex-end'], normal: ['stretch', undefined] },
  'font-weight': {},
};

/** Whether the two agree on one property. */
// eslint-disable-next-line complexity -- one flat case per kind of CSS value
export function compare(property: string, browser: string, style: Style, box: number): Verdict {
  const value = ours(style, property);
  const verdict = (same: boolean): Verdict =>
    same ? { agrees: true } : { agrees: false, ours: value };
  if (property === 'box-shadow') return verdict(sameShadows(browser, value));
  if (property === 'filter') return verdict(sameFilters(browser, value));
  if (property === 'translate') return verdict(sameTranslate(browser, value));
  if (property === 'scale') return verdict(sameScale(browser, value));
  if (property === 'rotate') return verdict(sameRotate(browser, value));
  if (property === 'transform') return verdict(sameTransform(browser, value, box));
  if (property.startsWith('transition-')) return verdict(sameTransition(property, browser, value));
  const side = /^border-(top|right|bottom|left)-style$/.exec(property)?.[1];
  if (side) {
    // Native has no style that hides a border; `none` and `hidden` are compiled to no width.
    if (browser === 'none' || browser === 'hidden') {
      return verdict(ours(style, `border-${side}-width`) === 0);
    }
    return verdict(value === browser);
  }
  if (property === 'transform-origin') return verdict(sameOrigin(browser, value));
  if (property === 'object-fit') return verdict((RESIZE_MODE[browser] ?? browser) === value);
  if (property === 'user-select') return verdict(value === (browser !== 'none'));
  if (property === 'text-shadow') return verdict(sameTextShadow(browser, style));
  if (property === 'text-overflow') {
    return verdict(
      browser === 'ellipsis' ? value === undefined || value === 'tail' : value === browser,
    );
  }
  if (property === 'vertical-align') return verdict((VERTICAL[browser] ?? browser) === value);
  if (property.startsWith('animation-')) return verdict(sameAnimation(property, browser, value));
  if (property === 'background-size') return verdict(sameBackgroundSize(browser, value));
  if (property === 'background-repeat') return verdict(sameBackgroundRepeat(browser, value));
  if (property === 'background-image') return verdict(sameGradients(browser, value));
  // `nowrap` is one line, which is how native keeps text from wrapping.
  if (property === 'text-wrap-mode')
    return verdict(browser === 'nowrap' ? value === 1 : value === undefined);
  if (property === 'background-position') return verdict(samePosition(browser, value));
  if (COLOUR.test(property)) return verdict(sameColour(browser, value));
  if (LENGTH.test(property)) return verdict(sameLength(browser, value));
  if (NUMBER.test(property))
    return verdict(typeof value === 'number' && close(value, Number(browser)));
  if (property === 'font-weight') return verdict(String(value) === browser);
  if (property === 'aspect-ratio') {
    const [w, h] = browser.split('/').map(Number);
    return verdict(typeof value === 'number' && close(value, w! / (h ?? 1)));
  }
  if (property === 'font-family')
    return verdict(value === browser.split(',')[0]!.trim().replace(/^"|"$/g, ''));
  if (property === 'font-variant-numeric') {
    return verdict(Array.isArray(value) && value.join(' ') === browser);
  }
  const alias = SAME_KEYWORD[property]?.[browser];
  if (alias) return verdict(alias.includes(value));
  return verdict(value === browser);
}

const close = (a: number, b: number, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

/** `object-fit` as the `resizeMode` an image takes. */
const RESIZE_MODE: Record<string, string> = { fill: 'stretch' };

/** `vertical-align` as the `textAlignVertical` a text takes. */
const VERTICAL: Record<string, string> = { middle: 'center' };

/** `rgba(0, 0, 0, 0.15) 0px 1px 0px`, against native's three text-shadow props. */
function sameTextShadow(browser: string, style: Style): boolean {
  const [shadow] = shadows(browser);
  if (!shadow) return style['textShadowColor'] === undefined;
  const offset = style['textShadowOffset'] as { width: number; height: number } | undefined;
  return (
    offset !== undefined &&
    close(offset.width, shadow.x!) &&
    close(offset.height, shadow.y!) &&
    close(Number(style['textShadowRadius'] ?? 0), shadow.blur ?? 0) &&
    sameColour(shadow.colour, style['textShadowColor'])
  );
}

/** `50% 100%` or `13px 50%`, against native's `[x, y, z]`, lengths as numbers. */
function sameOrigin(browser: string, value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const parts = browser.split(/\s+/);
  return parts.every((part, i) => {
    const mine = value[i];
    if (part.endsWith('%')) return mine === part || (part === '0%' && mine === 0);
    return typeof mine === 'number' && close(mine, parseFloat(part));
  });
}

/** `50% 100%` against native's `[{ left, top }]`. */
function samePosition(browser: string, value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 1) return false;
  const [x, y] = browser.split(/\s+/);
  const edges = value[0] as { left?: unknown; top?: unknown; right?: unknown; bottom?: unknown };
  // An offset from the far edge is the same place as its complement from the near one.
  const far = (offset: unknown) => (offset === 0 ? '100%' : undefined);
  const left = edges.left ?? far(edges.right);
  const top = edges.top ?? far(edges.bottom);
  const same = (theirs: string | undefined, mine: unknown) =>
    theirs?.endsWith('%')
      ? mine === theirs || (parseFloat(theirs) === 0 && mine === 0)
      : typeof mine === 'number' && close(mine, parseFloat(theirs ?? ''));
  return same(x, left) && same(y, top);
}

/** `cover`, or `13px auto`, against native's `["cover"]` or `[{ x, y }]`. */
function sameBackgroundSize(browser: string, value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 1) return false;
  const [layer] = value as unknown[];
  if (typeof layer === 'string') return layer === browser;
  const [x, y = 'auto'] = browser.split(/\s+/);
  const { x: mx, y: my } = layer as { x: unknown; y: unknown };
  const same = (theirs: string, mine: unknown) =>
    theirs === 'auto' || theirs.endsWith('%')
      ? mine === theirs
      : typeof mine === 'number' && close(mine, parseFloat(theirs));
  return same(x!, mx) && same(y, my);
}

/** `repeat-x` or `no-repeat`, against native's `[{ x, y }]`. */
function sameBackgroundRepeat(browser: string, value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 1) return false;
  const { x, y } = value[0] as { x: unknown; y: unknown };
  const [bx, by = bx] =
    browser === 'repeat-x'
      ? ['repeat', 'no-repeat']
      : browser === 'repeat-y'
        ? ['no-repeat', 'repeat']
        : browser.split(/\s+/);
  return x === bx && y === by;
}

/** A gradient's kind and its stops' colours, which is what paints; direction and shape aside. */
function sameGradients(browser: string, value: unknown): boolean {
  const layers = (Array.isArray(value) ? value : []) as {
    type: string;
    colorStops: { color: unknown }[];
  }[];
  const theirs = functions(browser);
  return (
    theirs.length === layers.length &&
    theirs.every(([name, args], i) => {
      const layer = layers[i]!;
      if (layer.type !== name) return false;
      const colours = args.match(/~?rgba?\([^)]*\)/g) ?? [];
      return (
        colours.length === layer.colorStops.length &&
        colours.every((colour, j) => sameColour(colour, layer.colorStops[j]!.color))
      );
    })
  );
}

/** An `animation-*` longhand, against the one spec native's `$animation` holds. */
function sameAnimation(property: string, browser: string, value: unknown): boolean {
  const spec = value as
    | { name: string; duration: number; delay: number; easing: number[]; iterations: number | null }
    | undefined;
  if (!spec) return false;
  const seconds = (text: string) =>
    text.endsWith('ms') ? parseFloat(text) : parseFloat(text) * 1000;
  switch (property) {
    case 'animation-name':
      return spec.name === browser;
    case 'animation-duration':
      return close(spec.duration, seconds(browser));
    case 'animation-delay':
      return close(spec.delay, seconds(browser));
    case 'animation-iteration-count':
      // `null` is native's forever.
      return browser === 'infinite'
        ? spec.iterations === null
        : close(Number(spec.iterations), Number(browser));
    default: {
      const curve = curveOf(browser);
      return curve?.every((n, i) => close(spec.easing[i]!, n, 0.001)) === true;
    }
  }
}

/** Tailwind's `calc(infinity * 1px)`, which each side clamps to its own largest length. */
const INFINITE = 1e6;

function sameLength(browser: string, value: unknown): boolean {
  if (browser === 'auto' || browser === 'normal' || browser === 'none') {
    return value === undefined || value === browser;
  }
  if (browser.endsWith('%')) {
    return (
      typeof value === 'string' &&
      value.endsWith('%') &&
      close(parseFloat(value), parseFloat(browser), 0.001)
    );
  }
  if (browser.endsWith('px')) {
    if (typeof value !== 'number') return false;
    const theirs = parseFloat(browser);
    return (theirs >= INFINITE && value >= INFINITE) || close(value, theirs);
  }
  return false;
}

/**
 * The browser's colour against ours. Exact, unless the browser's is marked `~`: converted out of
 * a wider space, where Chrome clips an out-of-gamut colour and the compiler maps it into gamut, so
 * the most saturated of Tailwind's palette come out a few units apart per channel.
 */
export function sameColour(browser: string, value: unknown): boolean {
  const channels = (colour: string) => colour.match(/[\d.]+/g)!.map(Number);
  if (typeof value !== 'string') return false;
  const normal = named(value);
  if (!/^rgba?\(/.test(normal)) return false;
  const [a, b] = [channels(browser), channels(normal)];
  if (a.length === 3) a.push(1);
  if (b.length === 3) b.push(1);
  const tolerance = browser.startsWith('~') ? 8 : 1;
  return a.every((channel, i) => close(channel, b[i]!, i === 3 ? 0.01 : tolerance));
}

const NAMED: Record<string, string> = {
  black: 'rgb(0, 0, 0)',
  white: 'rgb(255, 255, 255)',
  transparent: 'rgba(0, 0, 0, 0)',
};
const named = (value: string) => NAMED[value] ?? value;

/** Chrome's shadow list, `rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, ...`, as ours would be. */
function shadows(value: string) {
  if (value === 'none') return [];
  return value
    .split(/,(?![^(]*\))/)
    .map((one) => {
      const colour = /~?rgba?\([^)]*\)/.exec(one)?.[0] ?? 'rgb(0, 0, 0)';
      const [x, y, blur, spread] = one
        .replace(colour, '')
        .match(/-?[\d.]+px/g)!
        .map(parseFloat);
      return { x, y, blur, spread: spread ?? 0, colour, inset: /\binset\b/.test(one) };
    })
    .filter((shadow) => !/^~?rgba\(.*,\s*0\)$/.test(shadow.colour));
}

function sameShadows(browser: string, value: unknown): boolean {
  const expected = shadows(browser);
  const actual = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  return (
    expected.length === actual.length &&
    expected.every(
      (shadow, i) =>
        shadow.x === actual[i]!['offsetX'] &&
        shadow.y === actual[i]!['offsetY'] &&
        shadow.blur === actual[i]!['blurRadius'] &&
        shadow.spread === actual[i]!['spreadDistance'] &&
        shadow.inset === Boolean(actual[i]!['inset']) &&
        sameColour(shadow.colour, actual[i]!['color']),
    )
  );
}

/** A list of CSS functions, `blur(8px) grayscale(1)`, as `[name, args]` pairs. */
function functions(value: string): [string, string][] {
  return [...value.matchAll(/([\w-]+)\(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => [
    m[1]!,
    m[2]!.trim(),
  ]);
}

function sameFilters(browser: string, value: unknown): boolean {
  if (browser === 'none')
    return value === undefined || (Array.isArray(value) && value.length === 0);
  const expected = functions(browser);
  const actual = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  return (
    expected.length === actual.length &&
    expected.every(([name, args], i) => {
      const entry = actual[i]!;
      const key = camel(name);
      if (!(key in entry)) return false;
      const ours = entry[key];
      if (name === 'drop-shadow') return sameDropShadow(args, ours);
      const number = parseFloat(args);
      const theirs = args.endsWith('%') ? number / 100 : number;
      return typeof ours === 'number' && close(ours, theirs, 0.001);
    })
  );
}

/**
 * Chrome's `drop-shadow(rgba(0, 0, 0, 0.15) 0px 4px 4px)` against ours. The blur is the length
 * CSS writes, which native takes as its standard deviation unchanged, as React Native's own does.
 */
function sameDropShadow(args: string, value: unknown): boolean {
  const [shadow] = shadows(args);
  const ours = value as Record<string, unknown> | undefined;
  if (!shadow || !ours) return !shadow && !ours;
  return (
    shadow.x === ours['offsetX'] &&
    shadow.y === ours['offsetY'] &&
    shadow.blur === (ours['standardDeviation'] ?? 0) &&
    sameColour(shadow.colour, ours['color'] ?? 'black')
  );
}

const px = (text: string) => (text.endsWith('%') ? text : parseFloat(text));

function sameTranslate(browser: string, value: unknown): boolean {
  const [x = '0px', y = '0px'] = browser.split(/\s+/);
  const list = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  const get = (key: string) => list.find((op) => key in op)?.[key] ?? 0;
  const same = (theirs: string, mine: unknown) => {
    const want = px(theirs);
    if (typeof want === 'number') return typeof mine === 'number' && close(mine, want);
    return (
      typeof mine === 'string' && mine.endsWith('%') && close(parseFloat(mine), parseFloat(want))
    );
  };
  return same(x, get('translateX')) && same(y, get('translateY'));
}

function sameScale(browser: string, value: unknown): boolean {
  const [x, y = x] = browser.split(/\s+/).map(Number);
  const list = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  const get = (key: string) =>
    list.find((op) => key in op)?.[key] ?? list.find((op) => 'scale' in op)?.['scale'] ?? 1;
  return close(Number(get('scaleX')), x!, 0.001) && close(Number(get('scaleY')), y!, 0.001);
}

function sameRotate(browser: string, value: unknown): boolean {
  const list = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  const [angle] = functions(`r(${browser})`).map(([, args]) => args);
  const mine = list.map((op) => Object.values(op)[0]).find((v) => typeof v === 'string');
  return (
    typeof mine === 'string' &&
    close(parseFloat(mine), parseFloat(angle!.split(/\s+/).pop()!), 0.001)
  );
}

/**
 * Chrome's `transform`, the matrix a rendered element's comes to, against the one ours comes to.
 * A percentage in a translate is a share of the box it was measured on.
 */
function sameTransform(browser: string, value: unknown, box: number): boolean {
  const list = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  const theirs = browser === 'none' ? identity() : parseMatrix(browser);
  const mine = list.reduce((m, op) => multiply(m, operation(op, box)), identity());
  return (
    theirs !== null && theirs.every((n, i) => close(n, mine[i]!, 1e-3 * Math.max(1, Math.abs(n))))
  );
}

type Matrix = number[];

const identity = (): Matrix => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** `matrix(a, b, c, d, e, f)` or `matrix3d(...)`, column-major, as CSS writes them. */
function parseMatrix(text: string): Matrix | null {
  const numbers = text.match(/-?[\d.]+(e-?\d+)?/g)?.map(Number);
  if (!numbers) return null;
  if (text.startsWith('matrix3d')) return numbers.slice(1);
  const [a, b, c, d, e, f] = numbers;
  return [a!, b!, 0, 0, c!, d!, 0, 0, 0, 0, 1, 0, e!, f!, 0, 1];
}

/** Column-major `a * b`: b applied first, as a transform list reads left to right. */
function multiply(a: Matrix, b: Matrix): Matrix {
  const out: Matrix = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[col * 4 + row]! += a[k * 4 + row]! * b[col * 4 + k]!;
    }
  }
  return out;
}

const radians = (angle: unknown) => {
  const text = String(angle);
  const n = parseFloat(text);
  return text.endsWith('rad') ? n : text.endsWith('turn') ? n * 2 * Math.PI : (n * Math.PI) / 180;
};

/** One operation of a React Native transform list, as a matrix. */
// eslint-disable-next-line complexity -- one flat case per operation
function operation(op: Record<string, unknown>, box: number): Matrix {
  const [name, raw] = Object.entries(op)[0] ?? ['', 0];
  const length = (v: unknown) =>
    typeof v === 'string' && v.endsWith('%') ? (parseFloat(v) / 100) * box : Number(v);
  const m = identity();
  switch (name) {
    case 'translateX':
      m[12] = length(raw);
      return m;
    case 'translateY':
      m[13] = length(raw);
      return m;
    case 'translateZ':
      m[14] = length(raw);
      return m;
    case 'scale':
      m[0] = m[5] = Number(raw);
      return m;
    case 'scaleX':
      m[0] = Number(raw);
      return m;
    case 'scaleY':
      m[5] = Number(raw);
      return m;
    case 'rotate':
    case 'rotateZ': {
      const r = radians(raw);
      [m[0], m[1], m[4], m[5]] = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r)];
      return m;
    }
    case 'rotateX': {
      const r = radians(raw);
      [m[5], m[6], m[9], m[10]] = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r)];
      return m;
    }
    case 'rotateY': {
      const r = radians(raw);
      [m[0], m[2], m[8], m[10]] = [Math.cos(r), -Math.sin(r), Math.sin(r), Math.cos(r)];
      return m;
    }
    case 'skewX':
      m[4] = Math.tan(radians(raw));
      return m;
    case 'skewY':
      m[1] = Math.tan(radians(raw));
      return m;
    case 'perspective':
      m[11] = -1 / Number(raw);
      return m;
    case 'matrix':
      return (raw as number[]).length === 16
        ? [...(raw as number[])]
        : parseMatrix(`matrix(${String(raw)})`)!;
    default:
      return [NaN];
  }
}

/** A transition longhand, against the one spec ours holds per property. */
function sameTransition(property: string, browser: string, value: unknown): boolean {
  if (property === 'transition-property') return sameTransitionProperties(browser, value);
  const first = browser.split(/,(?![^(]*\))/)[0]!.trim();
  const ms = first.endsWith('ms') ? parseFloat(first) : parseFloat(first) * 1000;
  const curve = curveOf(first);
  const key =
    property === 'transition-duration'
      ? 'duration'
      : property === 'transition-delay'
        ? 'delay'
        : 'easing';
  const same = (part: unknown) =>
    key === 'easing'
      ? Array.isArray(part) && curve?.every((n, i) => close(part[i] as number, n, 0.001)) === true
      : typeof part === 'number' && close(part, ms);
  // A timing class on its own holds one part; a transition holds a spec per property.
  if (!value || typeof value !== 'object' || Array.isArray(value)) return same(value);
  const entries = Object.values(value as Record<string, Record<string, unknown>>);
  return entries.length > 0 && entries.every((entry) => same(entry[key]));
}

/**
 * Chrome's `transition-property` list against the props the node's transition is keyed by. The
 * list is compiled on its own to find the props its names stand for: that names them as the
 * compiler does, and what is checked here is that the cascade picked the right list.
 */
function sameTransitionProperties(browser: string, value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const [rule] = compileCss(`.x { transition-property: ${browser} }`, 'transition-property').rules;
  const expected = Object.keys((rule?.declarations['$transition'] ?? {}) as object).sort();
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected);
}

/**
 * Chrome's translate, rotate, scale and transform, put together in the order CSS applies them,
 * against the one list the engine committed: the same matrix, or not.
 */
export function sameComposedTransform(
  chrome: Readonly<Record<string, string>>,
  committed: unknown,
  box: number,
): boolean {
  const parts: [string, (text: string) => Matrix | null][] = [
    ['translate', (text) => translation(text, box)],
    ['rotate', rotation],
    ['scale', scaling],
    ['transform', parseMatrix],
  ];
  let theirs = identity();
  for (const [property, read] of parts) {
    const text = chrome[property];
    if (!text || text === 'none') continue;
    const m = read(text);
    if (m === null) return false;
    theirs = multiply(theirs, m);
  }
  const list = (Array.isArray(committed) ? committed : []) as Record<string, unknown>[];
  const mine = list.reduce((m, op) => multiply(m, operation(op, box)), identity());
  return theirs.every((n, i) => close(n, mine[i]!, 1e-3 * Math.max(1, Math.abs(n))));
}

/** `8px 16px`, or `50% 0`: a translation, a percentage a share of the box. */
function translation(text: string, box: number): Matrix {
  const length = (part: string) =>
    part.endsWith('%') ? (parseFloat(part) / 100) * box : parseFloat(part);
  const [x = '0px', y = '0px', z = '0px'] = text.split(/\s+/);
  const m = identity();
  [m[12], m[13], m[14]] = [length(x), length(y), length(z)];
  return m;
}

/** `0.5`, or `0.5 0.75`: a scale, the second axis the first where it is left out. */
function scaling(text: string): Matrix {
  const [x, y = x, z = '1'] = text.split(/\s+/);
  const m = identity();
  [m[0], m[5], m[10]] = [Number(x), Number(y), Number(z)];
  return m;
}

/** `45deg`, or `x 12deg`, or `0 0 1 45deg`: a rotation about an axis, as a matrix. */
function rotation(text: string): Matrix {
  const parts = text.split(/\s+/);
  const angle = parts.pop()!;
  const axis = parts.join(' ');
  if (axis === 'x' || axis === '1 0 0') return operation({ rotateX: angle }, 0);
  if (axis === 'y' || axis === '0 1 0') return operation({ rotateY: angle }, 0);
  return operation({ rotateZ: angle }, 0);
}

/** The keywords CSS names timing curves by, as the curves. */
const CURVES: Record<string, number[]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

/** A timing function as its curve: a keyword, or `cubic-bezier()`. */
function curveOf(text: string): number[] | undefined {
  return CURVES[text] ?? functions(text)[0]?.[1].split(',').map(Number);
}
