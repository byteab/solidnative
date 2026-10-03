/**
 * Every Tailwind utility, as cases: what `tailwind-sweep.test.ts` compiles and the CSS oracle
 * measures in Chrome.
 *
 * The list comes from Tailwind's own design system, with the native preset loaded, so a utility
 * or variant added by a Tailwind release, or by `native.css`, is covered without anyone writing it
 * down. From it:
 *
 * - every static utility (`flex`, `truncate`), and a spread of each functional one's named values
 *   (`p-0`, `p-4`, `p-96`) rather than all of them: `bg-red-500` and `bg-red-600` take one path;
 * - arbitrary and variable values each functional utility accepts (`w-[13px]`, `w-(--x)`), and
 *   negative ones, found by asking Tailwind which of a fixed set it takes;
 * - a colour's opacity modifier, bracketed and bare;
 * - every one of those as important (`p-4!`);
 * - every variant, on a few utilities that stand for the rest;
 * - pairs of utilities that fill different slots of one composed value: `translate-x-2` and
 *   `translate-y-4`, `shadow-lg` and `ring-2`, `transition` and `duration-700`. Found from the CSS
 *   itself - one sets a `--tw-*` property the other reads, or sets again one the other reads where
 *   it sets it - so a pair nobody thought of is found;
 * - pairs of a shorthand and one of its sides, `p-4 pt-2`, where which one wins is a cascade
 *   question.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const tailwind = require('tailwindcss') as {
  compile(css: string, options: object): Promise<{ build(candidates: string[]): string }>;
  __unstable__loadDesignSystem(css: string, options: object): Promise<DesignSystem>;
};

interface DesignSystem {
  getClassList(): [string, { modifiers: string[] }][];
  getVariants(): { name: string; values: string[]; isArbitrary: boolean; hasDash: boolean }[];
  candidatesToCss(candidates: string[]): (string | null)[];
  utilities: { keys(kind: 'static' | 'functional'): string[] };
}

export interface SweepCase {
  /** What the case is called in the oracle and in failures: its classes, space-separated. */
  readonly name: string;
  readonly classes: readonly string[];
  readonly kind: 'utility' | 'arbitrary' | 'important' | 'variant' | 'pair';
}

/**
 * An app's entry file, as `packages/tailwind/README.md` tells one to write it, with a theme of the
 * app's own (`tailwind-sweep-theme.css`). The web one is what an app hosted by `@solidnative/web`
 * writes instead.
 */
const entry = (preset: 'native' | 'web') =>
  [
    `@import 'tailwindcss/theme.css';`,
    `@import 'tailwindcss/utilities.css';`,
    `@import '@solidnative/tailwind/${preset}.css';`,
    `@import './tailwind-sweep-theme.css';`,
  ].join('\n');
const ENTRY = entry('native');

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * What every case is measured under, in Chrome and in the engine alike: a viewport of one size,
 * and a root on iOS with the font size and colour pinned, so an `em` or a `currentcolor` means
 * the same on both sides.
 */
export const VIEWPORT = { width: 1000, height: 800 };
export const ROOT_CLASSES = 'platform-ios sweep-root';
export const ROOT_CSS = '.sweep-root { font-size: 16px; color: rgb(0, 0, 0) }';
/**
 * Where through its first cycle an animation is sampled: the ends, and the middles of what are
 * usually its stretches, so a stretch eased by the wrong curve is caught between its keyframes.
 */
export const MOTION_POINTS = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9];

/** The size of the box a transform is measured on, which a percentage in one is a share of. */
export const TRANSFORM_BOX = 100;

/**
 * The cases a world other than the base is measured for: the variant probes, which are what a
 * world changes, and in the Android world the Android pairs, a filter being drawn only there.
 */
export function measuredIn(world: World, cases: readonly SweepCase[]): SweepCase[] {
  return cases.filter(
    (test) =>
      test.kind === 'variant' ||
      (world.name === 'android' && test.classes.every((name) => name.startsWith('android:'))),
  );
}

/**
 * The settings a case is measured under. `base` is every case, on iOS in light mode at 1000 wide
 * with nothing pressed or focused; the others re-measure the variant cases where their variant
 * switches on: on Android, in dark mode, narrower and wider than every breakpoint, and with every
 * state an attribute can set turned on - on the element, on a `.group` around it and on a `.peer`
 * before it.
 */
export interface World {
  readonly name: string;
  readonly width: number;
  readonly rootClasses: string;
  readonly states: boolean;
}

export const WORLDS: readonly World[] = [
  // The same classes on the web host: the web preset's build, `@solidnative/web`'s reset, and a
  // root on the web platform - held to what the engine resolves on a phone, which is the promise
  // one class string makes across the two.
  { name: 'web', width: 1000, rootClasses: 'platform-web sweep-root', states: false },
  { name: 'base', width: 1000, rootClasses: ROOT_CLASSES, states: false },
  { name: 'android', width: 1000, rootClasses: 'platform-android sweep-root', states: false },
  { name: 'dark', width: 1000, rootClasses: `${ROOT_CLASSES} dark`, states: false },
  { name: 'narrow', width: 500, rootClasses: ROOT_CLASSES, states: false },
  { name: 'wide', width: 1600, rootClasses: ROOT_CLASSES, states: false },
  { name: 'states', width: 1000, rootClasses: ROOT_CLASSES, states: true },
];

/**
 * Every state the native preset reads from an attribute, turned on. `hover:` is `[data-hover]`
 * as well as `:active`, `focus:` is `[data-focus]` as well as `:focus`, and so on: an attribute
 * is a state Chrome and the engine can both be given without anyone touching the screen.
 */
export const STATE_ATTRIBUTES: Readonly<Record<string, string>> = {
  'data-hover': '',
  'data-focus': '',
  'data-disabled': '',
  'data-active': '',
  'data-state': 'open',
  'data-size': 'lg',
  'aria-selected': 'true',
  'aria-checked': 'true',
  'aria-expanded': 'true',
  'aria-pressed': 'true',
  'aria-disabled': 'true',
  'aria-busy': 'true',
  'aria-invalid': 'true',
  'aria-required': 'true',
  'aria-readonly': 'true',
  'aria-sort': 'ascending',
  open: '',
  // What the app's own `midnight:` variant asks of an ancestor.
  'data-theme': 'midnight',
};

/** Classes an ancestor carries in the states world, for the app's own `pocket:` variant. */
export const STATE_CLASSES = ['pocket'];

/** Resolves an `@import` the way the CLI does, from this package's dependencies. */
async function loadStylesheet(id: string, base: string) {
  const path = id.startsWith('.') ? join(base, id) : require.resolve(id);
  return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
}

const options = { base: HERE, loadStylesheet };

/** How many of a functional utility's named values to take: first, last, and some between. */
export const SPREAD = 4;

/** Up to how many values a utility has all of them taken, rather than a spread. */
export const WHOLE = 12;

/**
 * The arbitrary values tried against every functional utility. Tailwind decides which it takes
 * from each value's type, so a length goes to `w-`, a colour to `bg-`, an angle to `rotate-`.
 */
const ARBITRARY = [
  '[13px]',
  '[1.25rem]',
  '[37%]',
  '[0.35]',
  '[3]',
  '[30deg]',
  '[#1a2b3c]',
  '[rgb(10,20,30)]',
  '[calc(1rem+2px)]',
  '[200ms]',
  '(--x)',
];

/**
 * The names `tailwind-sweep-theme.css` gives its values, tried against every functional utility as
 * the arbitrary values are: sampling a spread of each utility's values would pass over them.
 */
export const THEME_VALUES = [
  'brand',
  'brand-soft',
  'gutter',
  'display',
  'huge',
  'pill',
  'soft',
  'snappy',
  'wiggle',
];

/**
 * The utilities a variant is tried on: a length, a colour, a plain number, and an arbitrary
 * value with commas in it, which a selector has to escape.
 */
export const VARIANT_PROBES = ['p-4', 'bg-red-500', 'opacity-50', 'bg-[rgb(1,2,3)]'];

/** Variants stacked, which Tailwind writes as one selector nested in another. */
export const STACKED_VARIANTS = [
  'dark:android',
  'ios:dark',
  'dark:ios:active',
  'android:dark:disabled',
];

/** Arbitrary variants, which have no name to list. */
const ARBITRARY_VARIANTS = [
  '[&>*]',
  '[.x_&]',
  '[&:nth-child(3)]',
  '[@media(min-width:500px)]',
  'data-[state=open]',
  'aria-[sort=ascending]',
  'group-[.is-x]',
  'supports-[display:flex]',
  'min-[400px]',
  'max-[600px]',
];

/** The root a listed class belongs to: the longest utility name it starts with. */
export function rootOf(name: string, roots: readonly string[]): string {
  const bare = name.replace(/^-/, '');
  return roots.find((root) => bare === root || bare.startsWith(`${root}-`)) ?? bare;
}

/** A spread of a list: its first and last, and evenly between. */
export function spread<T>(list: readonly T[], count: number): T[] {
  if (list.length <= count) return [...list];
  if (count === 1) return [list[Math.floor(list.length / 2)]!];
  return Array.from(
    { length: count },
    (_, i) => list[Math.round((i * (list.length - 1)) / (count - 1))]!,
  );
}

let cached: Promise<{ css: string; cases: SweepCase[] }> | undefined;

/** The cases, and the one stylesheet Tailwind builds for all of them, as an app's build would. */
export function sweep(): Promise<{ css: string; cases: SweepCase[] }> {
  return (cached ??= build());
}

/** The stylesheet for some of the cases only, from a compiler of its own: builds accumulate. */
export async function buildFor(
  cases: readonly SweepCase[],
  preset: 'native' | 'web' = 'native',
): Promise<string> {
  const compiler = await tailwind.compile(entry(preset), options);
  return compiler.build(cases.flatMap((test) => test.classes));
}

async function build() {
  const system = await tailwind.__unstable__loadDesignSystem(ENTRY, options);
  const valid = (candidates: string[]) => {
    const css = system.candidatesToCss(candidates);
    return candidates.filter((_, i) => css[i] !== null);
  };

  const functional = system.utilities.keys('functional');
  // Longest first, so `translate-x` claims `translate-x-2` before `translate` can.
  const roots = [...functional].sort((a, b) => b.length - a.length);

  const statics = new Set(system.utilities.keys('static'));
  const byRoot = new Map<string, string[]>();
  for (const [name] of system.getClassList()) {
    const root = statics.has(name) ? name : rootOf(name, roots);
    byRoot.set(root, [...(byRoot.get(root) ?? []), name]);
  }
  const utilities = [...byRoot.values()].flatMap((names) => {
    const positive = names.filter((name) => !name.startsWith('-'));
    const negative = names.filter((name) => name.startsWith('-'));
    // A handful of values is taken whole: those are keywords, each its own path (`animate-spin`
    // is not `animate-pulse`). A scale is sampled, since `p-4` and `p-5` are one path.
    const sampled = positive.length <= WHOLE ? positive : spread(positive, SPREAD);
    return [...sampled, ...spread(negative, 1)];
  });

  const arbitrary = valid(
    functional.flatMap((root) => [
      // A negative utility is a root of its own in Tailwind's list (`-rotate`, `-inset`), so
      // this is every negated arbitrary value too: `-rotate-[30deg]` as well as `-mt-[13px]`.
      ...ARBITRARY.map((value) => `${root}-${value}`),
      ...THEME_VALUES.map((value) => `${root}-${value}`),
      `${root}-brand/50`,
      `${root}-red-500/50`,
      `${root}-[#1a2b3c]/[0.3]`,
    ]),
  ).filter((name, i, all) => !utilities.includes(name) && all.indexOf(name) === i);

  const variants = valid([
    ...system.getVariants().flatMap(({ name, values, isArbitrary, hasDash }) => {
      if (isArbitrary && !values.length) return [];
      const spelled = values.length
        ? spread(values, 2).map((value) => (hasDash ? `${name}-${value}` : `${name}${value}`))
        : [name];
      return spelled.flatMap((variant) => VARIANT_PROBES.map((probe) => `${variant}:${probe}`));
    }),
    ...[...ARBITRARY_VARIANTS, ...STACKED_VARIANTS].flatMap((variant) =>
      VARIANT_PROBES.map((probe) => `${variant}:${probe}`),
    ),
  ]);

  const singles = [...new Set([...utilities, ...arbitrary])];
  const important = valid(singles.map((name) => `${name}!`));

  const compiler = await tailwind.compile(ENTRY, options);
  // Found among every named utility, not the sample: `drop-shadow-lg`'s colour classes are all
  // `drop-shadow-*` values, and a sample of four can hold none of them. Named only: an arbitrary
  // value stands for a whole type, not for one slot.
  const named = system.getClassList().map(([name]) => name);
  const overlaps = OVERLAPS.filter((pair) => valid(pair).length === pair.length);
  // A compiler of its own: `build` keeps every candidate it has seen, and all of them in the
  // sweep's sheet is every utility Tailwind has, where the sweep samples them.
  const everything = (await tailwind.compile(ENTRY, options)).build(named);
  const pairs = [...slotPairs(everything, new Set(named)), ...overlaps];
  // The pairs are read out of Tailwind's CSS by its layout, so a release that writes it another
  // way would find fewer of them, and the sweep would narrow without a word.
  const missing = Object.entries(PAIR_FAMILIES)
    .filter(([, family]) => !pairs.some((pair) => pair.every((c) => family.test(c))))
    .map(([name]) => name);
  if (missing.length) throw new Error(`no pairs found for ${missing.join(', ')}: see slotsIn`);
  const css = compiler.build([...singles, ...important, ...variants, ...pairs.flat()]);

  const cases: SweepCase[] = [
    ...utilities.map((name) => one(name, 'utility')),
    ...arbitrary.map((name) => one(name, 'arbitrary')),
    ...important.map((name) => one(name, 'important')),
    ...variants.map((name) => one(name, 'variant')),
    ...pairs.map((classes) => ({ name: classes.join(' '), classes, kind: 'pair' as const })),
  ];
  return { css, cases };
}

const one = (name: string, kind: SweepCase['kind']): SweepCase => ({
  name,
  classes: [name],
  kind,
});

/**
 * A shorthand beside one of its sides, where the web's answer is source order and native's is the
 * more specific edge: the two agree only because Tailwind writes the side after the shorthand.
 */
export const OVERLAPS = [
  ['p-4', 'pt-2'],
  ['p-4', 'px-2'],
  ['px-4', 'pl-2'],
  ['px-4', 'ps-2'],
  ['p-4', 'pe-2'],
  ['m-4', 'mt-2'],
  ['mx-4', 'ml-2'],
  ['mx-4', 'ms-2'],
  ['m-4', 'me-2'],
  ['my-4', 'mb-2'],
  ['border-4', 'border-t-2'],
  ['border-x-4', 'border-l-2'],
  ['border-4', 'border-s-2'],
  ['border-red-500', 'border-t-blue-500'],
  ['border-x-red-500', 'border-s-blue-500'],
  ['rounded-lg', 'rounded-t-none'],
  ['rounded-lg', 'rounded-tl-none'],
  ['rounded-lg', 'rounded-s-none'],
  ['inset-0', 'top-2'],
  ['inset-x-0', 'left-2'],
  ['inset-x-0', 'start-2'],
  ['gap-4', 'gap-x-2'],
  ['size-10', 'w-4'],
  ['text-lg', 'leading-6'],
];

/** Families that compose one value out of several classes, each of which must have a pair. */
const PAIR_FAMILIES: Record<string, RegExp> = {
  translate: /^-?translate-/,
  scale: /^-?scale-/,
  'shadows and rings': /^(shadow|ring|inset-shadow|inset-ring)/,
  'drop shadow': /^(android:)?drop-shadow-/,
  'text shadow': /^text-shadow-/,
  space: /^-?space-[xy]-/,
  divide: /^divide-/,
  'numeric variants':
    /^(tabular|oldstyle|lining|proportional)-nums|^(ordinal|slashed-zero|diagonal-fractions)$/,
  filters: /^(android:)?(blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia)/,
};

/** A slot's value that says nothing about what reads it. */
const NOTHING = /^(initial|inherit|unset|currentcolor|transparent|none|0[a-z%]*|0 0 #0000)$/i;

/** The slots of a filter, which is drawn on Android only: a pair of them is tried there. */
const ANDROID_ONLY = /^--tw-(blur|contrast|grayscale|hue-rotate|invert|saturate|sepia|drop-shadow)/;

/**
 * Pairs of utilities that make one value between them: the shape of every value Tailwind composes
 * out of several classes. Two kinds:
 *
 * - one sets a `--tw-*` property the other reads without setting it, `translate-x-2` and
 *   `translate-y-4`: one setter per property, and a spread of the readers of each property it is
 *   read in, since a reader can be refused for a reason of its own;
 * - one sets, without reading, a property the other both sets and reads: `drop-shadow-red-500`
 *   sets again the `--tw-drop-shadow` that `drop-shadow-lg` sets and draws.
 *
 * A pair of filter slots is written for Android too, where a filter is drawn.
 */
export function slotPairs(css: string, singles: Set<string>): string[][] {
  const { setters, readers, overriders, owners } = slotsIn(css, singles);
  const pairs = new Map<string, string[]>();
  const add = (slot: string, pair: string[]) => {
    pairs.set(pair.join(' '), pair);
    if (!ANDROID_ONLY.test(slot)) return;
    const android = pair.map((name) => `android:${name}`);
    pairs.set(android.join(' '), android);
  };
  for (const [slot, byProperty] of readers) {
    // The middle setter that sets a value, not a keyword or a zero, which prove nothing.
    const [set] = spread(setters.get(slot) ?? [], 1);
    if (!set) continue;
    for (const list of byProperty.values()) {
      for (const reader of spread(list, 3)) if (reader !== set) add(slot, [reader, set]);
    }
  }
  for (const [slot, list] of overriders) {
    const [override] = spread(list, 1);
    for (const owner of spread(owners.get(slot) ?? [], 3)) add(slot, [owner, override!]);
  }
  return [...pairs.values()];
}

/** The slots one rule sets, with their values, and those it reads, with the property reading. */
function slotsOfRule(body: string) {
  const declared = new Map(
    [...body.matchAll(/(--tw-[\w-]+)\s*:\s*([^;]+)/g)].map((match) => [
      match[1]!,
      match[2]!.trim(),
    ]),
  );
  const read = new Map<string, string>();
  for (const [, property, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
    for (const [, slot] of value!.matchAll(/var\(\s*(--tw-[\w-]+)/g)) {
      if (!read.has(slot!)) read.set(slot!, property!);
    }
  }
  return { declared, read };
}

/**
 * Which utilities set each `--tw-*` property; which read it without setting it, by the property
 * it is read in; which set it without reading it; and which set it and read it.
 *
 * A rule is a class, or a class's children, as `space-x-2` writes them:
 * `:where(.space-x-2 > :not(:last-child))`.
 */
function slotsIn(css: string, singles: Set<string>) {
  const setters = new Map<string, string[]>();
  const readers = new Map<string, Map<string, string[]>>();
  const overriders = new Map<string, string[]>();
  const owners = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, name: string) =>
    map.set(key, [...(map.get(key) ?? []), name]);
  // A colour's `@supports` fallback nests a block in the rule: its declarations are the rule's.
  const flat = css.replace(/@supports[^{]*\{([^{}]*)\}/g, '$1');
  // Tailwind 3 writes the children as `.space-x-2 > :not([hidden]) ~ :not([hidden])`.
  const rules = flat.matchAll(
    /\n(?:\.((?:\\.|[\w-])+)(?: > :not\(\[hidden\]\) ~ :not\(\[hidden\]\))?|:where\(\.((?:\\.|[\w-])+) > [^{]*\))\s*\{([^{}]*)\}/g,
  );
  for (const [, plain, children, body] of rules) {
    const name = (plain ?? children)!.replace(/\\(.)/g, '$1');
    if (!singles.has(name)) continue;
    const { declared, read } = slotsOfRule(body!);
    for (const [slot, property] of read) {
      if (declared.has(slot)) continue;
      const byProperty = readers.get(slot) ?? new Map<string, string[]>();
      push(byProperty, property, name);
      readers.set(slot, byProperty);
    }
    for (const [slot, value] of declared) {
      const says = !NOTHING.test(value);
      if (read.has(slot)) push(owners, slot, name);
      else if (says) push(overriders, slot, name);
      if (says) push(setters, slot, name);
    }
  }
  return {
    setters,
    readers,
    overriders: new Map([...overriders].filter(([slot]) => owners.has(slot))),
    owners,
  };
}
