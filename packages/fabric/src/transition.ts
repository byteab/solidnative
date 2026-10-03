/**
 * CSS transitions, the runtime half.
 *
 * React Native has no CSS animation of any kind, so a `transition` in a stylesheet is compiled to
 * a spec and driven here: the engine notices a transitioning property change between commits,
 * holds the old value, and interpolates towards the new one as the clock advances.
 *
 * This runs in JavaScript, unlike `AnimatedStyle`, which can hand a whole animation to the native
 * driver. It has to: a transition is a reaction to the cascade recomputing, and only this side
 * knows a value changed at all. The cost is a commit per frame, which is the same cost a
 * JavaScript-driven `Animated` value has.
 */

/** What the CSS compiler emits per transitioning property. Durations are in milliseconds. */
export interface TransitionSpec {
  readonly duration: number;
  readonly delay: number;
  /** The four control points of the timing curve; a keyword is resolved at build time. */
  readonly easing: readonly number[];
}

export interface Transition {
  from: unknown;
  to: unknown;
  /** When the interpolation starts, delay already added. */
  start: number;
  duration: number;
  easing: readonly number[];
  /** What the node paints right now. Also the value a redirected transition starts from. */
  current: unknown;
  done: boolean;
}

/**
 * A cubic bezier's y at a given x, by bisection.
 *
 * Newton-Raphson converges faster and is what browsers use, but it needs a derivative and a
 * fallback for the flat regions of a curve like `ease-in`. Twenty bisection steps land within
 * 1e-6 on any curve, which is finer than a pixel, and the whole thing is eight lines.
 */
const curve = (t: number, a: number, b: number): number => {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
};

/** A linear curve is both the default and by far the most common, so it skips the search. */
const isLinear = (p: readonly number[]): boolean =>
  p[0] === 0 && p[1] === 0 && p[2] === 1 && p[3] === 1;

export function bezier(points: readonly number[], x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (isLinear(points)) return x;

  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = points;
  let low = 0;
  let high = 1;
  let t = x;
  for (let i = 0; i < 20; i++) {
    t = (low + high) / 2;
    if (curve(t, x1, x2) < x) low = t;
    else high = t;
  }
  return curve(t, y1, y2);
}

const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i;

/**
 * Every CSS named colour, as the `[r, g, b, a]` the compiler's own `namedColor()` in
 * `packages/metro/css/values.cjs` resolves it to - generated from that table rather than typed
 * out by hand, so there is one authority for what a colour name means and this cannot drift from
 * it. The compiler folds a named colour in a stylesheet into `rgb()` at build time, which is why
 * this table matters only for the rarer case: a value that reaches here without ever having been
 * through the compiler, such as a template binding a keyword straight into a style.
 */
const NAMED_COLORS: Record<string, [number, number, number, number]> = {
  aliceblue: [240, 248, 255, 1],
  antiquewhite: [250, 235, 215, 1],
  aqua: [0, 255, 255, 1],
  aquamarine: [127, 255, 212, 1],
  azure: [240, 255, 255, 1],
  beige: [245, 245, 220, 1],
  bisque: [255, 228, 196, 1],
  black: [0, 0, 0, 1],
  blanchedalmond: [255, 235, 205, 1],
  blue: [0, 0, 255, 1],
  blueviolet: [138, 43, 226, 1],
  brown: [165, 42, 42, 1],
  burlywood: [222, 184, 135, 1],
  cadetblue: [95, 158, 160, 1],
  chartreuse: [127, 255, 0, 1],
  chocolate: [210, 105, 30, 1],
  coral: [255, 127, 80, 1],
  cornflowerblue: [100, 149, 237, 1],
  cornsilk: [255, 248, 220, 1],
  crimson: [220, 20, 60, 1],
  cyan: [0, 255, 255, 1],
  darkblue: [0, 0, 139, 1],
  darkcyan: [0, 139, 139, 1],
  darkgoldenrod: [184, 134, 11, 1],
  darkgray: [169, 169, 169, 1],
  darkgreen: [0, 100, 0, 1],
  darkgrey: [169, 169, 169, 1],
  darkkhaki: [189, 183, 107, 1],
  darkmagenta: [139, 0, 139, 1],
  darkolivegreen: [85, 107, 47, 1],
  darkorange: [255, 140, 0, 1],
  darkorchid: [153, 50, 204, 1],
  darkred: [139, 0, 0, 1],
  darksalmon: [233, 150, 122, 1],
  darkseagreen: [143, 188, 143, 1],
  darkslateblue: [72, 61, 139, 1],
  darkslategray: [47, 79, 79, 1],
  darkslategrey: [47, 79, 79, 1],
  darkturquoise: [0, 206, 209, 1],
  darkviolet: [148, 0, 211, 1],
  deeppink: [255, 20, 147, 1],
  deepskyblue: [0, 191, 255, 1],
  dimgray: [105, 105, 105, 1],
  dimgrey: [105, 105, 105, 1],
  dodgerblue: [30, 144, 255, 1],
  firebrick: [178, 34, 34, 1],
  floralwhite: [255, 250, 240, 1],
  forestgreen: [34, 139, 34, 1],
  fuchsia: [255, 0, 255, 1],
  gainsboro: [220, 220, 220, 1],
  ghostwhite: [248, 248, 255, 1],
  gold: [255, 215, 0, 1],
  goldenrod: [218, 165, 32, 1],
  gray: [128, 128, 128, 1],
  green: [0, 128, 0, 1],
  greenyellow: [173, 255, 47, 1],
  grey: [128, 128, 128, 1],
  honeydew: [240, 255, 240, 1],
  hotpink: [255, 105, 180, 1],
  indianred: [205, 92, 92, 1],
  indigo: [75, 0, 130, 1],
  ivory: [255, 255, 240, 1],
  khaki: [240, 230, 140, 1],
  lavender: [230, 230, 250, 1],
  lavenderblush: [255, 240, 245, 1],
  lawngreen: [124, 252, 0, 1],
  lemonchiffon: [255, 250, 205, 1],
  lightblue: [173, 216, 230, 1],
  lightcoral: [240, 128, 128, 1],
  lightcyan: [224, 255, 255, 1],
  lightgoldenrodyellow: [250, 250, 210, 1],
  lightgray: [211, 211, 211, 1],
  lightgreen: [144, 238, 144, 1],
  lightgrey: [211, 211, 211, 1],
  lightpink: [255, 182, 193, 1],
  lightsalmon: [255, 160, 122, 1],
  lightseagreen: [32, 178, 170, 1],
  lightskyblue: [135, 206, 250, 1],
  lightslategray: [119, 136, 153, 1],
  lightslategrey: [119, 136, 153, 1],
  lightsteelblue: [176, 196, 222, 1],
  lightyellow: [255, 255, 224, 1],
  lime: [0, 255, 0, 1],
  limegreen: [50, 205, 50, 1],
  linen: [250, 240, 230, 1],
  magenta: [255, 0, 255, 1],
  maroon: [128, 0, 0, 1],
  mediumaquamarine: [102, 205, 170, 1],
  mediumblue: [0, 0, 205, 1],
  mediumorchid: [186, 85, 211, 1],
  mediumpurple: [147, 112, 219, 1],
  mediumseagreen: [60, 179, 113, 1],
  mediumslateblue: [123, 104, 238, 1],
  mediumspringgreen: [0, 250, 154, 1],
  mediumturquoise: [72, 209, 204, 1],
  mediumvioletred: [199, 21, 133, 1],
  midnightblue: [25, 25, 112, 1],
  mintcream: [245, 255, 250, 1],
  mistyrose: [255, 228, 225, 1],
  moccasin: [255, 228, 181, 1],
  navajowhite: [255, 222, 173, 1],
  navy: [0, 0, 128, 1],
  oldlace: [253, 245, 230, 1],
  olive: [128, 128, 0, 1],
  olivedrab: [107, 142, 35, 1],
  orange: [255, 165, 0, 1],
  orangered: [255, 69, 0, 1],
  orchid: [218, 112, 214, 1],
  palegoldenrod: [238, 232, 170, 1],
  palegreen: [152, 251, 152, 1],
  paleturquoise: [175, 238, 238, 1],
  palevioletred: [219, 112, 147, 1],
  papayawhip: [255, 239, 213, 1],
  peachpuff: [255, 218, 185, 1],
  peru: [205, 133, 63, 1],
  pink: [255, 192, 203, 1],
  plum: [221, 160, 221, 1],
  powderblue: [176, 224, 230, 1],
  purple: [128, 0, 128, 1],
  rebeccapurple: [102, 51, 153, 1],
  red: [255, 0, 0, 1],
  rosybrown: [188, 143, 143, 1],
  royalblue: [65, 105, 225, 1],
  saddlebrown: [139, 69, 19, 1],
  salmon: [250, 128, 114, 1],
  sandybrown: [244, 164, 96, 1],
  seagreen: [46, 139, 87, 1],
  seashell: [255, 245, 238, 1],
  sienna: [160, 82, 45, 1],
  silver: [192, 192, 192, 1],
  skyblue: [135, 206, 235, 1],
  slateblue: [106, 90, 205, 1],
  slategray: [112, 128, 144, 1],
  slategrey: [112, 128, 144, 1],
  snow: [255, 250, 250, 1],
  springgreen: [0, 255, 127, 1],
  steelblue: [70, 130, 180, 1],
  tan: [210, 180, 140, 1],
  teal: [0, 128, 128, 1],
  thistle: [216, 191, 216, 1],
  tomato: [255, 99, 71, 1],
  transparent: [0, 0, 0, 0],
  turquoise: [64, 224, 208, 1],
  violet: [238, 130, 238, 1],
  wheat: [245, 222, 179, 1],
  white: [255, 255, 255, 1],
  whitesmoke: [245, 245, 245, 1],
  yellow: [255, 255, 0, 1],
  yellowgreen: [154, 205, 50, 1],
};

/** A colour as `[r, g, b, a]`, or null for a form not worth parsing. */
export function parseColor(value: unknown): [number, number, number, number] | null {
  if (typeof value !== 'string') return null;

  const rgb = RGB.exec(value);
  if (rgb) {
    return [
      Number(rgb[1]),
      Number(rgb[2]),
      Number(rgb[3]),
      rgb[4] === undefined ? 1 : Number(rgb[4]),
    ];
  }

  const hex = HEX.exec(value);
  if (hex) {
    const digits = hex[1]!;
    const short = digits.length <= 4;
    const part = (i: number): number => {
      const at = short ? digits.slice(i, i + 1).repeat(2) : digits.slice(i * 2, i * 2 + 2);
      return parseInt(at, 16);
    };
    const alpha = digits.length === 4 || digits.length === 8 ? part(3) / 255 : 1;
    return [part(0), part(1), part(2), alpha];
  }

  const named = NAMED_COLORS[value.toLowerCase()];
  return named ? [...named] : null;
}

/** Whether a word is a CSS colour name, such as `red` or `transparent`. */
export function isNamedColor(value: string): boolean {
  return Object.hasOwn(NAMED_COLORS, value.toLowerCase());
}

/** A transform operation at rest, so a missing transform can be animated from rather than jumped. */
const IDENTITY: Record<string, number | string> = {
  translateX: 0,
  translateY: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotate: '0deg',
  rotateX: '0deg',
  rotateY: '0deg',
  rotateZ: '0deg',
  skewX: '0deg',
  skewY: '0deg',
};

/**
 * A number with a unit on it, inside a transform operation.
 *
 * Angles were the only unit this matched, which quietly made every other one step instead of
 * move: a sheet sliding in with `translateY(100%)` sat at 100% for its whole duration and then
 * arrived, which on a phone reads as an animation that does not run at all. Percentages are the
 * ones that matter - they are how a transform says "my own size" without knowing what that is -
 * and lengths cost nothing extra now the shape is the same.
 */
const UNIT = /^(-?\d*\.?\d+)(deg|rad|grad|turn|%|px|pt|em|rem)$/;

/** One operation's value: a number, or a number keeping whatever unit it was written in. */
export function tween(from: unknown, to: unknown, t: number): unknown {
  if (typeof from === 'number' && typeof to === 'number') return from + (to - from) * t;
  if (typeof from !== 'string' || typeof to !== 'string') return null;

  const a = UNIT.exec(from);
  const b = UNIT.exec(to);
  // Matching units only. Converting between them needs a table, and for the pairs anybody
  // actually writes - `0deg` to `1turn`, `0%` to `10px` - the answer would be a guess.
  if (!a || !b || a[2] !== b[2]) return null;

  const value = Number(a[1]) + (Number(b[1]) - Number(a[1])) * t;
  return `${Math.round(value * 1000) / 1000}${a[2]}`;
}

/** The same operations, each at rest: what CSS's `none` means beside a list that has values. */
function atRest(shape: readonly unknown[]): unknown[] {
  return shape.map((entry) => {
    const name = operation(entry);
    if (name === null || !(name in IDENTITY)) return entry;
    // At rest in the unit it is written in, so it can be eased toward: `-25%` from `0%`, and
    // `1turn` from `0turn`. A bare 0 beside a percentage is a pair `tween` cannot blend.
    const written = (entry as Record<string, unknown>)[name];
    const unit = typeof written === 'string' ? UNIT.exec(written)?.[2] : undefined;
    return { [name]: unit ? `0${unit}` : IDENTITY[name] };
  });
}

/** A transform list with something in it; `none` is an empty one, and means the same as none. */
const hasOperations = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value) && value.length > 0;

/** The name of a single-key transform operation, or null for anything else. */
function operation(entry: unknown): string | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const keys = Object.keys(entry);
  return keys.length === 1 ? keys[0]! : null;
}

/**
 * Two transform lists blended operation by operation.
 *
 * Matched by position *and* name: blending a translate into a scale would mean decomposing a
 * matrix, which is a great deal of arithmetic for a case an author can always write out. Anything
 * that does not line up returns null and steps instead, which is what CSS falls back to.
 *
 * A missing side is the ordinary case rather than the exception - `.slider` to
 * `.slider-end { transform: translateX(180px) }`, and the same again when the class comes off -
 * so whichever side is absent is read as each operation at rest, which is CSS's `none`.
 */
function interpolateTransform(from: unknown, to: unknown, t: number): unknown[] | null {
  const shape = hasOperations(to) ? to : hasOperations(from) ? from : null;
  if (!shape) return null;

  const start = hasOperations(from) ? from : atRest(shape);
  const end = hasOperations(to) ? to : atRest(shape);
  if (start.length !== end.length) return null;

  const out: unknown[] = [];
  for (let i = 0; i < end.length; i++) {
    const name = operation(end[i]);
    if (name === null || name !== operation(start[i])) return null;
    const value = tween(
      (start[i] as Record<string, unknown>)[name],
      (end[i] as Record<string, unknown>)[name],
      t,
    );
    if (value === null) return null;
    out.push({ [name]: value });
  }
  return out;
}

/**
 * One step between two values.
 *
 * Numbers, colours and transforms interpolate. Everything else steps to the new value at the end,
 * which is what CSS does for a property it calls discrete, and is right for the keywords and
 * strings that make up most of the rest.
 */
export function interpolate(from: unknown, to: unknown, t: number): unknown {
  if (typeof from === 'number' && typeof to === 'number') return from + (to - from) * t;

  const a = parseColor(from);
  const b = parseColor(to);
  if (a && b) {
    const mix = (i: number): number => Math.round(a[i]! + (b[i]! - a[i]!) * t);
    const alpha = Math.round((a[3] + (b[3] - a[3]) * t) * 1000) / 1000;
    return `rgba(${mix(0)}, ${mix(1)}, ${mix(2)}, ${alpha})`;
  }

  const percent = interpolatePercentage(from, to, t);
  if (percent !== null) return percent;

  const transform = interpolateTransform(from, to, t);
  if (transform) return transform;

  return t >= 1 ? to : from;
}

/** `50%` -> `75%`. Both sides have to be percentages; a percentage and a length are not a scale. */
const PERCENTAGE = /^(-?[\d.]+)%$/;

function interpolatePercentage(from: unknown, to: unknown, t: number): string | null {
  if (typeof from !== 'string' || typeof to !== 'string') return null;
  const a = PERCENTAGE.exec(from);
  const b = PERCENTAGE.exec(to);
  if (!a || !b) return null;
  const value = Number(a[1]) + (Number(b[1]) - Number(a[1])) * t;
  return `${Math.round(value * 1000) / 1000}%`;
}

/**
 * Bring one property up to date, and say whether that started a transition.
 *
 * Mutates `props[key]` to what should be painted now, which for a transition in flight is the
 * value it has reached rather than the one it is heading for.
 */
export function step(
  state: Map<string, Transition>,
  key: string,
  props: Record<string, unknown>,
  rule: TransitionSpec | undefined,
  now: number,
): boolean {
  if (!rule || rule.duration <= 0) {
    // No longer transitioning: forget it, so re-adding the rule later starts fresh.
    state.delete(key);
    return false;
  }

  const seen = state.get(key);
  if (seen === undefined) {
    // First sight of the property. CSS does not animate one of these either; without the rule
    // every element would animate in from whatever the previous value happened to be.
    state.set(key, settled(props[key], rule));
    return false;
  }

  // Nothing to interpolate when one end is missing: `null` here is `auto`, or a property the
  // element no longer sets at all, and there is no value halfway between a number and "whatever
  // this works out to be". CSS refuses the same transition. Interpolating anyway held the old
  // value for the whole duration, which is how a section that opened to a height nothing had
  // measured stayed shut - and clearing a height is also what stops the layout that would have
  // corrected it, so it stayed shut rather than catching up a frame later.
  //
  // The same goes for a pair with nothing between them at all, a keyword such as `display` or
  // `flex-direction`: CSS changes it at once rather than transitioning it, and `transition: all`
  // covers it. Holding the old one for the duration kept a `display: none` on screen until the
  // end and then made it vanish.
  const started = !Object.is(seen.to, props[key]);
  if (started && !interpolable(seen.current, props[key])) {
    state.set(key, settled(props[key], rule));
    return false;
  }
  if (started) redirect(seen, props[key], rule, now);
  if (!seen.done) props[key] = seen.current;
  return started;
}

/**
 * Whether there is a pair here to interpolate at all: two numbers, two colours, two percentages,
 * or two transform lists of the same shape.
 *
 * A transform is the one thing that animates from nothing, because "no transform" has a value -
 * the identity - and `interpolateTransform` starts there. Everything else needs both ends.
 */
function interpolable(from: unknown, to: unknown): boolean {
  if (typeof from === 'number' && typeof to === 'number') return true;
  if (parseColor(from) !== null && parseColor(to) !== null) return true;
  if (interpolatePercentage(from, to, 0) !== null) return true;
  return interpolateTransform(from, to, 0) !== null;
}

/** A property seen for the first time: recorded so the next change has something to aim from. */
export function settled(value: unknown, rule: TransitionSpec): Transition {
  return {
    from: value,
    to: value,
    start: 0,
    duration: 0,
    easing: rule.easing,
    current: value,
    done: true,
  };
}

/** Aim an existing transition at a new value, starting from wherever it had got to. */
export function redirect(
  transition: Transition,
  target: unknown,
  rule: TransitionSpec,
  now: number,
): void {
  transition.from = transition.current;
  transition.to = target;
  transition.start = now + rule.delay;
  transition.duration = rule.duration;
  transition.easing = rule.easing;
  transition.done = false;
}

/** What the CSS compiler emits for `animation:`. Times are milliseconds. */
export interface AnimationSpec {
  readonly name: string;
  readonly duration: number;
  readonly delay: number;
  readonly easing: readonly number[];
  /** `Infinity` for `infinite`. */
  /** `null` is `infinite`, which is what survives being written into the bundle as JSON. */
  readonly iterations: number | null;
  readonly fill: 'none' | 'forwards' | 'backwards' | 'both';
  /** Which way each iteration plays; absent is `normal`, forwards every time. */
  readonly direction?: 'reverse' | 'alternate' | 'alternate-reverse';
  /**
   * `animation-timeline: scroll()`: played by the nearest scroll view's offset along this axis
   * rather than by the clock. See `scroll-animation.ts`.
   */
  readonly timeline?: 'x' | 'y';
  /** `animation-play-state: paused`: held at the frame it has reached, until it runs again. */
  readonly paused?: boolean;
  /**
   * Where along the scroll it plays, in points or as a percentage of how far the view scrolls.
   * An end left out is the scroll's own: 0, or all the way.
   */
  readonly range?: { readonly start?: number | string; readonly end?: number | string };
}

/** One `@keyframes` frame: where it sits, and what it sets there. */
export interface Keyframe {
  readonly offset: number;
  readonly declarations: Record<string, unknown>;
  /** The `animation-timing-function` written in this keyframe, easing it to the next. */
  readonly easing?: readonly number[];
}

export interface RunningAnimation {
  spec: AnimationSpec;
  /** When it was paused, while it is; the clock it is sampled at stands still there. */
  pausedAt?: number;
  /** Per property, the offsets that mention it, in order. Built once when the animation starts. */
  readonly tracks: Map<string, TrackPoint[]>;
  start: number;
  /** What the properties read right now. Empty once a finished animation stops filling. */
  values: Record<string, unknown>;
  done: boolean;
}

/**
 * Build one track per property the frames touch.
 *
 * A property that no frame sets at 0% or 100% is anchored to the value the element would
 * otherwise have, which is what CSS means by an implicit keyframe: `to { opacity: 1 }` alone
 * animates from wherever the element already was.
 */
export function tracksOf(
  frames: readonly Keyframe[],
  resting: Record<string, unknown>,
): Map<string, TrackPoint[]> {
  const tracks = new Map<string, TrackPoint[]>();

  for (const frame of frames) {
    for (const property of Object.keys(frame.declarations)) {
      const track = tracks.get(property) ?? [];
      const point = { offset: frame.offset, value: frame.declarations[property] };
      track.push(frame.easing ? { ...point, easing: frame.easing } : point);
      tracks.set(property, track);
    }
  }

  for (const [property, track] of tracks) {
    const anchor = resting[property] ?? INITIAL[property];
    if (track[0]!.offset > 0) track.unshift({ offset: 0, value: anchor });
    if (track[track.length - 1]!.offset < 1) {
      track.push({ offset: 1, value: anchor });
    }
  }
  return tracks;
}

/**
 * What a property is worth when the element has not said.
 *
 * CSS anchors an implicit keyframe to the element's *computed* value, and a property nobody wrote
 * still has one - `opacity` is 1, not nothing. Anchoring to nothing instead leaves a frame with no
 * value to interpolate towards, so the animation holds its first value and jumps at the end.
 *
 * That is what `animate-pulse` was doing. It is a single frame, `50% { opacity: 0.5 }`, on a
 * skeleton that declares no opacity of its own - so both of its implicit frames were empty and the
 * pulse did not fade, in every skeleton in the library.
 *
 * Only the properties that appear in an animation and have a meaningful resting value. A length
 * defaulting to zero is the same as absent for anything here, and a colour has no initial worth
 * animating from.
 */
const INITIAL: Record<string, unknown> = {
  opacity: 1,
  scale: 1,
  rotate: '0deg',
};

/**
 * Where an animation has got to, as the properties to paint.
 *
 * The easing runs per segment rather than across the whole pass, which is what CSS does with a
 * single timing function: each pair of frames is eased on its own.
 */
export function sample(
  running: RunningAnimation,
  now: number,
): { values: Record<string, unknown>; finished: boolean } {
  const { spec } = running;
  const elapsed = now - running.start - spec.delay;
  // A null count is `infinite`. Multiplying by it would give 0, which reads as an animation that
  // finished before its first frame - so an infinite animation would paint its last frame once
  // and stop, which is exactly what it did.
  const total = spec.duration * (spec.iterations ?? Infinity);
  const finished = spec.duration <= 0 || (elapsed >= total && total !== Infinity);

  // Before the delay is up, an animation shows its first frame only if it fills backwards.
  const waiting = !finished && elapsed < 0;
  if (waiting && spec.fill !== 'backwards' && spec.fill !== 'both') return { values: {}, finished };
  const local = directedProgress(spec, finished, elapsed);

  const values: Record<string, unknown> = {};
  for (const [property, track] of running.tracks) {
    values[property] = at(track, local, spec.easing);
  }
  return { values, finished };
}

/**
 * How far through its frames the animation is, 0 to 1, in the direction its current iteration
 * runs. A finished animation is at the end of its last iteration, not the start of one after it,
 * and a fractional count ends part of the way through that iteration.
 */
function directedProgress(spec: AnimationSpec, finished: boolean, elapsed: number): number {
  const position = finished ? (spec.iterations ?? 1) : Math.max(0, elapsed) / spec.duration;
  const iteration = finished ? Math.max(0, Math.ceil(position) - 1) : Math.floor(position);
  const through = Math.min(1, Math.max(0, position - iteration));
  return backwards(spec.direction, iteration) ? 1 - through : through;
}

/** Whether this iteration runs from the last frame to the first. */
function backwards(direction: AnimationSpec['direction'], iteration: number): boolean {
  switch (direction) {
    case 'reverse':
      return true;
    case 'alternate':
      return iteration % 2 === 1;
    case 'alternate-reverse':
      return iteration % 2 === 0;
    default:
      return false;
  }
}

/**
 * One property's value at one keyframe, and the curve a keyframe of its own eases it on to the
 * next one by, where it has one.
 */
export interface TrackPoint {
  readonly offset: number;
  readonly value: unknown;
  readonly easing?: readonly number[];
}

export function at(
  track: readonly TrackPoint[],
  local: number,
  easing: readonly number[],
): unknown {
  let index = 0;
  while (index < track.length - 2 && track[index + 1]!.offset <= local) index++;

  const from = track[index]!;
  const to = track[index + 1] ?? from;
  const span = to.offset - from.offset;
  const t = span <= 0 ? 1 : (local - from.offset) / span;
  // A keyframe's own timing function eases the stretch it starts, over the animation's.
  return interpolate(
    from.value,
    to.value,
    bezier(from.easing ?? easing, Math.min(1, Math.max(0, t))),
  );
}

/**
 * The event object a `transition*` or `animation*` listener receives.
 *
 * A keyframe animation is built with the global `AnimationEvent` when the host has defined one,
 * because code written for the web tells an animation from a transition with
 * `event instanceof AnimationEvent` and picks which end event to wait for from the answer. A
 * transition is a plain object for the same reason: it must not be one.
 */
export function animationEvent(topLevelType: string, target: unknown, name: string): unknown {
  const kind = topLevelType.slice(3).toLowerCase();
  const base = { type: kind, target, stopPropagation: () => {} };

  if (!kind.startsWith('animation')) return { ...base, propertyName: name };

  const Ctor = (globalThis as { AnimationEvent?: new (type: string) => object }).AnimationEvent;
  const event = Ctor ? new Ctor(kind) : {};
  return Object.assign(event, base, { animationName: name });
}
