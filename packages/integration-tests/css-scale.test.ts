/**
 * What a utility stylesheet costs, at sizes no hand-written one reaches.
 *
 * A component's stylesheet is a dozen rules; a Tailwind app's is hundreds to thousands, every node
 * carries several classes, and both numbers grow with the app rather than with the screen. That is
 * a different shape of load from anything else here, so it gets measured on its own.
 *
 * The assertion is the property the rule index exists for: **what a node costs does not grow with
 * the size of the sheet**. Timings are printed for a human; the numbers asserted on are work
 * counts, which are deterministic where a stopwatch on a shared machine is not.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { StyleResolver, type StyleSheet, type StyleTarget } from '@solid-native/fabric';
import { resetStyleStats, styleStats } from '../fabric/src/css.ts';

const require = createRequire(import.meta.url);
const { withTailwind } = require('@solid-native/tailwind/config.cjs') as {
  withTailwind(config: object, options: { input: string; output: string; watch: boolean }): void;
};

/** A sheet shaped like Tailwind's output: mostly single-class utilities, some of them conditional. */
function utilitySheet(rules: number): StyleSheet {
  return {
    rules: Array.from({ length: rules }, (_, i) => ({
      compounds: [{ classes: [`u${i}`] }],
      combinators: [],
      specificity: 1000,
      order: i,
      declarations: i % 3 === 0 ? { color: `#${i % 10}` } : { paddingTop: i % 24 },
      // Roughly what `dark:` and the platform variants add: a third of a real sheet is guarded.
      ...(i % 3 === 1
        ? { condition: { feature: 'prefers-color-scheme', value: 'dark' } as never }
        : {}),
    })),
  };
}

/** A screen: `nodes` elements, six deep, each wearing `classes` utilities from the sheet. */
function screen(sheet: StyleSheet, nodes: number, classes: number, rules: number): StyleTarget[] {
  const all: StyleTarget[] = [];
  let parent: StyleTarget | null = null;
  for (let i = 0; i < nodes; i++) {
    const node: StyleTarget = {
      name: i % 4 === 0 ? 'text' : 'view',
      parent: i % 6 === 0 ? null : parent,
      classes: new Set(
        Array.from({ length: classes }, (_, k) => `u${(i * classes + k * 7) % rules}`),
      ),
      props: {},
      sheet,
      hostSheet: null,
      styleCache: null,
      styleDirty: true,
    } as unknown as StyleTarget;
    all.push(node);
    parent = node;
  }
  return all;
}

interface Measurement {
  rules: number;
  classes: number;
  ms: number;
  compoundTests: number;
  perNode: number;
}

function measure(rules: number, classes: number, nodes = 1000): Measurement {
  const sheet = utilitySheet(rules);
  const targets = screen(sheet, nodes, classes, rules);
  const resolver = new StyleResolver(null, { width: 390, height: 844, colorScheme: 'light' });

  resetStyleStats();
  const started = performance.now();
  for (const target of targets) resolver.resolve(target, 1);
  const ms = performance.now() - started;

  return {
    rules,
    classes,
    ms,
    compoundTests: styleStats.compoundTests,
    perNode: styleStats.compoundTests / nodes,
  };
}

describe('a utility sheet at scale', () => {
  it('costs the same per node however large the sheet is', () => {
    const sizes = [100, 500, 2000, 5000];
    const results = sizes.map((rules) => measure(rules, 6));

    console.log('      1000 nodes, 6 classes each:');
    for (const result of results) {
      console.log(
        `        ${String(result.rules).padStart(4)} rules: ${result.ms.toFixed(1)}ms, ` +
          `${result.compoundTests} compound tests (${result.perNode.toFixed(1)} per node)`,
      );
    }

    // The property the index buys. Without it this is linear in the sheet: 5000 rules would be
    // fifty times the work of 100, and a Tailwind app would be unusable rather than ordinary.
    const smallest = results[0]!.perNode;
    const largest = results[results.length - 1]!.perNode;
    assert.ok(
      largest <= smallest * 1.5,
      `per-node cost grew with the sheet: ${smallest.toFixed(1)} at 100 rules, ` +
        `${largest.toFixed(1)} at 5000`,
    );
  });

  it('costs what the node wears, not what the sheet holds', () => {
    const results = [1, 4, 8, 16].map((classes) => measure(2000, classes));

    console.log('      1000 nodes against 2000 rules:');
    for (const result of results) {
      console.log(
        `        ${String(result.classes).padStart(2)} classes: ${result.ms.toFixed(1)}ms, ` +
          `${result.perNode.toFixed(1)} compound tests per node`,
      );
    }

    // One test per class, near enough: the index turns a node's cost into a function of how many
    // utilities it wears, which is the only thing an app can actually see.
    for (const result of results) {
      assert.ok(
        result.perNode <= result.classes + 2,
        `${result.classes} classes cost ${result.perNode.toFixed(1)} tests per node`,
      );
    }
  });
});

describe("a real Tailwind sheet, the size an app's would be", () => {
  /** Every utility a mid-sized app reaches for: the spacing scale, the palette, the type scale. */
  function everyUtility(): string[] {
    const spacing = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64];
    const colors = [
      'slate',
      'gray',
      'red',
      'orange',
      'amber',
      'green',
      'teal',
      'blue',
      'indigo',
      'violet',
      'purple',
      'pink',
      'rose',
    ];
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    const classes: string[] = [
      'flex',
      'flex-1',
      'flex-row',
      'flex-col',
      'items-center',
      'justify-between',
      'absolute',
      'relative',
      'overflow-hidden',
      'border',
      'text-center',
    ];
    for (const s of spacing)
      classes.push(
        `p-${s}`,
        `px-${s}`,
        `py-${s}`,
        `m-${s}`,
        `mt-${s}`,
        `gap-${s}`,
        `w-${s}`,
        `h-${s}`,
      );
    for (const c of colors)
      for (const shade of shades) {
        classes.push(
          `bg-${c}-${shade}`,
          `text-${c}-${shade}`,
          `border-${c}-${shade}`,
          `dark:bg-${c}-${shade}`,
        );
      }
    for (const t of ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl']) classes.push(`text-${t}`);
    for (const r of ['sm', 'md', 'lg', 'xl', 'full']) classes.push(`rounded-${r}`);
    return classes;
  }

  /** The CLI, then the build step, exactly as an app's Metro config runs them. */
  function build(classes: string[]): { sheet: StyleSheet; bytes: number; ms: number } {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const dir = mkdtempSync(path.join(here, '.tailwind-scale-'));
    try {
      writeFileSync(path.join(dir, 'screen.html'), `<view class="${classes.join(' ')}"></view>`);
      writeFileSync(
        path.join(dir, 'styles.css'),
        '@import "tailwindcss/theme.css";\n@import "tailwindcss/utilities.css";\n',
      );
      const output = path.join(dir, 'app.tailwind.js');
      const started = performance.now();
      withTailwind(
        { projectRoot: dir, transformer: {}, resolver: { sourceExts: ['ts'] } },
        { input: path.join(dir, 'styles.css'), output, watch: false },
      );
      const ms = performance.now() - started;
      const code = readFileSync(output, 'utf8');
      const json = code.slice(code.indexOf('export default ') + 15, code.lastIndexOf(';'));
      return { sheet: JSON.parse(json) as StyleSheet, bytes: code.length, ms };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('resolves a screen against every utility an app would generate', () => {
    const classes = everyUtility();
    const { sheet, bytes, ms } = build(classes);

    // Real class names off real nodes, not the synthetic `u0..uN` above.
    const nodes = 1000;
    const worn = 6;
    const targets: StyleTarget[] = [];
    let parent: StyleTarget | null = null;
    for (let i = 0; i < nodes; i++) {
      const node = {
        name: i % 4 === 0 ? 'text' : 'view',
        parent: i % 6 === 0 ? null : parent,
        classes: new Set(
          Array.from({ length: worn }, (_, k) => classes[(i * worn + k * 7) % classes.length]!),
        ),
        props: {},
        sheet,
        hostSheet: null,
        styleCache: null,
        styleDirty: true,
      } as unknown as StyleTarget;
      targets.push(node);
      parent = node;
    }

    const resolver = new StyleResolver(null, { width: 390, height: 844, colorScheme: 'light' });
    resetStyleStats();
    const started = performance.now();
    for (const target of targets) resolver.resolve(target, 1);
    const resolveMs = performance.now() - started;

    console.log(
      `      ${classes.length} utilities -> ${sheet.rules.length} rules, ` +
        `${(bytes / 1024).toFixed(0)}KB of module, built in ${ms.toFixed(0)}ms`,
    );
    console.log(
      `      ${nodes} nodes x ${worn} classes: ${resolveMs.toFixed(1)}ms, ` +
        `${(styleStats.compoundTests / nodes).toFixed(1)} compound tests per node`,
    );

    assert.ok(sheet.rules.length > 500, `expected a large sheet, got ${sheet.rules.length}`);
    // The same property, held against the real thing: a thousand-rule sheet costs a node about
    // what it wears. Anything else means the index stopped covering a shape Tailwind emits.
    assert.ok(
      styleStats.compoundTests / nodes <= worn + 2,
      `${(styleStats.compoundTests / nodes).toFixed(1)} tests per node against ` +
        `${sheet.rules.length} rules`,
    );
  });
});
