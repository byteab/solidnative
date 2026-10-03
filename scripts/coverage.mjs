/**
 * What the tests actually reach, across every `node --test` suite at once.
 *
 * They run in different hosts and cover overlapping code, so a per-suite number answers the wrong
 * question. `packages/components` is exercised by its own Solid suite, by the integration suite
 * through a fake Fabric and by the canary's screens, and none of them on its own says whether a
 * component is tested - only the union does. So each writes lcov and this merges them on absolute
 * paths before reporting.
 *
 * Node's own `--experimental-test-coverage` does the instrumenting. No `c8`, no `nyc`: every suite
 * is `node --test` already, and a separate instrumenter would mean a second set of source maps
 * over TypeScript that Node is stripping itself.
 *
 * Usage:
 *
 *   node scripts/coverage.mjs            # run every suite, merge, report
 *   node scripts/coverage.mjs --report   # re-report from the last run, without re-running
 *   node scripts/coverage.mjs --min 95   # exit non-zero if total line coverage is under 95%
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'coverage');

/**
 * Everything that is shipped, and nothing that is not. Fixtures and tests stay out: they are the
 * instrument, not the thing measured. `report()` further keeps only
 * each package's `src/`.
 */
const EXCLUDE = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.mjs',
  '**/*.test.cjs',
  '**/fixtures/**',
  '**/solid-tests/**',
  '**/node_modules/**',
  '**/dist/**',
];

/** The Solid compile hooks every native suite runs under: TSX through Solid, `*.native.css`. */
const COMPILED = '/packages/platform/solid-tests/compiled-register.mjs';
const CSS_COMPILED = '/packages/platform/solid-tests/css-compiled-register.mjs';

/** A `node --test` suite, instrumented by Node, writing lcov to `<out>/<name>.info`. */
function suite(name, cwd, { imports = [], tests, concurrency = false }) {
  return {
    name,
    cwd,
    command: 'node',
    args: (destination) => [
      ...imports.flatMap((hook) => [
        '--import',
        hook.startsWith('/') ? url.pathToFileURL(path.join(ROOT, hook)).href : hook,
      ]),
      '--test',
      // One file per core. Node's default leaves a core free, which on a two-core CI runner is
      // one file at a time.
      ...(concurrency ? [`--test-concurrency=${availableParallelism()}`] : []),
      '--experimental-test-coverage',
      ...EXCLUDE.map((pattern) => `--test-coverage-exclude=${pattern}`),
      '--test-reporter=lcov',
      `--test-reporter-destination=${destination}`,
      '--test-reporter=dot',
      '--test-reporter-destination=stdout',
      ...tests,
    ],
    report: (out) => path.join(out, `${name}.info`),
  };
}

/**
 * A suite that has to pass but reports no coverage: its code runs inside a real Chrome, where
 * Node's instrumenter cannot see it.
 */
function check(name, cwd, args) {
  return { name, cwd, command: 'node', args: () => args, report: undefined };
}

/** How each suite is run, mirroring each package's own `test` script. */
const SUITES = [
  // `packages/web`'s own split: the DOM view layer under one hook, the host engine under another.
  suite('solid-web', 'packages/web', {
    imports: ['./solid-tests/register.mjs'],
    tests: ['solid-tests/web-view.test.ts', 'solid-tests/lifecycle.test.mjs'],
  }),
  suite('solid-web-host', 'packages/web', {
    imports: ['./solid-tests/host-register.mjs'],
    tests: [
      'src/*.test.ts',
      'solid-tests/host.test.mjs',
      'solid-tests/host-updates.test.mjs',
      'solid-tests/controls.test.ts',
      'solid-tests/interaction.test.ts',
      'solid-tests/styles.test.ts',
      'solid-tests/embed.test.ts',
      'solid-tests/defer.test.ts',
    ],
  }),
  // What jsdom cannot answer: layout, Tailwind, `:active`, colour scheme, real input, and the Vite
  // preset's dev and production builds, in the installed Chrome (`channel: 'chrome'`).
  check('web-browser-build', 'packages/web', ['--test', 'solid-tests/browser-build.test.mjs']),
  check('web-browser-layout', 'packages/web', ['--test', 'solid-tests/layout-browser.mjs']),
  check('web-browser-host', 'packages/web', ['solid-tests/host-browser.mjs']),
  suite('solid-canary', 'examples/canary', {
    imports: [COMPILED, CSS_COMPILED, './solid-tests/isolation-register.mjs'],
    tests: ['solid-tests/*.test.ts'],
  }),
  suite('solid-expo', 'packages/expo', {
    imports: [COMPILED],
    tests: ['solid-tests/*.test.ts', 'solid-tests/*.test.tsx'],
  }),
  ...['components', 'router', 'device', 'icons'].map((name) =>
    suite(`solid-${name}`, `packages/${name}`, {
      imports: [COMPILED],
      tests: ['solid-tests/*.test.ts', 'solid-tests/*.test.tsx'],
    }),
  ),
  suite('solid-compiler', 'packages/metro', { tests: ['solid-*.test.cjs'] }),
  suite('solidnative', 'packages/platform', {
    imports: [COMPILED, CSS_COMPILED],
    tests: ['solid-tests/*.test.ts'],
  }),
  // Through `@solidnative/testing`'s public register, as an app's own tests run: its gesture-handler,
  // reanimated and worklets stand-ins are part of what the suite exercises.
  suite('integration', 'packages/integration-tests', {
    imports: ['@solidnative/testing/register'],
    tests: ['*.test.ts'],
    concurrency: true,
  }),
  // `@solidnative/testing`'s own node:test half, through its public register hook.
  suite('testing', 'packages/testing', {
    imports: ['./register.mjs'],
    tests: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  }),
];

/** `SF:` records, as `{ [file]: { lines: Map<number, hits>, branches: Map<id, hits> } }`. */
function parseLcov(text, cwd) {
  const files = new Map();
  let current = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('SF:')) {
      // lcov paths are relative to the suite's own directory; the merge key has to be absolute.
      const file = path.resolve(cwd, line.slice(3).trim());
      current = files.get(file) ?? { lines: new Map(), branches: new Map() };
      files.set(file, current);
    } else if (line.startsWith('DA:') && current) {
      const [number, hits] = line.slice(3).split(',').map(Number);
      current.lines.set(number, (current.lines.get(number) ?? 0) + hits);
    } else if (line.startsWith('BRDA:') && current) {
      const [number, block, branch, hits] = line.slice(5).split(',');
      const key = `${number}:${block}:${branch}`;
      const taken = hits === '-' ? 0 : Number(hits);
      current.branches.set(key, (current.branches.get(key) ?? 0) + taken);
    }
  }
  return files;
}

/** The lines a file never ran, collapsed into ranges, because a list of 200 numbers is unreadable. */
function uncoveredRanges(lines) {
  const missed = [...lines.entries()]
    .filter(([, hits]) => hits === 0)
    .map(([number]) => number)
    .sort((a, b) => a - b);
  const ranges = [];
  for (const number of missed) {
    const last = ranges.at(-1);
    if (last && number === last[1] + 1) last[1] = number;
    else ranges.push([number, number]);
  }
  return ranges.map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`));
}

function run() {
  mkdirSync(OUT, { recursive: true });
  for (const suite of SUITES) {
    const started = Date.now();
    const result = spawnSync(suite.command, suite.args(suite.report?.(OUT)), {
      cwd: path.join(ROOT, suite.cwd),
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    console.log(
      `\n${suite.name}: ${((Date.now() - started) / 1000).toFixed(1)}s on ${availableParallelism()} cores`,
    );
    if (result.status !== 0) {
      console.error(`\n${suite.name} suite failed; coverage from a red suite is not worth having.`);
      process.exit(result.status ?? 1);
    }
  }
}

/** How well one suite covered a file's branches, with "no branches recorded" as worst. */
function branchScore(branches) {
  if (branches.size === 0) return -1;
  return [...branches.values()].filter((hits) => hits > 0).length / branches.size;
}

/** A percentage, with an empty file counting as covered rather than as a division by zero. */
const ratio = (covered, total) => (total === 0 ? 100 : (covered / total) * 100);

/** Totals for one group of files. */
function totals(files) {
  return files.reduce(
    (sum, entry) => ({
      files: sum.files + 1,
      lines: sum.lines + entry.lines,
      covered: sum.covered + entry.covered,
      branches: sum.branches + entry.branches,
      branchesCovered: sum.branchesCovered + entry.branchesCovered,
    }),
    { files: 0, lines: 0, covered: 0, branches: 0, branchesCovered: 0 },
  );
}

const row = (name, data) =>
  `${name.padEnd(16)} ${String(data.files).padStart(5)} ${String(data.lines).padStart(7)} ` +
  `${ratio(data.covered, data.lines).toFixed(1).padStart(7)} ` +
  `${ratio(data.branchesCovered, data.branches).toFixed(1).padStart(9)}`;

/** Worst package first, so the table reads as a queue of work. */
function printPackages(shipped) {
  const groups = new Map();
  for (const entry of shipped) {
    groups.set(entry.package, [...(groups.get(entry.package) ?? []), entry]);
  }
  console.log(`\nCoverage by package (${SUITES.filter((s) => s.report).length} suites merged)\n`);
  console.log(
    `${'package'.padEnd(16)} ${'files'.padStart(5)} ${'lines'.padStart(7)} ` +
      `${'line %'.padStart(7)} ${'branch %'.padStart(9)}`,
  );
  console.log('-'.repeat(50));
  const rows = [...groups.entries()]
    .map(([name, files]) => [name, totals(files)])
    .sort((a, b) => ratio(a[1].covered, a[1].lines) - ratio(b[1].covered, b[1].lines));
  for (const [name, data] of rows) console.log(row(name, data));
  console.log('-'.repeat(50));
  console.log(row('all', totals(shipped)));
}

/**
 * Ranked by uncovered lines rather than by percentage.
 *
 * A forty-line file at 80% is noise beside a four-hundred-line file at 30%, and a list sorted by
 * percentage puts the noise first.
 */
function printWorst(shipped) {
  const worst = shipped
    .map((entry) => ({ ...entry, missing: entry.lines - entry.covered }))
    .filter((entry) => entry.missing > 0)
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 30);
  console.log('\nMost uncovered lines\n');
  console.log(`${'file'.padEnd(52)} ${'miss'.padStart(5)} ${'line %'.padStart(7)}`);
  console.log('-'.repeat(68));
  for (const entry of worst) {
    console.log(
      `${entry.file.padEnd(52)} ${String(entry.missing).padStart(5)} ` +
        `${ratio(entry.covered, entry.lines).toFixed(1).padStart(7)}`,
    );
  }
}

/**
 * Every suite's hits, combined per file: lines added together, branches not.
 *
 * Lines are a true union: a line number means the same thing to every suite, so a line any suite
 * reached is covered.
 *
 * Branches are not. Each run identifies a branch by its own block numbering, so summing `BRDA`
 * keys across suites counts one run's *untaken* branches as branches another never had, and an
 * earlier merge that did so reported strictly more coverage as a regression. So each file keeps
 * the branch set of whichever suite covered the largest share of it, which is a real measurement
 * by one run rather than an invented union of several.
 */
function mergeSuites() {
  const totals = new Map();
  for (const suite of SUITES) {
    const file = suite.report?.(OUT);
    if (!file || !existsSync(file)) continue;
    for (const [name, data] of parseLcov(readFileSync(file, 'utf8'), path.join(ROOT, suite.cwd))) {
      const held = totals.get(name) ?? { lines: new Map(), branches: new Map() };
      for (const [number, hits] of data.lines) {
        held.lines.set(number, (held.lines.get(number) ?? 0) + hits);
      }
      // A file no suite recorded branches for scores below every real measurement, rather than
      // above them: `ratio(0, 0)` is 100 by design elsewhere, and an empty set winning that
      // comparison reported every package at 100% branch coverage.
      if (branchScore(data.branches) > branchScore(held.branches)) held.branches = data.branches;
      totals.set(name, held);
    }
  }
  return totals;
}

/** Every measured file, as plain counts. */
function filesIn(merged) {
  return [...merged.entries()]
    .filter(
      ([file]) =>
        file.startsWith(path.join(ROOT, 'packages')) && file.includes(`${path.sep}src${path.sep}`),
    )
    .map(([file, data]) => {
      const lines = [...data.lines.values()];
      const branches = [...data.branches.values()];
      return {
        file: path.relative(ROOT, file),
        package: path.relative(ROOT, file).split(path.sep)[1],
        lines: lines.length,
        covered: lines.filter((hits) => hits > 0).length,
        branches: branches.length,
        branchesCovered: branches.filter((hits) => hits > 0).length,
        uncovered: uncoveredRanges(data.lines),
      };
    });
}

function report(minimum) {
  const shipped = filesIn(mergeSuites());
  printPackages(shipped);
  printWorst(shipped);

  const all = totals(shipped);
  const overall = ratio(all.covered, all.lines);
  writeFileSync(
    path.join(OUT, 'summary.json'),
    `${JSON.stringify({ overall, files: shipped }, null, 2)}\n`,
  );
  console.log(`\nDetail in ${path.relative(ROOT, path.join(OUT, 'summary.json'))}`);

  if (minimum !== undefined && overall < minimum) {
    console.error(`\nLine coverage ${overall.toFixed(1)}% is under the ${minimum}% floor.`);
    process.exitCode = 1;
  }
}

const args = process.argv.slice(2);
const minimumAt = args.indexOf('--min');
const minimum = minimumAt === -1 ? undefined : Number(args[minimumAt + 1]);
if (!args.includes('--report')) run();
report(minimum);
