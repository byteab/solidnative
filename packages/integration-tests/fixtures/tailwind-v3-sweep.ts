/**
 * Every Tailwind 3 utility, as cases: the same sweep as `tailwind-sweep.ts`, built by Tailwind 3
 * through `@solidnative/tailwind/preset.cjs`.
 *
 * The list comes from Tailwind 3's own context, `getClassList()` and `getVariants()`, with the
 * preset and an app's theme loaded, so a utility the preset or a Tailwind 3 release adds is
 * covered without anyone writing it down. The cases are chosen by the same rules as Tailwind 4's:
 * a spread of each utility's values, arbitrary and theme values, important, every variant on the
 * same probes, and the pairs that fill slots of one composed value, found from the CSS. What
 * differs is only how Tailwind 3 spells them: `!p-4` for important, `[var(--x)]` for a variable.
 *
 * Built with `safelist` rather than scanned content, so every case is generated exactly as named:
 * Tailwind 3's content scanner splits an arbitrary value with commas or brackets in it.
 */
import { createRequire } from 'node:module';
import {
  OVERLAPS,
  rootOf,
  slotPairs,
  spread,
  SPREAD,
  STACKED_VARIANTS,
  THEME_VALUES,
  VARIANT_PROBES,
  WHOLE,
  WORLDS as ALL_WORLDS,
  type SweepCase,
  type World,
} from './tailwind-sweep.ts';

export { measuredIn } from './tailwind-sweep.ts';

const require = createRequire(import.meta.url);
const V3 = 'tailwindcss-v3';
const tailwind = require(V3) as (config: object) => object;
const resolveConfig = require(`${V3}/resolveConfig`) as (config: object) => object;
const { createContext } = require(`${V3}/lib/lib/setupContextUtils`) as {
  createContext(config: object): Context;
};
const { generateRules } = require(`${V3}/lib/lib/generateRules`) as {
  generateRules(candidates: Set<string>, context: Context): unknown[];
};
// Tailwind 3's own PostCSS, so the plugin runs against the version it was built with.
const postcss = createRequire(require.resolve(`${V3}/package.json`))('postcss') as (
  plugins: object[],
) => { process(css: string, options: object): Promise<{ css: string }> };
const preset = require('@solidnative/tailwind/preset.cjs') as object;

interface Context {
  getClassList(options: { includeMetadata: true }): (string | [string, object])[];
  getVariants(): { name: string; values: string[]; isArbitrary: boolean; hasDash: boolean }[];
  candidateRuleMap: Map<string, [object, unknown][]>;
}

/** Tailwind 3 is native-only: there is no web preset to build it for. */
export const WORLDS: readonly World[] = ALL_WORLDS.filter((world) => world.name !== 'web');

/**
 * `tailwind-sweep-theme.css`, as a Tailwind 3 app writes it: the same names and values, in a
 * `tailwind.config.js`, with its utilities and variants as a plugin.
 */
const APP = {
  theme: {
    extend: {
      colors: { brand: 'oklch(0.62 0.19 255)', 'brand-soft': '#ff00ff80' },
      spacing: { gutter: '18px' },
      fontFamily: { display: ['Avenir Next', 'system-ui', 'sans-serif'] },
      fontSize: { huge: ['3.5rem', { lineHeight: '1.1' }] },
      borderRadius: { pill: '999px' },
      // In pixels, as the rest of Tailwind 3's are: with mixed units it refuses `min-[400px]:`.
      screens: { '3xl': '1600px' },
      boxShadow: { soft: '0 2px 6px rgb(0 0 0 / 0.2)' },
      transitionTimingFunction: { snappy: 'cubic-bezier(0.2, 0, 0, 1)' },
      animation: { wiggle: 'wiggle 1s ease-in-out infinite' },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
    },
  },
  plugins: [
    ({ addUtilities, addVariant, matchUtilities, theme }: Record<string, Function>) => {
      addUtilities!({
        '.content-auto': { 'content-visibility': 'auto' },
        '.card-frame': { 'border-width': '1px', 'border-radius': '999px', padding: '18px' },
      });
      matchUtilities!(
        { gutter: (value: string) => ({ 'padding-inline': value }) },
        { values: theme!('spacing') },
      );
      addVariant!('pocket', '&:where(.pocket, .pocket *)');
      addVariant!('midnight', "&:where([data-theme='midnight'], [data-theme='midnight'] *)");
    },
  ],
};

/** The app's config: the native preset under the app's theme, generating exactly `safelist`. */
const configFor = (safelist: readonly string[], preflight = false) => ({
  presets: [preset],
  ...APP,
  content: [{ raw: '' }],
  safelist: [...safelist],
  ...(preflight ? { corePlugins: { preflight: true } } : {}),
});

const ENTRY = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n';

/** Tailwind 3's CSS for exactly these classes, as its CLI would write it. */
async function css(classes: readonly string[]): Promise<string> {
  const result = await postcss([tailwind(configFor(classes))]).process(ENTRY, { from: undefined });
  return result.css;
}

/**
 * Tailwind 3's preflight, built rather than read: the file on disk still has its `theme()` calls
 * in it, which a browser drops.
 */
export async function preflight(): Promise<string> {
  const plugin = tailwind(configFor([], true));
  return (await postcss([plugin]).process('@tailwind base;', { from: undefined })).css;
}

/** Tailwind 3's spelling of the arbitrary values `tailwind-sweep.ts` tries: no `(--x)`. */
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
  '[var(--x)]',
];

/** Arbitrary variants, which have no name to list: Tailwind 4's, as far as Tailwind 3 has them. */
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

let cached: Promise<{ css: string; cases: SweepCase[] }> | undefined;

/** The cases, and the one stylesheet Tailwind 3 builds for all of them. */
export function sweep(): Promise<{ css: string; cases: SweepCase[] }> {
  return (cached ??= build());
}

/** The stylesheet for some of the cases only. */
export function buildFor(cases: readonly SweepCase[]): Promise<string> {
  return css(cases.flatMap((test) => test.classes));
}

async function build() {
  const context = createContext(resolveConfig(configFor([])));
  const valid = (candidates: readonly string[]) =>
    candidates.filter((name) => generateRules(new Set([name]), context).length > 0);

  const keys = [...context.candidateRuleMap.keys()];
  const functional = keys.filter((key) =>
    context.candidateRuleMap.get(key)!.some(([, rule]) => typeof rule === 'function'),
  );
  // Longest first, so `translate-x` claims `translate-x-2` before `translate` can.
  const roots = [...functional].sort((a, b) => b.length - a.length);
  const statics = new Set(keys.filter((key) => !functional.includes(key)));

  const named = context
    .getClassList({ includeMetadata: true })
    .map((entry) => (typeof entry === 'string' ? entry : entry[0]));
  const byRoot = new Map<string, string[]>();
  for (const name of named) {
    const root = statics.has(name) ? name : rootOf(name, roots);
    byRoot.set(root, [...(byRoot.get(root) ?? []), name]);
  }
  const utilities = [...byRoot.values()].flatMap((names) => {
    const positive = names.filter((name) => !name.startsWith('-'));
    const negative = names.filter((name) => name.startsWith('-'));
    const sampled = positive.length <= WHOLE ? positive : spread(positive, SPREAD);
    return [...sampled, ...spread(negative, 1)];
  });

  const arbitrary = valid(
    functional.flatMap((root) => [
      ...ARBITRARY.map((value) => `${root}-${value}`),
      ...THEME_VALUES.map((value) => `${root}-${value}`),
      `${root}-brand/50`,
      `-${root}-[13px]`,
      `${root}-red-500/50`,
      `${root}-[#1a2b3c]/[0.3]`,
    ]),
  ).filter((name, i, all) => !utilities.includes(name) && all.indexOf(name) === i);

  const variants = valid([
    ...context.getVariants().flatMap(({ name, values, isArbitrary, hasDash }) => {
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
  const important = valid(singles.map((name) => `!${name}`));

  const overlaps = [...OVERLAPS, ...AXES].filter((pair) => valid(pair).length === pair.length);
  const everything = await css(named);
  const pairs = [...slotPairs(everything, new Set(named)), ...overlaps];
  // Read out of Tailwind 3's CSS by its layout, as Tailwind 4's are: a release that writes it
  // another way would find fewer, and the sweep would narrow without a word.
  const missing = Object.entries(PAIR_FAMILIES)
    .filter(([, family]) => !pairs.some((pair) => pair.every((c) => family.test(c))))
    .map(([name]) => name);
  if (missing.length) throw new Error(`no pairs found for ${missing.join(', ')}: see slotsIn`);
  const all = await css([...singles, ...important, ...variants, ...pairs.flat()]);

  const cases: SweepCase[] = [
    ...utilities.map((name) => one(name, 'utility')),
    ...arbitrary.map((name) => one(name, 'arbitrary')),
    ...important.map((name) => one(name, 'important')),
    ...variants.map((name) => one(name, 'variant')),
    ...pairs.map((classes) => ({ name: classes.join(' '), classes, kind: 'pair' as const })),
  ];
  return { css: all, cases };
}

/**
 * The two axes of a transform utility, together. Tailwind 3 reads every transform slot in one
 * `transform`, so the readers `slotPairs` samples for `--tw-scale-x` are dozens of transform
 * utilities, and a sample of three held no `scale-y-*`.
 */
const AXES = [
  ['scale-x-50', 'scale-y-75'],
  ['translate-x-2', 'translate-y-4'],
  ['ios:skew-x-3', 'ios:skew-y-6'],
];

/**
 * Families that compose one value out of several classes in Tailwind 3, each of which must have a
 * pair. Tailwind 4's list without text shadows and drop shadow colours, which Tailwind 3 does not
 * have, and with the two it composes that Tailwind 4 does not: opacity utilities and gradients.
 */
const PAIR_FAMILIES: Record<string, RegExp> = {
  translate: /^-?translate-/,
  scale: /^-?scale-/,
  'shadows and rings': /^(shadow|ring)/,
  space: /^-?space-[xy]-/,
  divide: /^divide-/,
  'numeric variants':
    /^(tabular|oldstyle|lining|proportional)-nums|^(ordinal|slashed-zero|diagonal-fractions)$/,
  filters: /^(android:)?(blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia)/,
  opacity: /^(bg|text|border|ring|divide|placeholder)-/,
  gradients: /^(bg-gradient-to|from|via|to)-/,
};

const one = (name: string, kind: SweepCase['kind']): SweepCase => ({
  name,
  classes: [name],
  kind,
});
