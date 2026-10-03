/**
 * A screen of Tailwind cards through the engine: the JavaScript a Tailwind app runs to style a list
 * the first time and to restyle it when the theme changes, against the fake Fabric host. Node with
 * its JIT off, as `pnpm bench` runs, ranks changes the way Hermes on a device does; it does not
 * measure the native side, and a device's own times are several times these.
 *
 *     pnpm bench:tailwind
 *     ROWS=300 RUNS=15 ...           the list's size, and how many times each step is timed
 *
 * The sheet is built by the real Tailwind CLI and compiled as Metro compiles it, outside the
 * timing. Two lists: `common`, whose classes drew the same before utilities composed per element,
 * and `composed`, which leans on the ones that now do: rings beside shadows, coloured text shadows,
 * numeric variants, `space-y-*` and `divide-y`.
 */
import { createRequire } from 'node:module';
import { Engine, type EngineNode, type StyleSheet } from '@solidnative/fabric';
import { createFakeFabric } from '@solidnative/testing';
import { build } from '../tailwind-cli.ts';

const require = createRequire(import.meta.url);
const { flattenTailwind } = require('@solidnative/tailwind') as {
  flattenTailwind(css: string): string;
};
const { compileCss } = require('@solidnative/metro/css/compile.cjs') as {
  compileCss(css: string, context: string, options: object): StyleSheet;
};

const ROWS = Number(process.env['ROWS'] ?? 300);
const RUNS = Number(process.env['RUNS'] ?? 15);

/** One card: a row with an avatar, two lines of text and a badge. */
interface Card {
  readonly list: string;
  readonly row: string;
  readonly avatar: string;
  readonly title: string;
  readonly detail: string;
  readonly badge: string;
}

const LISTS: Record<'common' | 'composed', Card> = {
  common: {
    list: 'gap-3 p-4 bg-zinc-50 dark:bg-zinc-950',
    row: 'flex-row items-center gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900',
    avatar: 'size-10 rounded-full bg-blue-500 opacity-90',
    title: 'text-base font-semibold text-zinc-900 dark:text-white',
    detail: 'text-sm text-zinc-500 leading-5',
    badge: 'rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800',
  },
  composed: {
    list: 'p-4 space-y-3 divide-y divide-zinc-100 bg-zinc-50 dark:bg-zinc-950',
    row:
      'flex-row items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 ' +
      'dark:bg-zinc-900 dark:ring-zinc-700',
    avatar: 'size-10 rounded-full bg-blue-500 translate-x-1 -translate-y-1 scale-95',
    title: 'text-base font-semibold text-zinc-900 text-shadow-xs text-shadow-zinc-300',
    detail: 'text-sm text-zinc-500 tabular-nums oldstyle-nums',
    badge: 'rounded-md px-2 py-0.5 text-xs shadow-xs shadow-emerald-200 ring-1 ring-emerald-300',
  },
};

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

function bench(name: keyof typeof LISTS): void {
  const card = LISTS[name];
  const classes = Object.values(card).join(' ');
  // Every class has to compile: a refused one would time a smaller sheet than it claims to.
  const refused: string[] = [];
  const sheet = compileCss(flattenTailwind(build('native', classes)), 'tailwind', {
    onUnsupported: (message: string) => refused.push(message),
  });
  if (refused.length)
    throw new Error(`the ${name} list has refused classes:\n${refused.join('\n')}`);

  const first: number[] = [];
  const restyle: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const engine = new Engine(createFakeFabric(), 1, { globalStyles: sheet });
    const root = engine.createElement('view');
    engine.setClasses(root, 'platform-ios');
    const list = engine.createElement('view');
    engine.setClasses(list, card.list);
    const element = (type: string, names: string, parent: EngineNode, text?: string) => {
      const node = engine.createElement(type);
      engine.setClasses(node, names);
      if (text) engine.appendChild(node, engine.createText(text));
      engine.appendChild(parent, node);
      return node;
    };
    let started = performance.now();
    for (let i = 0; i < ROWS; i++) {
      const row = element('view', card.row, list);
      element('view', card.avatar, row);
      const lines = element('view', 'flex-1', row);
      element('text', card.title, lines, `Habit ${i}`);
      element('text', card.detail, lines, `${i} day streak`);
      element('text', card.badge, row, 'Done');
    }
    engine.appendChild(root, list);
    engine.appendChild(engine.root, root);
    engine.commit();
    first.push(performance.now() - started);

    started = performance.now();
    engine.setClasses(root, 'platform-ios dark');
    engine.commit();
    restyle.push(performance.now() - started);
  }
  console.log(
    `${name.padEnd(9)} first commit ${median(first).toFixed(1).padStart(7)}ms   ` +
      `dark restyle ${median(restyle).toFixed(1).padStart(7)}ms   (${ROWS} rows, ${RUNS} runs)`,
  );
}

bench('common');
bench('composed');
