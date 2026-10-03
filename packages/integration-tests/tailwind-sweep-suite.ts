/**
 * Every Tailwind utility, compiled: see `fixtures/tailwind-sweep.ts` for what the cases are.
 *
 * The cases are built into one stylesheet, as an app that used all of them would be, and that
 * sheet goes through `flattenTailwind` and the compiler as it would in a build. Then, for every
 * case, one of two things must be true:
 *
 * - **It does something.** A compiled rule for it has a declaration, a token or a value settled on
 *   device.
 * - **It says why not.** A build warning names the rule it was written in.
 *
 * A case that does neither is the failure this project fears most: a class that compiles cleanly
 * and does nothing, with nothing to say so. What is refused, and why, is kept as a snapshot, so
 * a change that refuses something new, or stops refusing something, is a diff to read:
 *
 *   TAILWIND_SWEEP_UPDATE=1 node --import @solidnative/testing/register --test tailwind-sweep.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Engine, StyleResolver, type StyleSheet, type StyleTarget } from '@solidnative/fabric';
import { createFakeFabric, type FakeFabricNode } from '@solidnative/testing';
import { committedProps } from './tailwind-cli.ts';
import { compare, isDuplicate, ours, sameComposedTransform } from './computed-style.ts';
import { layOut, MEASURED, SCENE, type Box } from './layout.ts';
import { reactNativeProps } from './react-native-styles.ts';
import {
  ROOT_CLASSES,
  ROOT_CSS,
  STATE_ATTRIBUTES,
  STATE_CLASSES,
  TRANSFORM_BOX,
  type SweepCase,
  type World,
} from './fixtures/tailwind-sweep.ts';

const require = createRequire(import.meta.url);
const { flattenTailwind } = require('@solidnative/tailwind') as {
  flattenTailwind(css: string): string;
};
const { compileCss } = require('@solidnative/metro/css/compile.cjs') as {
  compileCss(css: string, context: string, options: object): StyleSheet;
};

/** What one Tailwind version's sweep is made of: see `tailwind-sweep.test.ts` for the fields. */
export interface SweepConfig {
  readonly title: string;
  /** The cases, and the one stylesheet built for all of them. */
  readonly sweep: () => Promise<{ css: string; cases: SweepCase[] }>;
  /** The stylesheet for some of the cases only. */
  readonly buildFor: (cases: readonly SweepCase[]) => Promise<string>;
  readonly worlds: readonly World[];
  readonly measuredIn: (world: World, cases: readonly SweepCase[]) => SweepCase[];
  /** The refusal snapshot and the Chrome oracle, as fixture file names. */
  readonly snapshot: string;
  readonly oracle: string;
  readonly deliberate: readonly Accounted[];
  readonly known: readonly Accounted[];
  readonly yoga: readonly Accounted[];
  readonly silentByDesign: readonly (readonly [RegExp, string])[];
  readonly silentKnown: readonly (readonly [RegExp, string])[];
  readonly undeclared: readonly Accounted[];
}

// One test file is one process, so the version under test can be module state: set once, by
// `defineSweep`, before anything reads it.
let buildFor: SweepConfig['buildFor'];
let measuredIn: SweepConfig['measuredIn'];
let WORLDS: readonly World[];
let WORLDS_BY_NAME: Record<string, World>;
let SNAPSHOT: string;
let ORACLE: string;
let DELIBERATE: readonly Accounted[];
let KNOWN: readonly Accounted[];
let YOGA: readonly Accounted[];
let SILENT_BY_DESIGN: readonly (readonly [RegExp, string])[];
let SILENT_KNOWN: readonly (readonly [RegExp, string])[];
let UNDECLARED: readonly Accounted[];

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** A class name as a selector writes it: every character that is not a name character escaped. */
const escaped = (name: string) => `.${name.replace(/[^\w-]/g, (c) => `\\${c}`)}`;

interface Outcome {
  /** Case name to the reasons its rules were refused. */
  readonly refused: Map<string, string[]>;
  readonly silent: string[];
}

/**
 * Which cases took effect, which were refused and why, and which did neither.
 *
 * A refusal names a line of the flattened sheet; the selector of the rule on that line says which
 * cases it belongs to.
 */
function outcomes(
  cases: readonly SweepCase[],
  flat: string,
  sheet: StyleSheet,
  messages: string[],
) {
  const effective = effectiveClasses(sheet);
  const reasonsByBlock = refusalsByBlock(flat, messages);
  // Each refused block under every class it names, so a case looks up its own classes rather than
  // testing every block: Tailwind 3's sweep refuses thousands of blocks, and testing each against
  // each case never finished.
  const blocksByClass = new Map<string, [string, string[]][]>();
  for (const entry of reasonsByBlock) {
    const names = new Set(
      [...entry[0].matchAll(/\.((?:\\.|[\w-])+)/g)].map((m) => m[1]!.replace(/\\(.)/g, '$1')),
    );
    for (const name of names) blocksByClass.set(name, [...(blocksByClass.get(name) ?? []), entry]);
  }
  const refused = new Map<string, string[]>();
  const silent: string[] = [];
  for (const test of cases) {
    const blocks = new Set(test.classes.flatMap((name) => blocksByClass.get(name) ?? []));
    const reasons = [...blocks].flatMap(([, list]) => list);
    if (reasons.length) refused.set(test.name, reasons);
    const tookEffect = test.classes.some((name) => effective.has(name));
    if (!tookEffect && !reasons.length) silent.push(test.name);
  }
  return { refused, silent } satisfies Outcome;
}

/**
 * The classes some compiled rule does something for. An ancestor's counts too: `**:p-4` styles
 * the descendants of whatever wears it; and so does one inside `:where()`, as `space-x-2` is.
 */
function effectiveClasses(sheet: StyleSheet): Set<string> {
  const effective = new Set<string>();
  for (const rule of sheet.rules) {
    const hasEffect =
      Object.keys(rule.declarations).length ||
      Object.keys(rule.important ?? {}).length ||
      Object.keys(rule.tokens ?? {}).length ||
      rule.deferred?.length;
    if (!hasEffect) continue;
    for (const name of rule.compounds.flatMap(classesIn)) effective.add(name);
  }
  return effective;
}

/** A compound's classes, its ancestors' and those inside its `:where()`. */
const classesIn = (compound: StyleSheet['rules'][number]['compounds'][number]): string[] => [
  ...compound.classes,
  ...(compound.ancestors ?? []).flatMap((ancestor) => ancestor.classes),
  ...(compound.is ?? []).flat().flatMap((inner) => inner.classes),
];

/** Each refusal's reason, under the text of the block its line is in. */
function refusalsByBlock(flat: string, messages: readonly string[]): Map<string, string[]> {
  const lines = flat.split('\n');
  const reasons = new Map<string, string[]>();
  for (const message of messages) {
    const match = /^tailwind:(\d+): (.*)$/s.exec(message);
    if (!match) continue;
    const block = blockAt(lines, Number(match[1]) - 1);
    reasons.set(block, [...(reasons.get(block) ?? []), match[2]!]);
  }
  return reasons;
}

/**
 * The block a refusal's line belongs to, as text: the rule or at-rule that starts on it, or the
 * rule a declaration on it is in. An at-rule's block holds the selectors it applies to.
 */
function blockAt(lines: readonly string[], index: number): string {
  let start = index;
  while (start > 0 && !lines[start]!.includes('{')) start--;
  let depth = 0;
  for (let end = start; end < lines.length; end++) {
    depth += (lines[end]!.match(/\{/g) ?? []).length - (lines[end]!.match(/\}/g) ?? []).length;
    if (depth <= 0) return lines.slice(start, end + 1).join('\n');
  }
  return lines.slice(start).join('\n');
}

/** Refusals grouped by reason, with a line's own number and the case's values taken out. */
function byReason(refused: Map<string, string[]>): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const [name, reasons] of refused) {
    for (const reason of new Set(reasons.map(normalised))) (groups[reason] ??= []).push(name);
  }
  return Object.fromEntries(
    Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([reason, names]) => [reason, names.sort()]),
  );
}

/**
 * A reason with what varies between cases of one kind removed, so each kind is one group: the
 * property it names is kept, and the values quoted after it and every number are folded.
 */
function normalised(reason: string): string {
  let quotes = 0;
  return reason
    .replace(/'[^']*'/g, (quoted) => (quotes++ === 0 ? quoted : "'…'"))
    .replace(/\d+(\.\d+)?/g, 'N');
}

/** The sheet flattened and compiled as a build does it, with every refusal collected. */
function compile(css: string) {
  const flat = flattenTailwind(`${css}\n${ROOT_CSS}`);
  const messages: string[] = [];
  const sheet = compileCss(flat, 'tailwind', {
    onUnsupported: (message: string) => messages.push(message),
  });
  return { flat, sheet, messages };
}

/**
 * The cases that make the build throw, found by halving: a throw fails a whole app's build, so
 * the one that did it has to be named.
 */
async function throwers(cases: readonly SweepCase[]): Promise<string[]> {
  try {
    compile(await buildFor(cases));
    return [];
  } catch (error) {
    if (cases.length === 1) return [`${cases[0]!.name}: ${(error as Error).message}`];
    const half = Math.ceil(cases.length / 2);
    return [...(await throwers(cases.slice(0, half))), ...(await throwers(cases.slice(half)))];
  }
}

/** The properties a case's refusals name; every property, when a whole rule was refused. */
function refusedProperties(reasons: readonly string[]): Set<string> | 'all' {
  const names = new Set<string>();
  for (const reason of reasons) {
    if (reason.startsWith('dropped a rule')) return 'all';
    const name = /^dropped '([^']+)'/.exec(reason)?.[1];
    if (name) names.add(name);
    // `zoom` scales every length the element computes, so nothing in the case can be compared.
    if (name === 'zoom') return 'all';
    // A slot refused for the property it is read in: `--tw-blur` for `filter: blur() ...`.
    const property = /^dropped '[^']+': ([a-z-]+): /.exec(reason)?.[1];
    if (property) names.add(property);
    for (const longhand of SHORTHANDS[name ?? ''] ?? []) names.add(longhand);
  }
  return names;
}

/** The longhands a refused shorthand stood for, where their names do not say so. */
const SHORTHANDS: Record<string, readonly string[]> = {
  'place-content': ['align-content', 'justify-content'],
  'place-items': ['align-items', 'justify-items'],
  'place-self': ['align-self', 'justify-self'],
  // Native has one overflow for both axes, and CSS turns the other axis to auto when one is set.
  'overflow-x': ['overflow-y'],
  'overflow-y': ['overflow-x'],
  'white-space': ['text-wrap-mode', 'white-space-collapse'],
  // A logical side, in the left-to-right layout the sweep has.
  'margin-inline-start': ['margin-left'],
  'margin-inline-end': ['margin-right'],
  'margin-block-start': ['margin-top'],
  'margin-block-end': ['margin-bottom'],
  'border-inline-start-width': ['border-left-width'],
  'border-inline-end-width': ['border-right-width'],
};

/**
 * Whether a refusal of `refused` accounts for Chrome's `property`: itself; a part of it
 * (`transition` for `transition-duration`); one side of it (`border-style` for
 * `border-top-style`); or a sibling in a family native has none of (`mask-image` for `mask-clip`).
 */
function covers(refused: string, property: string): boolean {
  if (
    refused === property ||
    property.startsWith(`${refused}-`) ||
    refused.startsWith(`${property}-`)
  ) {
    return true;
  }
  const [head, ...rest] = refused.split('-');
  const tail = rest.at(-1);
  if (tail && new RegExp(`^${head}-[a-z-]+-${tail}$`).test(property)) return true;
  return UNSUPPORTED_FAMILIES.some((family) => family.test(refused) && family.test(property));
}

/** Families of properties native has none of, so one refusal stands for all of them. */
const UNSUPPORTED_FAMILIES = [
  /^(content-visibility|contain)/,
  /^-?(webkit-)?mask/,
  /^grid/,
  /^scroll-/,
  /^column/,
  /^break-/,
  /^contain/,
  /^scrollbar/,
  /^list-style/,
  /^animation/,
];

const cap = (word: string) => word[0]!.toUpperCase() + word.slice(1);

/** A difference with Chrome that is accounted for: which cases and properties, and why. */
export interface Accounted {
  /** Only in this world; left out, in any. */
  readonly world?: string;
  /** Only on a text inside the case; left out, anywhere. */
  readonly where?: 'child';
  readonly property: RegExp;
  readonly case?: RegExp;
  /** For a deliberate difference, the browser values it covers. */
  readonly browser?: RegExp;
  readonly reason: string;
}

/**
 * Whether a case's line height is the 1.5 every web page inherits from preflight's `html`, applied
 * to the case's own font size. Native has no inherited line-height ratio to apply: see
 * supported-css.md.
 */
function inheritedRatio(chrome: ReadonlyMap<string, string>): boolean {
  const [size, height] = [chrome.get('font-size'), chrome.get('line-height')];
  return (
    size !== undefined &&
    height !== undefined &&
    Math.abs(parseFloat(height) - 1.5 * parseFloat(size)) < 0.01
  );
}

/** The CSS properties one of our props says something about, for the reverse comparison. */
const CSS_OF: Record<string, string | readonly string[]> = {
  numberOfLines: ['-webkit-line-clamp', 'text-wrap-mode'],
  flexDirection: ['flex-direction', '-webkit-box-orient'],
  overflow: 'overflow-x',
  $transition: 'transition-property',
  $transitionDuration: 'transition-duration',
  $transitionDelay: 'transition-delay',
  $transitionEasing: 'transition-timing-function',
  $animation: 'animation-name',
  borderBlockColor: ['border-block-start-color', 'border-top-color'],
  textShadowOffset: 'text-shadow',
  textShadowRadius: 'text-shadow',
  textShadowColor: 'text-shadow',
  __translate: 'translate',
  __rotate: 'rotate',
  __scale: 'scale',
  resizeMode: 'object-fit',
  selectable: 'user-select',
  ellipsizeMode: 'text-overflow',
  textAlignVertical: 'vertical-align',
  start: 'left',
  end: 'right',
  marginStart: 'margin-left',
  marginEnd: 'margin-right',
  paddingStart: 'padding-left',
  paddingEnd: 'padding-right',
  borderStartWidth: 'border-left-width',
  borderEndWidth: 'border-right-width',
  borderStartColor: 'border-left-color',
  borderEndColor: 'border-right-color',
  borderStyle: 'border-top-style',
  experimental_backgroundImage: 'background-image',
  experimental_backgroundSize: 'background-size',
  experimental_backgroundRepeat: 'background-repeat',
  experimental_backgroundPosition: 'background-position',
};
const cssOf = (key: string): readonly string[] => {
  const known = CSS_OF[key];
  if (known !== undefined) return typeof known === 'string' ? [known] : known;
  return [key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)];
};

/** A value that is what native already has without it: setting it changes nothing. */
function isNativeDefault(value: unknown): boolean {
  return (
    value === 0 ||
    value === 'auto' ||
    value === null ||
    value === undefined ||
    value === 'none' ||
    (Array.isArray(value) && (value.length === 0 || value.every(transparentGradient)))
  );
}

/** A gradient every stop of which is transparent: `bg-linear-45` with no colour classes. */
function transparentGradient(layer: unknown): boolean {
  const stops = (layer as { colorStops?: { color: unknown }[] } | null)?.colorStops;
  return Array.isArray(stops) && stops.every((stop) => /^rgba\(.*, 0\)$/.test(String(stop.color)));
}

interface Disagreement {
  /** The world it is in, where it is not the base one. */
  readonly world?: string;
  /** Where on the case it is: on a text inside it, for what it hands down. */
  readonly where?: 'child';
  readonly case: string;
  readonly property: string;
  readonly browser?: string;
  readonly text: string;
}

/** What Chrome said in one world: about each case, about an element with no classes, and in the
 * base world about each case's child. */
interface Recorded {
  readonly viewport: { width: number; height: number };
  readonly control: Record<string, string>;
  readonly cases: Record<string, Record<string, string>>;
  readonly children?: Record<string, Record<string, string>>;
}

/**
 * Every property where the engine and Chrome disagree about a case in one world: Chrome sets it,
 * and no refusal says why ours does not match; or ours sets something Chrome does not, to a value
 * that is not what the element has anyway. In the base world, the same for what the case hands
 * down to a child.
 */
function disagreements(
  cases: readonly SweepCase[],
  world: World,
  recorded: Recorded,
  sheet: StyleSheet,
  refused: Map<string, string[]>,
): Disagreement[] {
  // The web host is held to what the engine resolves on a phone, not on a web root it never has.
  const resolve = resolverFor(
    sheet,
    world.name === 'web' ? WORLDS_BY_NAME.base! : world,
    recorded.viewport,
    world.name === 'base',
  );
  const control = resolve([]).own;
  const problems: Disagreement[] = [];
  for (const test of cases) {
    const skipped = refusedProperties(refused.get(test.name) ?? []);
    if (skipped === 'all') continue;
    const { own, child } = resolve(test.classes);
    const all = recorded.cases[test.name] ?? {};
    const label = world.name === 'base' ? test.name : `${test.name} [${world.name}]`;
    const tag = (problem: Disagreement): Disagreement => ({ ...problem, world: world.name });
    problems.push(...whereChromeSets(test.name, label, all, own, skipped).map(tag));
    if (!skipped.size) {
      problems.push(...whereOnlyOursSets(test.name, label, all, own, control, recorded).map(tag));
    }
    const handed = recorded.children?.[test.name];
    if (handed) {
      const inherited = whereChromeSets(test.name, `${label} (child)`, handed, child, skipped);
      problems.push(...inherited.map((problem) => ({ ...problem, where: 'child' as const })));
    }
  }
  return problems;
}

/**
 * The style a node wearing some classes resolves to, and the style of a text inside it, as Chrome
 * was given them: under the world's root, in a wrapper of its own; in the states world the wrapper
 * is a `.group` and a `.peer` comes first, all three with every state attribute set.
 */
function resolverFor(
  sheet: StyleSheet,
  world: World,
  viewport: Recorded['viewport'],
  withChild = world.name === 'base',
) {
  const resolver = new StyleResolver(sheet, { ...viewport, colorScheme: 'light' });
  const states = world.states ? { ...STATE_ATTRIBUTES } : {};
  const target = (
    name: string,
    classes: readonly string[],
    parent: StyleTarget | null,
    props: Record<string, unknown> = {},
  ): StyleTarget => ({
    name,
    parent,
    classes: new Set(classes),
    props,
    sheet: null,
    hostSheet: null,
    styleCache: null,
    styleDirty: true,
  });
  const withChildren = (node: StyleTarget, children: StyleTarget[]) => {
    (node as { children?: StyleTarget[] }).children = children;
  };
  const root = target('view', world.rootClasses.split(' '), null);
  /** With `inside`, the node holds that many views instead, as the layout scene's case does. */
  return (classes: readonly string[], inside = 0) => {
    const wrapper = target('view', world.states ? ['group', ...STATE_CLASSES] : [], root, states);
    const node = target('view', classes, wrapper, states);
    const peer = target('view', ['peer'], wrapper, states);
    withChildren(wrapper, world.states ? [peer, node] : [node]);
    // A child only where Chrome's case has one, so `empty:` matches alike in every world, with a
    // sibling after it, so `space-*` and `divide-*`, which skip the last child, reach it.
    const text = target('text', [], node);
    const boxes = Array.from({ length: inside }, () => target('view', [], node));
    withChildren(node, inside ? boxes : withChild ? [text, target('view', [], node)] : []);
    return {
      own: resolver.resolve(node, 1).style as Record<string, unknown>,
      child: resolver.resolve(text, 1).style as Record<string, unknown>,
      inside: boxes.map((box) => resolver.resolve(box, 1).style as Record<string, unknown>),
    };
  };
}

/** Where Chrome sets a property, and ours does not match nor says why. */
function whereChromeSets(
  name: string,
  label: string,
  all: Record<string, string>,
  style: Record<string, unknown>,
  skipped: Set<string>,
): Disagreement[] {
  const chrome = Object.entries(all).filter(([property]) => !isDuplicate(property));
  const theirs = new Map(chrome);
  const problems: Disagreement[] = [];
  for (const [property, browser] of chrome) {
    if ([...skipped].some((one) => covers(one, property))) continue;
    if (unjudged(property, browser, style, theirs)) continue;
    const verdict = compare(property, browser, style, TRANSFORM_BOX);
    if (verdict.agrees) continue;
    const text = `${label}: chrome ${browser}, ours ${JSON.stringify(verdict.ours)}`;
    problems.push({ case: name, property, browser, text });
  }
  return problems;
}

/** Where ours sets a prop Chrome does not, to something the element does not have anyway. */
function whereOnlyOursSets(
  name: string,
  label: string,
  all: Record<string, string>,
  style: Record<string, unknown>,
  control: Record<string, unknown>,
  recorded: Recorded,
): Disagreement[] {
  const problems: Disagreement[] = [];
  for (const key of Object.keys(style)) {
    if (style[key] === control[key] || isNativeDefault(style[key])) continue;
    const properties = cssOf(key);
    // Chrome set it too, and it was compared already, as the physical property it duplicates.
    if (properties.some((property) => property in all)) continue;
    // What the element has anyway, written out: native starts somewhere else.
    const web = recorded.control[properties[0]!];
    if (web !== undefined && compare(properties[0]!, web, style, TRANSFORM_BOX).agrees) continue;
    const text = `${label}: ours ${JSON.stringify(style[key])}, chrome ${web ?? 'nothing'}`;
    problems.push({ case: name, property: `(ours only) ${key}`, text });
  }
  return problems;
}

/**
 * A property Chrome sets that says nothing about the engine: a border colour with no border to
 * paint, a colour that follows `currentcolor`, the inherited line-height ratio, or a frame of an
 * animation Chrome sampled.
 */
function unjudged(
  property: string,
  browser: string,
  style: Record<string, unknown>,
  theirs: ReadonlyMap<string, string>,
): boolean {
  return (
    invisibleBorderColour(property, style, theirs) ||
    followsCurrentColour(property, browser, style, theirs) ||
    (property === 'line-height' && inheritedRatio(theirs) && style['lineHeight'] === undefined) ||
    animationFrame(property, theirs)
  );
}

/** Preflight's `currentcolor` makes every text colour a border colour, with no border to paint. */
function invisibleBorderColour(
  property: string,
  style: Record<string, unknown>,
  theirs: ReadonlyMap<string, string>,
): boolean {
  const side = /^border-(top|right|bottom|left)-color$/.exec(property)?.[1];
  return (
    !!side && !theirs.has(`border-${side}-width`) && style[`border${cap(side)}Color`] === undefined
  );
}

/**
 * Chrome reports what follows `currentcolor` as the text colour; native draws those in the text
 * colour too, where it has them at all, without a prop saying so.
 */
function followsCurrentColour(
  property: string,
  browser: string,
  style: Record<string, unknown>,
  theirs: ReadonlyMap<string, string>,
): boolean {
  return (
    property !== 'color' && browser === theirs.get('color') && ours(style, property) === undefined
  );
}

/**
 * An animation's longhands mean nothing without a name, and a running one's first frame is not a
 * style: `animate-bounce` is sampled at -25% in Chrome, and played on device.
 */
function animationFrame(property: string, theirs: ReadonlyMap<string, string>): boolean {
  if (property.startsWith('animation-')) return !theirs.has('animation-name');
  return theirs.has('animation-name') && (property === 'transform' || property === 'opacity');
}

/** Whether an accounted-for difference covers a disagreement. */
const matches = (entry: Accounted, problem: Disagreement) =>
  (entry.world === undefined || entry.world === problem.world) &&
  (entry.where === undefined || entry.where === problem.where) &&
  entry.property.test(problem.property) &&
  (entry.case?.test(problem.case) ?? true) &&
  (entry.browser === undefined ||
    (problem.browser !== undefined && entry.browser.test(problem.browser)));

/** What one case committed: on a view, on a text inside it, and on a text wearing it. */
interface Committed {
  readonly view: Record<string, unknown>;
  readonly child: Record<string, unknown>;
  readonly text: Record<string, unknown>;
}

/**
 * Every case committed through the engine to a fake Fabric, as a device would receive it: the
 * props after transforms are put together, transitions and animations are taken out, text is
 * aligned for its direction, and the engine's own keys are gone. One engine and one commit for all
 * of them, each case under a wrapper of its own below the root every case is measured under: the
 * classes on a view with a text inside it, and on a text of its own.
 */
function commitAll(sheet: StyleSheet, cases: readonly SweepCase[]): Map<string, Committed> {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1, { globalStyles: sheet });
  const root = engine.createElement('view');
  engine.setClasses(root, ROOT_CLASSES);
  engine.appendChild(engine.root, root);
  const nodes = new Map<unknown, readonly [string, keyof Committed]>();
  const paragraph = () => {
    const text = engine.createElement('text');
    engine.appendChild(text, engine.createText('Aa'));
    return text;
  };
  for (const test of cases) {
    const classes = test.classes.join(' ');
    const [wrapper, view, child, text] = [
      engine.createElement('view'),
      engine.createElement('view'),
      paragraph(),
      paragraph(),
    ];
    engine.setClasses(view, classes);
    engine.setClasses(text, classes);
    engine.appendChild(view, child);
    // A sibling after the child, so `space-*` and `divide-*`, which skip the last child, reach it.
    engine.appendChild(view, engine.createElement('view'));
    engine.appendChild(wrapper, view);
    engine.appendChild(wrapper, text);
    engine.appendChild(root, wrapper);
    nodes.set(view, [test.name, 'view']);
    nodes.set(child, [test.name, 'child']);
    nodes.set(text, [test.name, 'text']);
  }
  engine.commit();
  const committed = new Map<string, Partial<Record<keyof Committed, Record<string, unknown>>>>();
  const walk = (node: FakeFabricNode) => {
    const found = nodes.get(node.instanceHandle);
    if (found) committed.set(found[0], { ...committed.get(found[0]), [found[1]]: node.props });
    node.children.forEach(walk);
  };
  fabric.committed.forEach(walk);
  return committed as Map<string, Committed>;
}

/**
 * The text props, which a view only carries down to the text inside it: their keywords are
 * checked where they are read, on the paragraph.
 */
const TEXT_PROPS =
  /^(color|font|letterSpacing|lineHeight|textAlign|textDecoration|textTransform|textShadow|writingDirection|numberOfLines|ellipsizeMode|selectable)/;

/** Props the engine writes that are a component's rather than a style's. */
const COMPONENT_PROPS = new Set(['nativeID', 'accessible', 'pointerEvents', 'collapsable']);

/** Properties that move a box, whose refusal accounts for a layout that differs. */
const LAYOUT =
  /^(display|position|width|height|min-|max-|margin|padding|inset|top|right|bottom|left|gap|row-gap|column-gap|flex|align|justify|place|order|aspect-ratio|border.*width|box-sizing|overflow|grid|float|columns|zoom|translate|scale|rotate|transform|contain|content-visibility)/;

/** Disagreements grouped by property, biggest group first, a few examples each. */
function groupedReport(problems: readonly Disagreement[]): string {
  const byProperty = new Map<string, string[]>();
  for (const problem of problems) {
    byProperty.set(problem.property, [...(byProperty.get(problem.property) ?? []), problem.text]);
  }
  return [...byProperty]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([property, list]) => `${list.length} ${property}\n    ${list.slice(0, 4).join('\n    ')}`)
    .join('\n');
}

export function defineSweep(config: SweepConfig): void {
  ({ buildFor, measuredIn } = config);
  WORLDS = config.worlds;
  WORLDS_BY_NAME = Object.fromEntries(WORLDS.map((world) => [world.name, world]));
  SNAPSHOT = fixture(config.snapshot);
  ORACLE = fixture(config.oracle);
  DELIBERATE = config.deliberate;
  KNOWN = config.known;
  YOGA = config.yoga;
  SILENT_BY_DESIGN = config.silentByDesign;
  SILENT_KNOWN = config.silentKnown;
  UNDECLARED = config.undeclared;
  describe(config.title, () => sweepSuite(config));
}

function sweepSuite(config: SweepConfig) {
  let cases: SweepCase[];
  let result: Outcome;
  const update = Boolean(process.env['TAILWIND_SWEEP_UPDATE']);

  let thrown: string[] = [];
  let sheet: StyleSheet;
  let committed: Map<string, Committed> | undefined;
  const committedCases = () => (committed ??= commitAll(sheet, cases));

  before(async () => {
    const built = await config.sweep();
    cases = built.cases;
    try {
      const compiled = compile(built.css);
      sheet = compiled.sheet;
      result = outcomes(cases, compiled.flat, sheet, compiled.messages);
    } catch {
      thrown = await throwers(cases);
      const rest = cases.filter((test) => !thrown.some((one) => one.startsWith(`${test.name}: `)));
      const compiled = compile(await buildFor(rest));
      sheet = compiled.sheet;
      result = outcomes(rest, compiled.flat, sheet, compiled.messages);
    }
  });

  it('builds with every case in it, which is what an app using them would do', () => {
    assert.deepEqual(thrown, []);
  });

  it('either takes effect or says why not, for every case', () => {
    const lists = [...SILENT_BY_DESIGN, ...SILENT_KNOWN];
    const unexplained = result.silent.filter(
      (name) => !lists.some(([pattern]) => pattern.test(name)),
    );
    assert.deepEqual(unexplained, [], `${unexplained.length} cases compile to nothing, silently`);
    const stale = lists.filter(([pattern]) => !result.silent.some((name) => pattern.test(name)));
    assert.deepEqual(
      stale.map(([pattern]) => String(pattern)),
      [],
      'listed as silent, and no longer is',
    );
  });

  it('refuses what it refused before, for the same reasons', () => {
    const current = byReason(result.refused);
    if (update) {
      writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    assert.deepEqual(current, JSON.parse(readFileSync(SNAPSHOT, 'utf8')));
  });

  it('commits only props React Native reads, with keywords it takes', () => {
    const { names, keywords } = reactNativeProps();
    const problems: Disagreement[] = [];
    const check = (name: string, where: string, props: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(props)) {
        if (COMPONENT_PROPS.has(key)) continue;
        if (!names.has(key)) {
          const text = `${name} (${where}): ${key} ${JSON.stringify(value)}`;
          problems.push({ case: name, property: `unknown prop ${key}`, text });
          continue;
        }
        const allowed = keywords.get(key);
        if (!allowed || typeof value !== 'string' || allowed.has(value)) continue;
        if (where === 'view' && TEXT_PROPS.test(key)) continue;
        const text = `${name} (${where}): ${key} ${value}`;
        problems.push({ case: name, property: `${key} value`, browser: value, text });
      }
    };
    for (const [name, committed] of committedCases()) {
      check(name, 'view', committed.view);
      check(name, 'text', committed.text);
      check(name, 'child', committed.child);
    }
    const unexpected = problems.filter(
      (problem) => !UNDECLARED.some((entry) => matches(entry, problem)),
    );
    assert.equal(unexpected.length, 0, groupedReport(unexpected));
  });

  it('agrees with Chrome on every property it does not refuse, in every world', () => {
    const oracle = JSON.parse(readFileSync(ORACLE, 'utf8')) as Record<string, Recorded>;
    const problems: Disagreement[] = [];
    for (const world of WORLDS) {
      const recorded = oracle[world.name];
      assert.ok(recorded, `no ${world.name} world in the oracle: pnpm tailwind-oracle`);
      // The base and web worlds measure every case; the others, what they change.
      const inWorld =
        world.name === 'base' || world.name === 'web' ? cases : measuredIn(world, cases);
      const missing = inWorld
        .filter((test) => !(test.name in recorded.cases))
        .map((test) => test.name);
      assert.deepEqual(
        missing,
        [],
        `the ${world.name} oracle is out of step: pnpm tailwind-oracle`,
      );
      problems.push(...disagreements(inWorld, world, recorded, sheet, result.refused));
    }
    const accounted = [...DELIBERATE, ...KNOWN];
    const unexpected = problems.filter(
      (problem) => !accounted.some((entry) => matches(entry, problem)),
    );
    assert.equal(unexpected.length, 0, groupedReport(unexpected));

    const stale = accounted.filter((entry) => !problems.some((problem) => matches(entry, problem)));
    assert.deepEqual(
      stale.map((entry) => entry.reason),
      [],
      'accounted for, and no longer happens',
    );
  });

  it('lays every case out where the web host does', () => {
    // `layout.ts`'s scene, laid out by Yoga as React Native configures it, against Chrome with
    // `@solidnative/web`'s reset: the promise that one class string lays out alike on both hosts.
    const oracle = JSON.parse(readFileSync(ORACLE, 'utf8')) as Record<string, unknown>;
    const layout = oracle['layout'] as {
      viewport: Recorded['viewport'];
      control: number[][];
      cases: Record<string, number[][]>;
    };
    const resolve = resolverFor(
      sheet,
      WORLDS_BY_NAME['web'] ?? WORLDS_BY_NAME['base']!,
      layout.viewport,
    );
    const problems: Disagreement[] = [];
    for (const test of cases) {
      if (test.kind === 'variant') continue;
      const skipped = refusedProperties(result.refused.get(test.name) ?? []);
      if (skipped === 'all' || [...skipped].some((one) => LAYOUT.test(one))) continue;
      const theirs = layout.cases[test.name] ?? layout.control;
      const resolved = resolve(test.classes, SCENE.inside.length);
      const mine = layOut(resolved.own, layout.viewport, resolved.inside);
      MEASURED.forEach((which, i) => {
        const box: Box = mine[which];
        const [left, top, width, height] = theirs[i]!;
        // No box on the web: `display: none`, or `contents` for the case itself. Chrome reports one
        // far off the page, and there is nothing of it to compare.
        if (top! < -10000) return;
        const same = [
          box.left - left!,
          box.top - top!,
          box.width - width!,
          box.height - height!,
        ].every((d) => Math.abs(d) <= 0.5);
        if (same) return;
        const text = `${test.name}: ${which} chrome ${theirs[i]!.join(',')}, yoga ${[box.left, box.top, box.width, box.height].map((n) => Math.round(n * 100) / 100).join(',')}`;
        problems.push({ case: test.name, property: `layout ${which}`, text });
      });
    }
    const accounted = [...DELIBERATE, ...KNOWN, ...YOGA];
    const unexpected = problems.filter(
      (problem) => !accounted.some((entry) => matches(entry, problem)),
    );
    assert.equal(unexpected.length, 0, groupedReport(unexpected));
    const stale = YOGA.filter((entry) => !problems.some((problem) => matches(entry, problem)));
    assert.deepEqual(
      stale.map((entry) => entry.reason),
      [],
      'a Yoga difference no longer happens',
    );
  });

  it('is the sheet Metro gives the app, byte for byte', async () => {
    // What an app loads is the module `withTailwind` writes, not this test's own compile: a value
    // that does not survive being written out as a module and read back never reaches a device.
    // Compiled afresh, since the engine keeps notes on the rules of a sheet it has matched.
    const { compileSheetModule } = require('@solidnative/tailwind/config.cjs') as {
      compileSheetModule(css: string): string;
    };
    const { css } = await config.sweep();
    const code = compileSheetModule(`${css}\n${ROOT_CSS}`);
    const loaded = JSON.parse(
      code.slice(code.indexOf('export default ') + 15, code.lastIndexOf(';')),
    );
    const fresh = compile(css).sheet;
    assert.deepEqual(loaded, fresh, 'the module holds exactly the sheet compiled here');
  });

  it('plays every animation as Chrome does, frame by frame', () => {
    // Paused at the same points through the first cycle on both sides: the transform and the
    // opacity painted there, which is where a keyframe eased by the wrong curve, a missing
    // implicit frame or a unit read wrong shows.
    const oracle = JSON.parse(readFileSync(ORACLE, 'utf8')) as Record<string, unknown>;
    const motion = oracle['motion'] as Record<
      string,
      { duration: number; frames: { at: number; transform: string; opacity: string }[] }
    >;
    const problems: Disagreement[] = [];
    for (const [name, recorded] of Object.entries(motion)) {
      let now = 1000;
      const fabric = createFakeFabric();
      const engine = new Engine(fabric, 1, { globalStyles: sheet, now: () => now });
      const root = engine.createElement('view');
      engine.setClasses(root, ROOT_CLASSES);
      const node = engine.createElement('view');
      engine.setClasses(node, name);
      engine.appendChild(root, node);
      engine.appendChild(engine.root, root);
      engine.commit();
      const started = now;
      for (const frame of recorded.frames) {
        now = started + frame.at * recorded.duration;
        engine.advanceAnimations();
        engine.commit();
        const props = committedProps(fabric, node);
        const transform = compare('transform', frame.transform, props, TRANSFORM_BOX);
        const opacity = Math.abs(Number(props['opacity'] ?? 1) - Number(frame.opacity)) <= 0.01;
        if (transform.agrees && opacity) continue;
        const text = `${name} at ${frame.at}: chrome ${frame.transform} / ${frame.opacity}, ours ${JSON.stringify(props['transform'])} / ${String(props['opacity'] ?? 1)}`;
        problems.push({ case: name, property: 'motion', text });
      }
    }
    assert.ok(Object.keys(motion).length > 0, 'no animation to compare: pnpm tailwind-oracle');
    assert.equal(problems.length, 0, groupedReport(problems));
  });

  it('puts a transform together in the order Chrome does', () => {
    // Translate, then rotate, then scale, then the transform list: native has one list, and the
    // engine builds it from the four, so this is where an order or a unit goes wrong.
    const base = (JSON.parse(readFileSync(ORACLE, 'utf8')) as Record<string, Recorded>)['base']!;
    const problems: Disagreement[] = [];
    for (const [name, committed] of committedCases()) {
      const chrome = base.cases[name] ?? {};
      if (!['translate', 'rotate', 'scale', 'transform'].some((property) => property in chrome))
        continue;
      if (refusedProperties(result.refused.get(name) ?? []) === 'all' || 'animation-name' in chrome)
        continue;
      if (
        [...(refusedProperties(result.refused.get(name) ?? []) as Set<string>)].some((p) =>
          /translate|rotate|scale|transform/.test(p),
        )
      )
        continue;
      if (sameComposedTransform(chrome, committed.view['transform'], TRANSFORM_BOX)) continue;
      const text = `${name}: chrome ${['translate', 'rotate', 'scale', 'transform'].map((p) => chrome[p] ?? '-').join(' | ')}, ours ${JSON.stringify(committed.view['transform'])}`;
      problems.push({ case: name, property: 'transform (composed)', text });
    }
    const unexpected = problems.filter(
      (problem) => !KNOWN.some((entry) => matches(entry, problem)),
    );
    assert.equal(unexpected.length, 0, groupedReport(unexpected));
  });

  after(() => {
    if (update) console.log(`recorded ${result.refused.size} refused cases in ${SNAPSHOT}`);
  });
}
