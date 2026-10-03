/**
 * `color-mix()` worked out on device, for a mix with a token in it.
 *
 * The compiler folds a mix of literal colours at build time (lightningcss does the arithmetic); a
 * mix with a `var()` in it can only be done once the token is known, so it is done here, with CSS
 * Color 4 and 5's own arithmetic: each colour converted into the named space, premultiplied by its
 * alpha, interpolated (a hue the shorter way round), and brought back to the sRGB native paints,
 * inside its gamut by CSS Color 4's chroma reduction rather than a clip.
 *
 * The matrices and the gamut mapping are the ones `@solidnative/metro`'s `color-spaces.cjs` uses to
 * convert a literal colour at build time, copied here because the engine cannot depend on the
 * build step; the tests hold the two to the same answers.
 */
import { parseColor } from './transition.ts';

/** The spaces a mix is worked out in: every one the compiler also folds a literal mix in. */
export type MixSpace = 'srgb' | 'oklab' | 'oklch' | 'lab' | 'lch' | 'hsl' | 'hwb';

export const MIX_SPACES: ReadonlySet<string> = new Set<MixSpace>([
  'srgb',
  'oklab',
  'oklch',
  'lab',
  'lch',
  'hsl',
  'hwb',
]);

export type HueMethod = 'shorter' | 'longer' | 'increasing' | 'decreasing';

export type Vector = [number, number, number];

const times = (m: readonly Vector[], [x, y, z]: Vector): Vector =>
  m.map(([a, b, c]) => a * x + b * y + c * z) as Vector;

const OKLAB_TO_LMS: Vector[] = [
  [1.0, 0.3963377773761749, 0.2158037573099136],
  [1.0, -0.1055613458156586, -0.0638541728258133],
  [1.0, -0.0894841775298119, -1.2914855480194092],
];
const LMS_TO_XYZ: Vector[] = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];
const XYZ_TO_LMS: Vector[] = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_TO_OKLAB: Vector[] = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const XYZ_TO_LINEAR_SRGB: Vector[] = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const LINEAR_SRGB_TO_XYZ: Vector[] = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];
/** Bradford chromatic adaptation between `lab()`'s D50 white and sRGB's D65. */
const D50_TO_D65: Vector[] = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const D65_TO_D50: Vector[] = [
  [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
  [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
  [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008],
];
const D50_WHITE: Vector = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

const encode = (c: number) =>
  Math.sign(c) * (Math.abs(c) > 0.0031308 ? 1.055 * Math.abs(c) ** (1 / 2.4) - 0.055 : 12.92 * c);
const decode = (c: number) =>
  Math.sign(c) * (Math.abs(c) > 0.04045 ? ((Math.abs(c) + 0.055) / 1.055) ** 2.4 : c / 12.92);

const srgbToXyz = (rgb: Vector) => times(LINEAR_SRGB_TO_XYZ, rgb.map(decode) as Vector);
const xyzToSrgb = (xyz: Vector) => times(XYZ_TO_LINEAR_SRGB, xyz).map(encode) as Vector;
const xyzToOklab = (xyz: Vector) =>
  times(LMS_TO_OKLAB, times(XYZ_TO_LMS, xyz).map(Math.cbrt) as Vector);
const oklabToXyz = (lab: Vector) =>
  times(LMS_TO_XYZ, times(OKLAB_TO_LMS, lab).map((c) => c ** 3) as Vector);

const KAPPA = 24389 / 27;
const EPSILON = 216 / 24389;

function xyzToLab(xyz: Vector): Vector {
  const [x, y, z] = times(D65_TO_D50, xyz).map((c, i) => c / D50_WHITE[i]!);
  const f = (c: number) => (c > EPSILON ? Math.cbrt(c) : (KAPPA * c + 16) / 116);
  const [fx, fy, fz] = [f(x!), f(y!), f(z!)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToXyz([l, a, b]: Vector): Vector {
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const x = fx ** 3 > EPSILON ? fx ** 3 : (116 * fx - 16) / KAPPA;
  const y = l > KAPPA * EPSILON ? fy ** 3 : l / KAPPA;
  const z = fz ** 3 > EPSILON ? fz ** 3 : (116 * fz - 16) / KAPPA;
  return times(D50_TO_D65, [x, y, z].map((c, i) => c * D50_WHITE[i]!) as Vector);
}

/** Lightness, chroma and hue in degrees, from the rectangular form, and back. */
const polar = ([l, a, b]: Vector): Vector => {
  const hue = (Math.atan2(b, a) * 180) / Math.PI;
  return [l, Math.hypot(a, b), hue < 0 ? hue + 360 : hue];
};
const rectangular = ([l, c, h]: Vector): Vector => [
  l,
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
];

function srgbToHsl([r, g, b]: Vector): Vector {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [NaN, 0, l];
  const s = l === 0 || l === 1 ? 0 : (max - l) / Math.min(l, 1 - l);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / d + 2) * 60
        : ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function hslToSrgb([h, s, l]: Vector): Vector {
  const hue = Number.isFinite(h) ? ((h % 360) + 360) % 360 : 0;
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function srgbToHwb(rgb: Vector): Vector {
  const [h] = srgbToHsl(rgb);
  return [h, Math.min(...rgb), 1 - Math.max(...rgb)];
}

function hwbToSrgb([h, w, b]: Vector): Vector {
  if (w + b >= 1) {
    const grey = w / (w + b);
    return [grey, grey, grey];
  }
  return hslToSrgb([h, 1, 0.5]).map((c) => c * (1 - w - b) + w) as Vector;
}

/** Where the hue sits in each space's coordinates, if it has one. */
const HUE_INDEX: Partial<Record<MixSpace, number>> = { oklch: 2, lch: 2, hsl: 0, hwb: 0 };

/** An sRGB colour, channels 0 to 1, in the space's own coordinates. */
export function into(space: MixSpace, rgb: Vector): Vector {
  switch (space) {
    case 'srgb':
      return rgb;
    case 'oklab':
      return xyzToOklab(srgbToXyz(rgb));
    case 'oklch':
      return powerless(polar(xyzToOklab(srgbToXyz(rgb))), 0.000004);
    case 'lab':
      return xyzToLab(srgbToXyz(rgb));
    case 'lch':
      return powerless(polar(xyzToLab(srgbToXyz(rgb))), 0.0015);
    case 'hsl':
      return srgbToHsl(rgb);
    case 'hwb':
      return srgbToHwb(rgb);
  }
}

/** A hue that does not matter, for a colour with no chroma to speak of, is missing, as CSS says. */
const powerless = ([l, c, h]: Vector, threshold: number): Vector => [
  l,
  c,
  c <= threshold ? NaN : h,
];

/** Back to sRGB, 0 to 1, brought inside the gamut where the space reaches past it. */
export function outOf(space: MixSpace, coords: Vector): Vector {
  const finite = coords.map((c) => (Number.isFinite(c) ? c : 0)) as Vector;
  switch (space) {
    case 'srgb':
      return clip(finite);
    case 'oklab':
      return gamutMap(finite);
    case 'oklch':
      return gamutMap(rectangular(finite));
    case 'lab':
      return gamutMap(xyzToOklab(labToXyz(finite)));
    case 'lch':
      return gamutMap(xyzToOklab(labToXyz(rectangular(finite))));
    case 'hsl':
      return clip(hslToSrgb(finite));
    case 'hwb':
      return clip(hwbToSrgb(finite));
  }
}

const clip = (rgb: Vector) => rgb.map((c) => Math.min(1, Math.max(0, c))) as Vector;
const inGamut = (rgb: Vector) => rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);
const deltaEOK = (a: Vector, b: Vector) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** CSS Color 4 section 13.2.2: reduce OKLCh chroma until clipping no longer shows. */
function gamutMap(oklab: Vector): Vector {
  const origin = polar(oklab);
  if (origin[0] >= 1) return [1, 1, 1];
  if (origin[0] <= 0) return [0, 0, 0];
  const srgbOf = (lch: Vector) => xyzToSrgb(oklabToXyz(rectangular(lch)));
  const rgb = srgbOf(origin);
  if (inGamut(rgb)) return clip(rgb);

  const JND = 0.02;
  const EPS = 0.0001;
  let clipped = clip(rgb);
  if (deltaEOK(xyzToOklab(srgbToXyz(clipped)), oklab) < JND) return clipped;
  let min = 0;
  let max = origin[1];
  let minInGamut = true;
  while (max - min > EPS) {
    const chroma = (min + max) / 2;
    const current: Vector = [origin[0], chroma, origin[2]];
    const converted = srgbOf(current);
    if (minInGamut && inGamut(converted)) {
      min = chroma;
      continue;
    }
    clipped = clip(converted);
    const error = deltaEOK(xyzToOklab(srgbToXyz(clipped)), rectangular(current));
    if (error < JND) {
      if (JND - error < EPS) return clipped;
      minInGamut = false;
      min = chroma;
    } else {
      max = chroma;
    }
  }
  return clipped;
}

/** Two hues, one moved by whole turns so that interpolating between them goes the way asked. */
function fixHues(a: number, b: number, method: HueMethod): [number, number] {
  const delta = b - a;
  const lift = HUE_LIFTS[method](delta);
  return lift === 'a' ? [a + 360, b] : lift === 'b' ? [a, b + 360] : [a, b];
}

/** For each method, which of the two hues takes a whole turn more, given how far apart they are. */
const HUE_LIFTS: Record<HueMethod, (delta: number) => 'a' | 'b' | null> = {
  shorter: (delta) => (delta > 180 ? 'a' : delta < -180 ? 'b' : null),
  longer: (delta) => (delta > 0 && delta < 180 ? 'a' : delta > -180 && delta <= 0 ? 'b' : null),
  increasing: (delta) => (delta < 0 ? 'b' : null),
  decreasing: (delta) => (delta > 0 ? 'a' : null),
};

/** One side of a mix: a colour as native paints it, and the percentage written beside it. */
export interface MixSide {
  readonly colour: string;
  readonly percentage?: number;
}

/**
 * `color-mix(in <space> [<hue> hue], <a> [p%], <b> [q%])`, as the `rgb()` or `rgba()` native
 * reads. Undefined when a side is not a colour it can read - a platform colour, say - or when the
 * two percentages come to zero, which CSS says is not a colour at all.
 */
export function mixColours(
  space: MixSpace,
  a: MixSide,
  b: MixSide,
  hue: HueMethod = 'shorter',
): string | undefined {
  const first = parseColor(a.colour);
  const second = parseColor(b.colour);
  const weights = weightsOf(a.percentage, b.percentage);
  if (!first || !second || !weights) return undefined;

  const [c1, c2] = [first, second].map(([r, g, bl, alpha]) => ({
    coords: into(space, [r / 255, g / 255, bl / 255]),
    alpha,
  })) as [Side, Side];
  const hueAt = HUE_INDEX[space];
  alignComponents(c1, c2, hueAt, hue);

  const { t, alphaScale } = weights;
  const alpha = c1.alpha * (1 - t) + c2.alpha * t;
  const mixed = interpolate(c1, c2, t, alpha, hueAt);
  const [r, g, bl] = outOf(space, mixed).map((c) => Math.round(c * 255));
  const opacity = Math.round(alpha * alphaScale * 1000) / 1000;
  return opacity >= 1 ? `rgb(${r}, ${g}, ${bl})` : `rgba(${r}, ${g}, ${bl}, ${opacity})`;
}

interface Side {
  coords: Vector;
  alpha: number;
}

/**
 * CSS Color 5, 2.1: missing percentages take what the other leaves, or half each; the second
 * colour's share is `t`, and a pair summing under 100 scales the alpha down.
 */
function weightsOf(p?: number, q?: number): { t: number; alphaScale: number } | null {
  const [first, second] =
    p === undefined && q === undefined
      ? [50, 50]
      : p === undefined
        ? [100 - q!, q!]
        : q === undefined
          ? [p, 100 - p]
          : [p, q];
  const sum = first + second;
  if (sum <= 0) return null;
  return { t: second / sum, alphaScale: sum < 100 ? sum / 100 : 1 };
}

/** A missing component takes the other colour's, and the hues are set to go the way asked. */
function alignComponents(c1: Side, c2: Side, hueAt: number | undefined, hue: HueMethod): void {
  for (let i = 0; i < 3; i++) {
    if (Number.isNaN(c1.coords[i])) c1.coords[i] = c2.coords[i]!;
    if (Number.isNaN(c2.coords[i])) c2.coords[i] = c1.coords[i]!;
  }
  if (hueAt === undefined) return;
  const [h1, h2] = [c1.coords[hueAt]!, c2.coords[hueAt]!];
  if (Number.isFinite(h1) && Number.isFinite(h2)) {
    [c1.coords[hueAt], c2.coords[hueAt]] = fixHues(h1, h2, hue);
  }
}

/** Premultiplied by alpha, except the hue, which is an angle and not an amount. */
function interpolate(c1: Side, c2: Side, t: number, alpha: number, hueAt?: number): Vector {
  const mixed = [0, 1, 2].map((i) => {
    if (i === hueAt) return c1.coords[i]! * (1 - t) + c2.coords[i]! * t;
    const premixed = c1.coords[i]! * c1.alpha * (1 - t) + c2.coords[i]! * c2.alpha * t;
    return alpha === 0 ? 0 : premixed / alpha;
  }) as Vector;
  if (hueAt !== undefined) mixed[hueAt] = ((mixed[hueAt]! % 360) + 360) % 360;
  return mixed;
}
