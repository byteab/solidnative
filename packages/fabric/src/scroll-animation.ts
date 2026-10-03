/**
 * A `@keyframes` animation played by a scroll view's offset: `animation-timeline: scroll()`.
 *
 * Native interpolates linearly between the points it is given and clamps past both ends, which is
 * all a scroll-driven animation needs from it once its keyframes are laid along the offset: each
 * keyframe sits at its share of the range, a segment's timing function is sampled into points
 * along it, and an unfilled end falls back to the resting value just outside the range. What
 * native can animate this way is opacity and the transforms; anything else holds its first frame.
 */
import type { ScrollRange } from './native-drive.ts';
import { at, type AnimationSpec, type TrackPoint } from './transition.ts';

type Track = readonly { offset: number; value: unknown }[];

/** The channels a scroll-driven animation drives natively, in the order native applies them. */
export interface DrivenChannels {
  readonly opacity?: ScrollRange;
  /** Every transform entry the view paints: driven by the scroll, or held as it is. */
  readonly transform: readonly TransformChannel[];
}

export type TransformChannel =
  | { readonly property: string; readonly range: ScrollRange }
  | { readonly property: string; readonly value: number };

/** What a range with no end, or a percentage of one, stands in for until the scroll view says. */
const UNKNOWN_EXTENT = 1e6;

/** Points per eased segment: enough that the curve between them reads as the curve. */
const SAMPLES = 12;

/** The transform groups in the order CSS applies them, as the engine composes them. */
const GROUPS = ['__translate', '__rotate', '__scale', 'transform'] as const;

/** Where the range starts and ends on the scroll view's offset. */
export function rangeOf(spec: AnimationSpec, extent: number | null): [number, number] {
  const end = (value: number | string | undefined, otherwise: number): number => {
    if (value === undefined) return otherwise;
    if (typeof value === 'number') return value;
    return (parseFloat(value) / 100) * (extent ?? UNKNOWN_EXTENT);
  };
  return [end(spec.range?.start, 0), end(spec.range?.end, extent ?? UNKNOWN_EXTENT)];
}

/**
 * The channels for an animation's tracks over a range, and the properties it cannot drive
 * natively, which the caller holds at their first frame.
 */
export function scrollChannels(
  tracks: ReadonlyMap<string, Track>,
  spec: AnimationSpec,
  resting: Readonly<Record<string, unknown>>,
  range: readonly [number, number],
): { channels: DrivenChannels; held: string[] } {
  const along = (track: Track, pick: (value: unknown) => number | null, rest: number) =>
    laid(track, pick, rest, spec, range);
  const held: string[] = [];
  let opacity: ScrollRange | undefined;
  const transform: TransformChannel[] = [];
  for (const [property, track] of tracks) {
    if (property === 'opacity') {
      opacity =
        along(
          track,
          (value) => (typeof value === 'number' ? value : null),
          numberOr(resting['opacity'], 1),
        ) ?? undefined;
      if (!opacity) held.push(property);
    } else if (!(GROUPS as readonly string[]).includes(property)) {
      held.push(property);
    }
  }
  for (const group of GROUPS) {
    const track = tracks.get(group);
    const channels = track ? drivenGroup(track, resting[group], along) : heldGroup(resting[group]);
    if (channels === null) held.push(group);
    else transform.push(...channels);
  }
  const anyDriven = transform.some((channel) => 'range' in channel);
  return {
    channels: { ...(opacity ? { opacity } : {}), transform: anyDriven ? transform : [] },
    held,
  };
}

/** One transform group's entries, each driven along the scroll; null if their shapes differ. */
function drivenGroup(
  track: Track,
  resting: unknown,
  along: (
    track: Track,
    pick: (value: unknown) => number | null,
    rest: number,
  ) => ScrollRange | null,
): TransformChannel[] | null {
  const shapes = track.map((point) => (Array.isArray(point.value) ? point.value : null));
  const shape = shapes.find((entries) => entries?.length) ?? [];
  const keys = shape.map((entry) => Object.keys(entry as object)[0]!);
  const channels: TransformChannel[] = [];
  for (const [index, key] of keys.entries()) {
    const identity = key.startsWith('scale') ? 1 : 0;
    const pick = (value: unknown) => {
      const entries = Array.isArray(value) ? value : null;
      if (!entries?.length) return identity;
      const entry = entries[index] as Record<string, unknown> | undefined;
      return entry && key in entry ? amount(key, entry[key]) : null;
    };
    const range = along(track, pick, restingAmount(resting, index, key, identity));
    if (!range) return null;
    channels.push({ property: key, range });
  }
  return channels;
}

/** A transform group no keyframe touches, held as the element has it. */
function heldGroup(resting: unknown): TransformChannel[] | null {
  if (!Array.isArray(resting)) return [];
  const channels: TransformChannel[] = [];
  for (const entry of resting as Record<string, unknown>[]) {
    const [key, value] = Object.entries(entry)[0] ?? [];
    const number = key === undefined ? null : amount(key, value);
    if (key === undefined || number === null) return null;
    channels.push({ property: key, value: number });
  }
  return channels;
}

function restingAmount(resting: unknown, index: number, key: string, identity: number): number {
  const entry = Array.isArray(resting) ? (resting[index] as Record<string, unknown>) : undefined;
  return (entry && key in entry ? amount(key, entry[key]) : null) ?? identity;
}

const numberOr = (value: unknown, otherwise: number) =>
  typeof value === 'number' ? value : otherwise;

const RADIANS: Record<string, number> = {
  deg: Math.PI / 180,
  rad: 1,
  grad: Math.PI / 200,
  turn: 2 * Math.PI,
};

/**
 * A transform entry's amount as native's transform node takes it: points, a factor, or an angle
 * in radians. Null for what it cannot take, a percentage translate.
 */
function amount(key: string, value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const angle = /^(-?[\d.]+)(deg|rad|grad|turn)$/.exec(value);
  if (angle && (key.startsWith('rotate') || key.startsWith('skew'))) {
    return Number(angle[1]) * RADIANS[angle[2]!]!;
  }
  return null;
}

/**
 * One property's frames laid along the scroll: each keyframe at its share of the range, eased
 * segments sampled, and the resting value just past an end the animation does not fill.
 */
function laid(
  track: Track,
  pick: (value: unknown) => number | null,
  rest: number,
  spec: AnimationSpec,
  [start, end]: readonly [number, number],
): ScrollRange | null {
  const values = track.map((point) => pick(point.value));
  if (values.some((value) => value === null)) return null;
  // Each point keeps its own timing function, which eases the stretch it starts.
  const numeric = track.map((point, i) => ({ ...point, value: values[i]! }));
  const points = sampled(numeric, spec, start, Math.max(end - start, 1e-3));
  const fills = spec.fill;
  const backwards = fills === 'backwards' || fills === 'both';
  const forwards = fills === 'forwards' || fills === 'both';
  if (!backwards) points.unshift([points[0]![0] - 1e-3, rest]);
  if (!forwards) points.push([points.at(-1)![0] + 1e-3, rest]);
  return { input: points.map(([x]) => x), output: points.map(([, y]) => round(y)) };
}

/** A numeric track's points along the scroll, each eased segment sampled, in offset order. */
function sampled(
  numeric: readonly (TrackPoint & { value: number })[],
  spec: AnimationSpec,
  start: number,
  span: number,
): [number, number][] {
  const reversed = spec.direction === 'reverse' || spec.direction === 'alternate-reverse';
  const points: [number, number][] = [];
  for (let i = 0; i < numeric.length - 1; i++) {
    const from = numeric[i]!;
    const to = numeric[i + 1]!;
    const steps = isLinear(from.easing ?? spec.easing) ? 1 : SAMPLES;
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
      const offset = from.offset + ((to.offset - from.offset) * s) / steps;
      const value = at(numeric, offset, spec.easing) as number;
      points.push([start + (reversed ? 1 - offset : offset) * span, value]);
    }
  }
  if (points.length === 1) points.push([start + span, points[0]![1]]);
  return points.sort((a, b) => a[0] - b[0]);
}

const isLinear = (easing: readonly number[]) =>
  easing[0] === 0 && easing[1] === 0 && easing[2] === 1 && easing[3] === 1;

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** The values a scroll-driven animation commits: its frame at the offset the view starts at. */
export function firstFrame(
  tracks: ReadonlyMap<string, Track>,
  spec: AnimationSpec,
  range: readonly [number, number],
): Record<string, unknown> {
  const [start, end] = range;
  const reversed = spec.direction === 'reverse' || spec.direction === 'alternate-reverse';
  const before = 0 < start;
  if (before && spec.fill !== 'backwards' && spec.fill !== 'both') return {};
  const through = Math.min(1, Math.max(0, (0 - start) / Math.max(end - start, 1e-3)));
  const local = reversed ? 1 - through : through;
  const values: Record<string, unknown> = {};
  for (const [property, track] of tracks) values[property] = at(track, local, spec.easing);
  return values;
}
