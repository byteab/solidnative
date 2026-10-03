/**
 * `lab()`, `lch()`, `oklab()` and `oklch()`, as the sRGB native paints.
 *
 * Native reads `rgb()` and nothing wider, so a colour in one of these spaces is converted at build
 * time with CSS Color 4's own formulas and matrices (section 18, "Sample code for colour
 * conversions"), and one that falls outside sRGB is brought inside by CSS Color 4's gamut mapping
 * (section 13.2): reduce its OKLCh chroma until clipping it is no longer a visible change. Clipping
 * alone shifts hue and lightness, which is why the spec does not stop there.
 */

/** A 3x3 matrix times a vector. */
const times = (m, [x, y, z]) => m.map(([a, b, c]) => a * x + b * y + c * z);

const OKLAB_TO_LMS = [
  [1.0, 0.3963377773761749, 0.2158037573099136],
  [1.0, -0.1055613458156586, -0.0638541728258133],
  [1.0, -0.0894841775298119, -1.2914855480194092],
];
const LMS_TO_XYZ = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];
const XYZ_TO_LMS = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_TO_OKLAB = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const XYZ_TO_LINEAR_SRGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const LINEAR_SRGB_TO_XYZ = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];
/** Bradford chromatic adaptation, from `lab()`'s D50 white to sRGB's D65. */
const D50_TO_D65 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const D50_WHITE = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

const oklabToXyz = (lab) =>
  times(
    LMS_TO_XYZ,
    times(OKLAB_TO_LMS, lab).map((c) => c ** 3),
  );
const xyzToOklab = (xyz) => times(LMS_TO_OKLAB, times(XYZ_TO_LMS, xyz).map(Math.cbrt));

/** CIE Lab, whose white is D50, to XYZ relative to D65. */
function labToXyz([l, a, b]) {
  const kappa = 24389 / 27;
  const epsilon = 216 / 24389;
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const x = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa;
  const y = l > kappa * epsilon ? fy ** 3 : l / kappa;
  const z = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa;
  return times(
    D50_TO_D65,
    [x, y, z].map((c, i) => c * D50_WHITE[i]),
  );
}

/** The sRGB transfer function, and its inverse. Odd, so a channel below zero keeps its sign. */
const encode = (c) =>
  Math.sign(c) * (Math.abs(c) > 0.0031308 ? 1.055 * Math.abs(c) ** (1 / 2.4) - 0.055 : 12.92 * c);
const decode = (c) =>
  Math.sign(c) * (Math.abs(c) > 0.04045 ? ((Math.abs(c) + 0.055) / 1.055) ** 2.4 : c / 12.92);

const xyzToSrgb = (xyz) => times(XYZ_TO_LINEAR_SRGB, xyz).map(encode);
const srgbToOklab = (rgb) => xyzToOklab(times(LINEAR_SRGB_TO_XYZ, rgb.map(decode)));

/** A polar colour, lightness chroma hue, as the rectangular one. The hue is in degrees. */
const rectangular = ([l, c, h]) => [
  l,
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
];
const polar = ([l, a, b]) => [l, Math.hypot(a, b), (Math.atan2(b, a) * 180) / Math.PI];

const clip = (rgb) => rgb.map((c) => Math.min(1, Math.max(0, c)));
/** Inside sRGB, allowing for the arithmetic's own noise: a primary written exactly is inside. */
const inGamut = (rgb) => rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);
const deltaEOK = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * CSS Color 4 section 13.2.2, the binary search on chroma with a local MINDE: the least chroma
 * reduction after which clipping moves the colour by less than a just-noticeable difference.
 */
function gamutMap(oklab) {
  const origin = polar(oklab);
  if (origin[0] >= 1) return [1, 1, 1];
  if (origin[0] <= 0) return [0, 0, 0];
  const srgbOf = (lch) => xyzToSrgb(oklabToXyz(rectangular(lch)));
  const rgb = srgbOf(origin);
  if (inGamut(rgb)) return clip(rgb);

  const JND = 0.02;
  const EPSILON = 0.0001;
  let clipped = clip(rgb);
  if (deltaEOK(srgbToOklab(clipped), oklab) < JND) return clipped;

  let min = 0;
  let max = origin[1];
  let minInGamut = true;
  while (max - min > EPSILON) {
    const chroma = (min + max) / 2;
    const current = [origin[0], chroma, origin[2]];
    const converted = srgbOf(current);
    if (minInGamut && inGamut(converted)) {
      min = chroma;
      continue;
    }
    clipped = clip(converted);
    const error = deltaEOK(srgbToOklab(clipped), rectangular(current));
    if (error < JND) {
      if (JND - error < EPSILON) return clipped;
      minInGamut = false;
      min = chroma;
    } else {
      max = chroma;
    }
  }
  return clipped;
}

/** The spaces this converts, by the type lightningcss gives them. */
const SPACES = new Set(['lab', 'lch', 'oklab', 'oklch']);

/**
 * One of lightningcss's `lab`, `lch`, `oklab` or `oklch` values, as 0-255 sRGB channels and an
 * alpha. Lightness arrives as a fraction for the OK spaces and as a percentage for the CIE ones,
 * exactly as CSS writes them. A `none` component arrives as null, or as NaN for the alpha, and CSS
 * reads it as zero.
 */
function toSrgb(value) {
  const n = (c) => (Number.isFinite(c) ? c : 0);
  let oklab;
  switch (value.type) {
    case 'oklab':
      oklab = [n(value.l), n(value.a), n(value.b)];
      break;
    case 'oklch':
      oklab = rectangular([n(value.l), n(value.c), n(value.h)]);
      break;
    case 'lab':
      oklab = xyzToOklab(labToXyz([n(value.l), n(value.a), n(value.b)]));
      break;
    case 'lch':
      oklab = xyzToOklab(labToXyz(rectangular([n(value.l), n(value.c), n(value.h)])));
      break;
    default:
      return null;
  }
  const [r, g, b] = gamutMap(oklab).map((c) => Math.round(c * 255));
  return { r, g, b, alpha: n(value.alpha) };
}

module.exports = { toSrgb, SPACES };
