/**
 * The landing page's drawing hand: geometry in, SVG path data out, slightly imperfect.
 *
 * Every mark on the page - the blue thread, the underlines, the arrows, the device construction
 * lines - comes from these few functions, which is what keeps it one illustrator's
 * work rather than a collection of icons. The imperfection is seeded, so a mark is the same
 * wobble on every render and in the prerendered page, and it is small: a hand that is steady
 * but not a ruler.
 *
 * Paths are meant to be stroked with `pathLength="1"`, so `stroke-dashoffset` can ink them in
 * from 0 to 1 regardless of how long they are (see `.ink-draw` in `landing.css`).
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** mulberry32: small, fast, and the same sequence for the same seed everywhere. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * A smooth stroke through the points, each nudged by up to `wobble` units.
 *
 * Catmull-Rom converted to cubic Béziers, so the line passes through every (nudged) point with no
 * corners - a pen does not stop at each point it passes.
 */
export function stroke(points: readonly Point[], seed = 1, wobble = 1.2): string {
  const next = random(seed);
  const p = points.map((point, i) =>
    i === 0 || i === points.length - 1
      ? point
      : { x: point.x + (next() - 0.5) * 2 * wobble, y: point.y + (next() - 0.5) * 2 * wobble },
  );
  if (p.length < 2) return '';
  let d = `M${round(p[0]!.x)} ${round(p[0]!.y)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const e = p[i + 2] ?? c;
    d +=
      ` C${round(b.x + (c.x - a.x) / 6)} ${round(b.y + (c.y - a.y) / 6)}` +
      ` ${round(c.x - (e.x - b.x) / 6)} ${round(c.y - (e.y - b.y) / 6)} ${round(c.x)} ${round(c.y)}`;
  }
  return d;
}

/** Points along a line from `a` to `b`, bowed sideways by `bow` at the middle. */
function along(a: Point, b: Point, steps: number, bow: number): Point[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const offset = Math.sin(Math.PI * t) * bow;
    return { x: a.x + dx * t + nx * offset, y: a.y + dy * t + ny * offset };
  });
}

/** A ruled line, drawn freehand: a slight bow and a tremor, ends exactly where asked. */
export function line(a: Point, b: Point, seed = 1, bow = 0.8): string {
  const steps = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 40));
  return stroke(along(a, b, steps, bow), seed, 0.6);
}

/**
 * A loop drawn around something, the way you circle a word in the margin: it starts a little
 * past where it will end and overshoots, rather than closing into a perfect ellipse.
 */
export function circle(cx: number, cy: number, rx: number, ry: number, seed = 1): string {
  const next = random(seed);
  const start = -Math.PI * (0.55 + next() * 0.2);
  const sweep = Math.PI * 2 * (1.08 + next() * 0.06);
  const steps = 14;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const angle = start + (sweep * i) / steps;
    // The radius drifts outwards over the loop, so the overshoot does not retrace the start.
    const drift = 1 + (i / steps) * 0.07;
    return { x: cx + Math.cos(angle) * rx * drift, y: cy + Math.sin(angle) * ry * drift };
  });
  return stroke(points, seed + 7, Math.min(rx, ry) * 0.04);
}

/** An underline with a little lift at the end, as a pen leaves the page. */
export function underline(x: number, y: number, width: number, seed = 1): string {
  return stroke(
    [
      { x, y: y + 1 },
      { x: x + width * 0.35, y: y - 0.5 },
      { x: x + width * 0.75, y: y + 0.8 },
      { x: x + width, y: y - 2 },
    ],
    seed,
    0.5,
  );
}

/** A curved arrow from `a` to `b`, with a two-stroke head. Returns [shaft, head]. */
export function arrow(a: Point, b: Point, seed = 1, bend = 0.25): readonly [string, string] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const shaft = stroke(along(a, b, 6, length * bend), seed, 0.8);
  // The head follows the tangent at the tip, which a bowed line leaves at an angle.
  const angle = Math.atan2(dy, dx) - Math.atan(bend * Math.PI * 0.95);
  const size = Math.min(10, length * 0.25);
  const left = {
    x: b.x - Math.cos(angle - 0.45) * size,
    y: b.y - Math.sin(angle - 0.45) * size,
  };
  const right = {
    x: b.x - Math.cos(angle + 0.45) * size,
    y: b.y - Math.sin(angle + 0.45) * size,
  };
  const head = `M${round(left.x)} ${round(left.y)} L${round(b.x)} ${round(b.y)} L${round(right.x)} ${round(right.y)}`;
  return [shaft, head];
}

/** A registration mark: a circle and a cross, the printer's sign that two sheets line up. */
export function registration(cx: number, cy: number, r: number, seed = 1): string {
  return [
    circle(cx, cy, r, r, seed),
    line({ x: cx - r * 1.6, y: cy }, { x: cx + r * 1.6, y: cy }, seed + 1, 0.2),
    line({ x: cx, y: cy - r * 1.6 }, { x: cx, y: cy + r * 1.6 }, seed + 2, 0.2),
  ].join(' ');
}

/** Short rays around a point, for "this is the moment" - a press, an arrival. */
export function starburst(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  rays = 8,
  seed = 1,
): string {
  const next = random(seed);
  return Array.from({ length: rays }, (_, i) => {
    const angle = (Math.PI * 2 * i) / rays + (next() - 0.5) * 0.3;
    const a = { x: cx + Math.cos(angle) * inner, y: cy + Math.sin(angle) * inner };
    const reach = outer * (0.8 + next() * 0.3);
    const b = { x: cx + Math.cos(angle) * reach, y: cy + Math.sin(angle) * reach };
    return line(a, b, seed + i, 0.2);
  }).join(' ');
}

/** A square bracket down the side of something, opening towards it. */
export function bracket(
  x: number,
  y: number,
  height: number,
  direction: 1 | -1 = 1,
  seed = 1,
): string {
  const lip = 8 * direction;
  return stroke(
    [
      { x: x + lip, y },
      { x, y: y + 2 },
      { x: x - 0.6 * direction, y: y + height / 2 },
      { x, y: y + height - 2 },
      { x: x + lip, y: y + height },
    ],
    seed,
    0.5,
  );
}

/**
 * A drafted wire through `points`: straight runs with small rounded corners, the way a line is
 * routed on a schematic rather than swung freehand. Each run carries a slight tremor so it is
 * still the page's hand.
 */
export function route(points: readonly Point[], radius = 12, seed = 1): string {
  const next = random(seed);
  const p = points.map((point, i) =>
    i === 0 || i === points.length - 1
      ? point
      : { x: point.x + (next() - 0.5) * 1.2, y: point.y + (next() - 0.5) * 1.2 },
  );
  if (p.length < 2) return '';
  let d = `M${round(p[0]!.x)} ${round(p[0]!.y)}`;
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const into = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const out = Math.hypot(c.x - b.x, c.y - b.y) || 1;
    const r = Math.min(radius, into / 2, out / 2);
    const enter = { x: b.x - ((b.x - a.x) / into) * r, y: b.y - ((b.y - a.y) / into) * r };
    const leave = { x: b.x + ((c.x - b.x) / out) * r, y: b.y + ((c.y - b.y) / out) * r };
    d += ` L${round(enter.x)} ${round(enter.y)} Q${round(b.x)} ${round(b.y)} ${round(leave.x)} ${round(leave.y)}`;
  }
  const last = p[p.length - 1]!;
  return `${d} L${round(last.x)} ${round(last.y)}`;
}

/** Whether the reader has asked for less motion: every stroke is then drawn, nothing moves. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
