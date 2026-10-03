/**
 * Real stylesheets as a corpus: Bootstrap, Bulma, Pico, Open Props and a large Tailwind build.
 *
 * Three things are checked against each, because each catches a different kind of bug:
 *
 * - **It compiles.** The whole sheet, with each refusal reported, never throws and finishes well
 *   inside a generous budget. A regression guard for a catastrophic path, not a benchmark.
 * - **What it drops, and why.** Every declaration and rule the compiler refuses is reported with a
 *   reason, grouped by property and reason and compared against a committed snapshot. A change to
 *   the compiler that drops something new, or stops dropping something, shows up as a diff to
 *   read rather than as a screen that is quietly missing a style.
 * - **What a browser does with it.** A set of the library's own classes on plain elements,
 *   measured by Chrome once and committed (`pnpm css-oracle`), against what this engine's cascade
 *   resolves for the same tree. Every difference is either a bug or listed below with the reason it
 *   is deliberate.
 *
 * After a change to the compiler, regenerate the drop report with
 *
 *   CSS_CORPUS_UPDATE=1 node --import ./register-linker.mjs --test css-corpus.test.ts
 *
 * and read the diff before committing it: each line of it is a behaviour that changed.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { StyleResolver, type StyleSheet, type StyleTarget } from '@solidnative/fabric';
import type { CaseNode } from './fixtures/css-oracle-cases.ts';
import {
  CORPUS_CASES,
  CORPUS_PROPERTIES,
  HEIGHT,
  LIBRARIES,
  source,
  type CorpusProperty,
  type LibraryName,
} from './fixtures/css-corpus.ts';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs') as {
  compileCss(
    source: string,
    context?: string,
    options?: { onUnsupported?: (message: string) => void },
  ): StyleSheet;
};
const { flattenTailwind } = require('@solidnative/tailwind') as {
  flattenTailwind(css: string): string;
};

const NAMES = Object.keys(LIBRARIES) as LibraryName[];

/**
 * Generous on purpose. Every library compiles in well under a quarter of this on a laptop; the
 * number is here to catch a path that went quadratic, not to measure anything.
 */
const BUDGET_MS = 3000;

interface Compiled {
  sheet: StyleSheet;
  messages: string[];
  ms: number;
}

const compiled = new Map<LibraryName, Compiled>();

/**
 * A library, compiled the way an app build compiles it: with each refusal reported and dropped,
 * and through Tailwind's flattener for Tailwind.
 */
function compile(library: LibraryName): Compiled {
  const cached = compiled.get(library);
  if (cached) return cached;
  const css = library.startsWith('tailwind') ? flattenTailwind(source(library)) : source(library);
  const messages: string[] = [];
  // CPU time, not wall time: the compile is synchronous, and other processes on a busy machine
  // should not count against its budget.
  const started = process.cpuUsage();
  const sheet = compileCss(css, library, { onUnsupported: (message) => messages.push(message) });
  const { user, system } = process.cpuUsage(started);
  const result = { sheet, messages, ms: (user + system) / 1000 };
  compiled.set(library, result);
  return result;
}

describe('the corpus compiles', () => {
  for (const library of NAMES) {
    it(`${library}: the whole sheet, without throwing, inside ${BUDGET_MS}ms`, () => {
      const { sheet, ms } = compile(library);
      assert.ok(sheet.rules.length > 0, 'it produced rules');
      assert.ok(ms < BUDGET_MS, `took ${Math.round(ms)}ms`);
    });
  }
});

// -------------------------------------------------------------------------------------------------
// The drop report
// -------------------------------------------------------------------------------------------------

/**
 * `<context>:<line>: dropped '<name>': <reason>`, the form a declaration is reported in. The
 * context may carry a keyframes name: `bootstrap:5235 (@keyframes spin)`.
 */
const DECLARATION = /^[^']*?: dropped '([^']+)': ([\s\S]*)$/;
/**
 * `<context>:<line>: dropped a rule: <reason>`, the form a whole rule is reported in, or `dropped
 * a selector` for one selector out of a list whose others were kept.
 */
const RULE = /^[^']*?: dropped a (rule|selector): ([\s\S]*)$/;

/**
 * A reason with the parts that say where rather than why taken out, so the same refusal on two
 * lines is one entry. The context and line number lead most messages, and a custom property's own
 * name leads its message.
 */
function reasonOf(message: string, library: string): string {
  return message
    .replaceAll(new RegExp(`${library}(:\\d+)?( \\(@keyframes [^)]+\\))?: `, 'g'), '')
    .replace(/'--[\w-]+'/g, "'--*'")
    .trim();
}

/**
 * Every drop, as `{ property: { reason: count } }`. A whole rule files under `(rule)`, and one
 * selector out of a list under `(selector)`.
 */
function groupDrops(messages: string[], library: string) {
  const groups: Record<string, Record<string, number>> = {};
  for (const message of messages) {
    const declaration = DECLARATION.exec(message);
    const rule = declaration ? null : RULE.exec(message);
    assert.ok(declaration || rule, `a drop that does not say what it dropped: ${message}`);
    const property = declaration ? declaration[1]!.replace(/^--.*/, '--*') : `(${rule![1]})`;
    const reason = reasonOf(declaration ? declaration[2]! : rule![2]!, library);
    assert.ok(reason.length > 0, `a drop with no reason: ${message}`);
    const byReason = (groups[property] ??= {});
    byReason[reason] = (byReason[reason] ?? 0) + 1;
  }
  return sortKeys(groups);
}

/** Every React Native key the sheet can write, so a new or vanished one is a diff too. */
function emittedKeys(sheet: StyleSheet): string[] {
  const keys = new Set<string>();
  for (const rule of sheet.rules) {
    for (const key of Object.keys(rule.declarations)) keys.add(key);
    for (const key of Object.keys(rule.important ?? {})) keys.add(key);
    for (const deferred of rule.deferred ?? []) for (const key of deferred.props) keys.add(key);
  }
  return [...keys].sort();
}

function sortKeys<T>(object: Record<string, T>): Record<string, T> {
  const sorted: Record<string, T> = {};
  for (const key of Object.keys(object).sort()) {
    const value = object[key]!;
    sorted[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (sortKeys(value as Record<string, unknown>) as T)
        : value;
  }
  return sorted;
}

function report(library: LibraryName) {
  const { sheet, messages } = compile(library);
  return {
    rules: sheet.rules.length,
    dropped: messages.length,
    emitted: emittedKeys(sheet),
    drops: groupDrops(messages, library),
  };
}

const SNAPSHOT = fileURLToPath(new URL('./fixtures/css-corpus-drops.json', import.meta.url));

describe('what the corpus drops, and why', () => {
  const update = Boolean(process.env['CSS_CORPUS_UPDATE']);
  const recorded = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Record<string, unknown>;
  const current: Record<string, unknown> = {};

  after(() => {
    if (update) writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`);
  });

  for (const library of NAMES) {
    it(`${library}: every drop is reported with a reason, and matches the snapshot`, () => {
      current[library] = report(library);
      if (!update) assert.deepEqual(current[library], recorded[library]);
    });
  }
});

// -------------------------------------------------------------------------------------------------
// The browser oracle
// -------------------------------------------------------------------------------------------------

interface Recorded {
  library: LibraryName;
  name: string;
  width: number;
  probe: Record<CorpusProperty, string>;
  control: Record<CorpusProperty, string>;
}

const oracle = require('./fixtures/css-corpus-oracle.json') as Recorded[];

/** Build the tree the browser was given, as nodes the resolver understands. */
function build(spec: CaseNode, parent: StyleTarget | null): StyleTarget[] {
  const node: StyleTarget = {
    name: spec.name,
    parent,
    classes: new Set(spec.classes ?? []),
    props: { ...(spec.id ? { nativeID: spec.id } : {}), ...(spec.attrs ?? {}) },
    sheet: null,
    hostSheet: null,
    styleCache: null,
    styleDirty: true,
  };
  const children = (spec.children ?? []).flatMap((child) => build(child, node));
  (node as { children?: StyleTarget[] }).children = children.filter((c) => c.parent === node);
  return [node, ...children];
}

/**
 * The first of several React Native keys that holds a value, in the order Yoga reads them for a
 * left-to-right layout: the most specific edge first, the all-edges shorthand last.
 */
function first(style: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) if (style[key] !== undefined) return style[key];
  return undefined;
}

const EDGES = {
  top: ['Top', 'BlockStart', 'Vertical', 'Block', ''],
  right: ['InlineEnd', 'End', 'Right', 'Horizontal', 'Inline', ''],
  bottom: ['Bottom', 'BlockEnd', 'Vertical', 'Block', ''],
  left: ['InlineStart', 'Start', 'Left', 'Horizontal', 'Inline', ''],
} as const;

/** What our resolved style says for one CSS property, read the way native would read it. */
function ours(style: Record<string, unknown>, property: CorpusProperty): unknown {
  const edge = /^(padding|margin)-(top|right|bottom|left)$/.exec(property);
  if (edge)
    return first(
      style,
      EDGES[edge[2] as keyof typeof EDGES].map((s) => `${edge[1]}${s}`),
    );
  const border = /^border-(top|left)-(color|width)$/.exec(property);
  if (border) {
    const suffix = border[2] === 'color' ? 'Color' : 'Width';
    const sides = border[1] === 'top' ? ['Top', ''] : ['Start', 'Left', ''];
    return first(
      style,
      sides.map((side) => `border${side}${suffix}`),
    );
  }
  const corner = /^border-(top-left|bottom-right)-radius$/.exec(property);
  if (corner) {
    const [start, end] =
      corner[1] === 'top-left' ? ['TopLeft', 'StartStart'] : ['BottomRight', 'EndEnd'];
    return first(style, [`border${end}Radius`, `border${start}Radius`, 'borderRadius']);
  }
  switch (property) {
    case 'row-gap':
      return first(style, ['rowGap', 'gap']);
    case 'column-gap':
      return first(style, ['columnGap', 'gap']);
    default:
      return style[property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())];
  }
}

/**
 * Whether two colours are the same. The browser's is exact unless it is marked `~`, which the
 * generator uses for a colour it had to convert out of a wider space: Chrome clips an out-of-gamut
 * colour where lightningcss maps it into gamut as CSS Color 4 describes, so the most saturated of
 * Tailwind's palette come out a few units apart per channel. Which declaration won is still exact.
 */
function sameColor(browser: string, value: unknown): boolean {
  if (!browser.startsWith('~')) return value === browser;
  const channels = (colour: string) => colour.match(/[\d.]+/g)!.map(Number);
  if (typeof value !== 'string' || !/^rgba?\(/.test(value)) return false;
  const [a, b] = [channels(browser), channels(value)];
  if (a.length !== b.length) return false;
  return a.every((channel, i) => Math.abs(channel - b[i]!) <= (i === 3 ? 0.01 : 8));
}

/** Chrome's shadow list, `rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, ...`, as ours would be. */
function shadows(value: string) {
  if (value === 'none') return [];
  return value
    .split(/,(?![^(]*\))/)
    .map((one) => {
      const color = /~?rgba?\([^)]*\)/.exec(one)![0];
      const [x, y, blur, spread] = one
        .replace(color, '')
        .match(/-?[\d.]+px/g)!
        .map(parseFloat);
      return { x, y, blur, spread, color, inset: /\binset\b/.test(one) };
    })
    .filter((shadow) => !/^~?rgba\(.*,\s*0\)$/.test(shadow.color));
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
        shadow.inset === actual[i]!['inset'] &&
        sameColor(shadow.color, actual[i]!['color']),
    )
  );
}

/**
 * Whether our value says the same as the browser's. `undefined` on our side means we set nothing,
 * which leaves the native default, and so agrees with a browser value that is the property's
 * initial one.
 */
// eslint-disable-next-line complexity -- one flat case per kind of CSS value
function agrees(property: CorpusProperty, browser: string, value: unknown): boolean {
  const unset = value === undefined || value === null;
  if (property === 'box-shadow') return sameShadows(browser, value);
  if (/rgba?\(/.test(browser)) return sameColor(browser, value);
  if (property === 'font-family') {
    return value === browser.split(',')[0]!.trim().replace(/^"|"$/g, '');
  }
  if (property === 'aspect-ratio') {
    if (browser === 'auto') return unset;
    const [w, h] = browser.split('/').map(Number);
    return typeof value === 'number' && Math.abs(value - w! / (h ?? 1)) < 1e-3;
  }
  if (['normal', 'none', 'auto', 'start', 'static'].includes(browser)) {
    return unset || value === browser;
  }
  if (browser.endsWith('px')) {
    // A margin of `auto` is laid out, not computed: the browser reports the space it came to.
    if (value === 'auto') return true;
    return typeof value === 'number' && Math.abs(value - parseFloat(browser)) < 0.01;
  }
  if (/^-?[\d.]+$/.test(browser) && property !== 'font-weight') {
    return typeof value === 'number' && Math.abs(value - Number(browser)) < 1e-3;
  }
  return value === browser;
}

/**
 * Differences that are deliberate, by case and property. Each reason says why native cannot, or
 * by design does not, match the browser. A difference not listed here fails; so does a listed one
 * that has gone away, so this list cannot rot.
 */
const FLEX_ONLY =
  'Yoga lays out flex boxes and nothing else, so inline-block, inline-flex and grid have no ' +
  "native equivalent and are refused (ADR 0001). The box keeps native's flex.";
const BODY_LINE_HEIGHT =
  'Inherited from `body`, which native has no element for, and as a ratio: CSS inherits ' +
  "`line-height: 1.5` as a multiple of each descendant's own font size, native's lineHeight is " +
  'points, and there is no ratio to inherit.';
const HSL_TOKENS =
  'An hsl() this engine still cannot read: written straight into a declaration rather than ' +
  "defined as a token first - only a token's hsl() is resolved, and it is a plain one (see " +
  'css-tokens.test.ts) - with calc() between two tokens for a shade, or with one inside a ' +
  "box-shadow list's colour. Each still needs a parser or a calc engine on device.";
const SHORTHAND_TOKEN =
  'A token holding a whole shorthand with var()s inside it, `--bs-alert-border: ' +
  'var(--bs-border-width) solid var(--bs-alert-border-color)`, would need substituting and ' +
  'parsing on device. A token is read in one form; this one has none.';
const TWO_VARS =
  '`calc(var(--a) - var(--b))`: arithmetic between two tokens needs evaluating on device.';

const DELIBERATE: Record<string, Partial<Record<CorpusProperty, string>>> = {
  'bootstrap .btn.btn-primary': { display: FLEX_ONLY },
  'bootstrap .alert.alert-success': {
    'border-top-color': SHORTHAND_TOKEN,
    'border-left-color': SHORTHAND_TOKEN,
    'border-top-width': SHORTHAND_TOKEN,
    'border-left-width': SHORTHAND_TOKEN,
  },
  'bootstrap .fs-1 at 500': { 'line-height': BODY_LINE_HEIGHT },
  'bootstrap .fs-1 at 1280': { 'line-height': BODY_LINE_HEIGHT },
  'bulma .button.is-primary': {
    color: HSL_TOKENS,
    'background-color': HSL_TOKENS,
    'padding-top': TWO_VARS,
    'padding-right': TWO_VARS,
    'padding-bottom': TWO_VARS,
    'padding-left': TWO_VARS,
    display: FLEX_ONLY,
  },
  'bulma .is-size-3': { 'line-height': BODY_LINE_HEIGHT },
  'bulma .tag': { 'background-color': HSL_TOKENS, display: FLEX_ONLY },
  'pico .grid': { display: FLEX_ONLY },
  'open-props .op-card': { 'box-shadow': HSL_TOKENS },
};

describe('what a browser does with the corpus', () => {
  for (const recorded of oracle) {
    const test = CORPUS_CASES.find(
      (one) => one.library === recorded.library && one.name === recorded.name,
    );
    it(`${recorded.library} ${recorded.name}`, () => {
      assert.ok(test, 'the fixture is out of step with the cases; regenerate it');
      const { sheet } = compile(test.library);
      // Under two levels of its own, as the browser's tree is under `<html>` and `<body>`: otherwise
      // the probe would be `:root` itself, and a library's document-level rules would land on it.
      // Neither is called `body`, since native has no such element and its rules reach nothing.
      const nodes = build(
        { name: 'view', children: [{ name: 'view', children: [test.tree] }] },
        null,
      );
      const probe = nodes.find((node) => node.props['nativeID'] === 'probe')!;
      const resolver = new StyleResolver(sheet, {
        width: test.width,
        height: HEIGHT,
        colorScheme: 'light',
      });
      for (const node of nodes) resolver.resolve(node, 1);
      const style = resolver.resolve(probe, 1).style;

      const expected = DELIBERATE[`${test.library} ${test.name}`] ?? {};
      const problems: string[] = [];
      for (const property of CORPUS_PROPERTIES) {
        const browser = recorded.probe[property];
        // Only what the classes under test changed: the rest is the user-agent sheet, resets and
        // what the element inherits from a `body` that native does not have.
        if (browser === recorded.control[property]) continue;
        // A border colour is only a colour anyone can see where there is a border to paint.
        const width = /^border-(top|left)-color$/.exec(property);
        if (width && recorded.probe[`border-${width[1]}-width` as CorpusProperty] === '0px') {
          continue;
        }
        const value = ours(style, property);
        const same = agrees(property, browser, value);
        const deliberate = expected[property];
        if (!same && !deliberate) {
          problems.push(`${property}: browser ${browser}, ours ${JSON.stringify(value)}`);
        }
        if (same && deliberate) {
          problems.push(`${property}: listed as a deliberate difference but now agrees`);
        }
      }
      assert.deepEqual(problems, []);
    });
  }

  it('lists no deliberate difference for a case that does not exist', () => {
    const names = new Set(CORPUS_CASES.map((one) => `${one.library} ${one.name}`));
    assert.deepEqual(
      Object.keys(DELIBERATE).filter((name) => !names.has(name)),
      [],
    );
  });
});
