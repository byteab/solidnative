/**
 * SVG attributes to the props react-native-svg's native views actually take.
 *
 * They are not the same thing, and the difference is the whole reason this file exists. `fill`
 * and `stroke` are not colours but *brushes*, a tagged struct that says whether the paint is a
 * colour, the view's own `color`, or a reference to a gradient. `stroke-linecap`, `stroke-linejoin`
 * and `fill-rule` are integers, not the keywords they are written as. And a shape has to declare
 * which props it set - `propList` - because anything absent is inherited from the group above it,
 * which is exactly how an icon whose root carries `stroke="currentColor"` paints its paths.
 *
 * Send the attributes through unchanged and every one of those reads as nothing at all, with no
 * error: the shape draws in the default black, or does not draw.
 *
 * All of this is what react-native-svg does in JavaScript before its props reach native. Its
 * components are React, so this is the same translation rather than a call into it.
 */

/** The paint on a shape: a colour, the view's own colour, or a reference to a gradient. */
export type Brush =
  | null
  | { readonly type: 0; readonly payload: unknown }
  | { readonly type: 1; readonly brushRef: string }
  | { readonly type: 2 };

const LINECAP: Record<string, number> = { butt: 0, round: 1, square: 2 };
const LINEJOIN: Record<string, number> = { miter: 0, round: 1, bevel: 2 };
const FILL_RULE: Record<string, number> = { evenodd: 0, nonzero: 1 };

const URL_REFERENCE = /^url\(#(.+)\)$/;

/**
 * Which element each SVG tag commits as. `polyline` and `polygon` are paths: react-native-svg has
 * no component for either and converts their points to a `d`, so this does too.
 */
export const SVG_ELEMENTS: Record<string, string> = {
  g: 'svg-g',
  path: 'svg-path',
  circle: 'svg-circle',
  ellipse: 'svg-ellipse',
  rect: 'svg-rect',
  line: 'svg-line',
  polyline: 'svg-path',
  polygon: 'svg-path',
};

/** Geometry, per tag. Everything else on a shape is presentation and shared. */
const GEOMETRY: Record<string, readonly string[]> = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
};

/** SVG attribute -> native prop, for the presentation attributes shapes and groups share. */
const PRESENTATION: Record<string, string> = {
  fill: 'fill',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  stroke: 'stroke',
  'stroke-opacity': 'strokeOpacity',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-miterlimit': 'strokeMiterlimit',
  'clip-rule': 'clipRule',
  opacity: 'opacity',
};

export interface SvgContext {
  /** The host's colour conversion, which a brush payload is the result of. */
  color(value: string): unknown;
}

export function brushOf(value: string, context: SvgContext): Brush {
  if (value === 'none') return null;
  // Deliberately kept as a brush rather than resolved here: native paints it from the view's own
  // `color`, so a bound `[color]` on the icon changes every `currentColor` shape without a
  // re-parse.
  if (value === 'currentColor') return { type: 2 };
  const reference = URL_REFERENCE.exec(value);
  if (reference) return { type: 1, brushRef: reference[1]! };
  return { type: 0, payload: context.color(value) };
}

/** `M x,y L x,y ...`, which is what a polyline or polygon is once native sees it. */
export function pointsToPath(points: string, close: boolean): string {
  const numbers = points
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  let path = '';
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    path += `${index === 0 ? 'M' : 'L'}${numbers[index]},${numbers[index + 1]}`;
  }
  return close && path ? `${path}Z` : path;
}

/**
 * `stroke-width:2;opacity:.5` as attributes. There are no custom properties to look up here, so
 * `var(--name, fallback)` is its fallback, and is dropped without one.
 */
export function styleAttributes(style: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const name = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    const resolved = resolveVar(value);
    if (name && resolved !== undefined) attrs[name] = resolved;
  }
  return attrs;
}

function resolveVar(value: string): string | undefined {
  const match = /^var\(\s*--[\w-]+\s*(?:,\s*([^)]*))?\)$/.exec(value);
  return match ? match[1]?.trim() || undefined : value;
}

/** The four numbers of a `viewBox`, as the props the svg view takes them as. */
export function viewBoxProps(viewBox: string | undefined): Record<string, unknown> {
  if (!viewBox) return {};
  const parts = viewBox.trim().replace(/,/g, ' ').split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return {};
  const [minX, minY, vbWidth, vbHeight] = parts;
  return { minX, minY, vbWidth, vbHeight, align: 'xMidYMid', meetOrSlice: 0 };
}

const TRANSFORM = /([a-zA-Z]+)\s*\(([^)]*)\)/g;

/**
 * A `transform` attribute as a 2x3 matrix, which is the only form native takes.
 *
 * Rare in icon sets - one occurrence across bootstrap-icons and lucide, and that one is already a
 * `matrix()` - but a shape drawn in the wrong place is worse than one not drawn, so the other
 * three forms compose rather than being ignored.
 */
export function transformMatrix(transform: string): number[] | undefined {
  let matrix: number[] | undefined;
  TRANSFORM.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TRANSFORM.exec(transform)) !== null) {
    const values = match[2]!
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const next = matrixFor(match[1]!, values);
    if (next) matrix = matrix ? multiply(matrix, next) : next;
  }
  return matrix;
}

/** `translate(4)` and `scale(2)` mean something for the missing argument; `rotate(90)` means 0. */
const at = (values: number[], index: number, fallback: number) => values[index] ?? fallback;

function matrixFor(name: string, values: number[]): number[] | undefined {
  const first = at(values, 0, 0);
  if (name === 'matrix') return values.length === 6 ? values : undefined;
  if (name === 'translate') return [1, 0, 0, 1, first, at(values, 1, 0)];
  if (name === 'scale') return [first, 0, 0, at(values, 1, first), 0, 0];
  if (name === 'rotate') return rotation(first, at(values, 1, 0), at(values, 2, 0));
  return undefined;
}

function rotation(degrees: number, cx: number, cy: number): number[] {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // Rotating about a point is the rotation with the point moved to the origin and back.
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
}

/** `[a, b, c, d, tx, ty]`, in SVG's own order. */
function multiply(left: number[], right: number[]): number[] {
  const [a1, b1, c1, d1, e1, f1] = left as [number, number, number, number, number, number];
  const [a2, b2, c2, d2, e2, f2] = right as [number, number, number, number, number, number];
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/**
 * One element's native props.
 *
 * `propList` is the load-bearing part: it names the props this element set itself, and native
 * inherits everything else from the group above. Omit it and a path with no `fill` of its own
 * paints black instead of the colour its parent carries.
 */
export function nativeProps(
  tag: string,
  attrs: Readonly<Record<string, string>>,
  context: SvgContext,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const propList: string[] = [];

  for (const [name, value] of Object.entries(attrs)) {
    const prop = PRESENTATION[name];
    if (!prop) continue;
    props[prop] = presentationValue(prop, value, context);
    propList.push(prop);
  }
  if (propList.length > 0) props['propList'] = propList;

  for (const name of GEOMETRY[tag] ?? []) {
    if (attrs[name] !== undefined) props[name] = attrs[name];
  }
  if (tag === 'polyline' || tag === 'polygon') {
    props['d'] = pointsToPath(attrs['points'] ?? '', tag === 'polygon');
  }
  if (attrs['transform']) {
    const matrix = transformMatrix(attrs['transform']);
    if (matrix) props['matrix'] = matrix;
  }
  return props;
}

/**
 * The props react-native-svg's Android view manager declares as `float` rather than `Dynamic`,
 * with the default it applies when the prop is absent.
 *
 * `Dynamic` reads whatever arrives, so an SVG attribute can stay the string it was written as -
 * which is what `strokeWidth` and every geometry attribute do. These five cannot: the Android
 * manager takes a `float` parameter, and a string reaching one throws `java.lang.String cannot be
 * cast to java.lang.Double` out of `setProperty` while the view is being created, which takes the
 * whole screen down. iOS never noticed, because folly's `dynamic` coerces a numeric string on the
 * way into a `Float` prop. react-native-svg's own JavaScript sends numbers here too, through
 * `extractOpacity`, so this is the same translation and not an Android workaround.
 */
const NUMERIC: Record<string, number> = {
  opacity: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
  strokeDashoffset: 0,
  strokeMiterlimit: 4,
};

function presentationValue(prop: string, value: string, context: SvgContext): unknown {
  if (prop === 'fill' || prop === 'stroke') return brushOf(value, context);
  if (prop === 'strokeLinecap') return LINECAP[value] ?? 0;
  if (prop === 'strokeLinejoin') return LINEJOIN[value] ?? 0;
  if (prop === 'fillRule' || prop === 'clipRule') return FILL_RULE[value] ?? 1;
  if (prop === 'strokeDasharray')
    return value
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);
  return prop in NUMERIC ? numberFor(prop, value) : value;
}

/** The attribute as the float Android's view manager takes, or the default it applies. */
function numberFor(prop: string, value: string): number {
  const number = Number.parseFloat(value);
  return Number.isNaN(number) ? NUMERIC[prop]! : number;
}
