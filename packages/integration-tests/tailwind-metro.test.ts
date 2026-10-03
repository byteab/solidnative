/**
 * How a Tailwind sheet reaches an app.
 *
 * The CLI writes CSS; `mount` takes a compiled stylesheet. The conversion cannot live in our Metro
 * transformer, because Expo's transform worker claims every `.css` file first and hands back an
 * empty module on any platform but web - so what the app imports is a generated JavaScript module,
 * written beside the CSS and regenerated whenever the CLI rewrites it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Engine, type StyleSheet } from '@solid-native/fabric';
import { createFakeFabric } from '@solid-native/testing';

const require = createRequire(import.meta.url);
const { withTailwind, compileSheetModule, localImports, watchesByDefault } =
  require('@solid-native/tailwind/config.cjs') as {
    withTailwind(
      config: object,
      options: { input: string; output?: string; watch?: boolean },
    ): object;
    compileSheetModule(css: string, context?: string): string;
    localImports(css: string, cwd: string): string[];
    watchesByDefault(argv: string[], env: Record<string, string | undefined>): boolean;
  };

interface Sheet {
  rules: { declarations: Record<string, unknown>; compounds: { classes: string[] }[] }[];
}

/**
 * The sheet a generated module exports.
 *
 * Read rather than executed: the module is an ES module, which is what the app imports and what
 * `new Function` cannot run. Its whole body is one literal, so parsing it is the honest way in.
 */
function evaluate(code: string): Sheet {
  const start = code.indexOf('export default ') + 'export default '.length;
  return JSON.parse(code.slice(start, code.lastIndexOf(';')));
}

const ruleFor = (sheet: Sheet, className: string) =>
  sheet.rules.find((rule) => rule.compounds.some((c) => c.classes.includes(className)));

/** A scratch app, inside the workspace so the CLI can resolve `tailwindcss` from node_modules. */
function scratch(sources: Record<string, string>) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = mkdtempSync(path.join(here, '.tailwind-test-'));
  for (const [name, contents] of Object.entries(sources)) {
    writeFileSync(path.join(dir, name), contents);
  }
  return dir;
}

const ENTRY = '@import "tailwindcss/theme.css";\n@import "tailwindcss/utilities.css";\n';

describe('the generated stylesheet module', () => {
  it('exports the sheet mount takes', () => {
    const sheet = evaluate(
      compileSheetModule(':root { --spacing: 0.25rem } .p-4 { padding: calc(var(--spacing) * 4) }'),
    );
    assert.deepEqual(ruleFor(sheet, 'p-4')?.declarations, {
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
    });
  });

  it('places inset-x and inset-y on the edges every native view reads', () => {
    // `inset-inline`, which `inset-x-0` compiles to, was written as React Native's
    // `insetInlineStart` and `insetInlineEnd` - aliases a `<safe-area-view>` never reads - so the
    // class did nothing there. See 'logical properties' in css-properties.test.ts.
    const sheet = evaluate(
      compileSheetModule(
        ':root { --spacing: 0.25rem } .inset-x-0 { inset-inline: calc(var(--spacing) * 0) } ' +
          '.inset-y-2 { inset-block: calc(var(--spacing) * 2) } ' +
          '.start-4 { inset-inline-start: calc(var(--spacing) * 4) }',
      ),
    );
    assert.deepEqual(ruleFor(sheet, 'inset-x-0')?.declarations, { left: 0, right: 0 });
    assert.deepEqual(ruleFor(sheet, 'inset-y-2')?.declarations, { top: 8, bottom: 8 });
    assert.deepEqual(ruleFor(sheet, 'start-4')?.declarations, { start: 16 });
  });

  it('is a module a bundler can read, not a string of CSS', () => {
    const code = compileSheetModule('.a { flex: 1 }');
    assert.match(code, /export default/);
    assert.doesNotMatch(code, /flex:\s*1/, 'the CSS itself does not ship');
  });
});

describe('wiring Tailwind into Metro', () => {
  it('builds the sheet before the first bundle asks for it', () => {
    const dir = scratch({
      'styles.css': ENTRY,
      'screen.html': '<view class="p-4 bg-blue-500"></view>',
    });
    const output = path.join(dir, 'app.tailwind.js');

    withTailwind(
      { projectRoot: dir, transformer: {}, resolver: { sourceExts: ['ts'] } },
      { input: path.join(dir, 'styles.css'), output, watch: false },
    );

    const sheet = evaluate(readFileSync(output, 'utf8'));
    assert.ok(ruleFor(sheet, 'p-4'), 'the classes the sources use were scanned and compiled');
    assert.equal(
      ruleFor(sheet, 'bg-blue-500')?.declarations['backgroundColor'],
      'rgb(43, 127, 255)',
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('types the module it generates, so an app importing it typechecks', () => {
    // Expo's tsconfig allows JS, so without a declaration TypeScript infers the sheet's type from
    // its literal - `root: boolean` where the engine wants `root: true` - and `globalStyles`
    // fails to typecheck in every app that follows the setup.
    const dir = scratch({ 'styles.css': ENTRY });
    const output = path.join(dir, 'app.tailwind.js');

    withTailwind(
      { projectRoot: dir, transformer: {}, resolver: { sourceExts: ['ts'] } },
      { input: path.join(dir, 'styles.css'), output, watch: false },
    );

    assert.match(
      readFileSync(path.join(dir, 'app.tailwind.d.ts'), 'utf8'),
      /import\('@solid-native\/fabric'\)\.StyleSheet/,
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('turns a platform variant into a selector the engine matches', () => {
    // Tailwind's own suggestion, `&:where(.platform-ios *)`, puts a combinator inside `:where()`,
    // which the compiler refuses. A plain descendant does the same job and is a selector this
    // engine has always had.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const preset = path.join(here, '../tailwind/native.css');
    const dir = scratch({
      'styles.css': `${ENTRY}@import ${JSON.stringify(preset)};\n`,
      'screen.html': '<view class="ios:p-8 android:p-2"></view>',
    });
    const output = path.join(dir, 'app.tailwind.js');

    withTailwind(
      { projectRoot: dir, transformer: {}, resolver: { sourceExts: ['ts'] } },
      { input: path.join(dir, 'styles.css'), output, watch: false },
    );

    const rule = ruleFor(evaluate(readFileSync(output, 'utf8')), 'ios:p-8');
    assert.ok(rule, 'the variant produced a rule');
    assert.deepEqual(
      rule.compounds.map((compound) => compound.classes),
      [['platform-ios'], ['ios:p-8']],
      'an ancestor carrying the platform class, which the app puts on its root',
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('compiles the safe-area utilities into values the device fills in', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const preset = path.join(here, '../tailwind/native.css');
    const dir = scratch({
      'styles.css': `${ENTRY}@import ${JSON.stringify(preset)};\n`,
      'screen.html': '<view class="pb-safe pb-safe-4 min-pb-safe-6 border-b-hairline"></view>',
    });
    const output = path.join(dir, 'app.tailwind.js');

    withTailwind(
      { projectRoot: dir, transformer: {}, resolver: { sourceExts: ['ts'] } },
      { input: path.join(dir, 'styles.css'), output, watch: false },
    );
    const sheet = evaluate(readFileSync(output, 'utf8'));
    const deferred = (className: string) =>
      (ruleFor(sheet, className) as { deferred?: unknown[] } | undefined)?.deferred?.[0];

    // Nothing is written into `declarations`: the number is not knowable until a view has been
    // laid out, so every one of these resolves at match time against the root's tokens.
    assert.deepEqual(deferred('pb-safe'), {
      props: ['paddingBottom'],
      kind: 'length',
      reference: '--safe-area-inset-bottom',
      fallback: 0,
    });
    assert.deepEqual(deferred('pb-safe-4'), {
      props: ['paddingBottom'],
      kind: 'length',
      reference: '--safe-area-inset-bottom',
      adjust: { offset: 16 },
      fallback: 0,
    });
    assert.deepEqual(deferred('min-pb-safe-6'), {
      props: ['paddingBottom'],
      kind: 'length',
      reference: '--safe-area-inset-bottom',
      adjust: { floor: 24 },
      fallback: 0,
    });
    // `1px` is a browser's idea of a thin line; a native divider is one physical pixel.
    assert.deepEqual(deferred('border-b-hairline'), {
      props: ['borderBottomWidth'],
      kind: 'length',
      reference: '--hairline',
      fallback: 1,
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it('builds a gradient out of the three classes that describe it', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const preset = path.join(here, '../tailwind/native.css');
    const dir = scratch({
      'styles.css': `${ENTRY}@import ${JSON.stringify(preset)};\n`,
      'screen.html':
        '<view class="bg-linear-to-r from-blue-500 via-purple-500 to-pink-500"></view>',
    });
    const output = path.join(dir, 'app.tailwind.js');

    withTailwind(
      { projectRoot: dir, transformer: {}, resolver: { sourceExts: ['ts'] } },
      { input: path.join(dir, 'styles.css'), output, watch: false },
    );
    const sheet = evaluate(readFileSync(output, 'utf8'));

    // The class that paints holds the shape; the classes that colour hold the colours. Which pair
    // a node wears is a question only the cascade can answer, so the rule keeps references.
    const painted = ruleFor(sheet, 'bg-linear-to-r') as { deferred?: { gradient?: unknown }[] };
    assert.deepEqual(painted.deferred?.[0]?.gradient, {
      type: 'linear-gradient',
      direction: { type: 'angle', value: 90 },
      colorStops: [
        {
          reference: '--tw-gradient-from',
          positionReference: '--tw-gradient-from-position',
          position: '0%',
        },
        {
          reference: '--tw-gradient-via',
          positionReference: '--tw-gradient-via-position',
          position: '50%',
        },
        {
          reference: '--tw-gradient-to',
          positionReference: '--tw-gradient-to-position',
          position: '100%',
        },
      ],
    });

    const from = ruleFor(sheet, 'from-blue-500') as { tokens?: Record<string, unknown> };
    assert.deepEqual(from.tokens, { '--tw-gradient-from': { color: 'rgb(43, 127, 255)' } });
    rmSync(dir, { recursive: true, force: true });
  });

  it('leaves a two-stop gradient without a middle stop', () => {
    // Tailwind's fallback for browsers without @property gives every element
    // --tw-gradient-via: #0000. Kept, it paints a transparent stop halfway along every gradient
    // that has no via-* class, and a dark card shows a white streak where the screen behind it
    // shows through. On the web an unset via is not in the gradient at all.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const preset = path.join(here, '../tailwind/native.css');
    const dir = scratch({
      'styles.css': `${ENTRY}@import ${JSON.stringify(preset)};\n`,
      'screen.html':
        '<view class="bg-linear-to-br from-zinc-900 to-slate-800"></view>' +
        '<view class="bg-linear-to-r from-blue-500 via-purple-500 to-pink-500"></view>',
    });
    const output = path.join(dir, 'app.tailwind.js');
    withTailwind(
      { projectRoot: dir, transformer: {}, resolver: { sourceExts: ['ts'] } },
      { input: path.join(dir, 'styles.css'), output, watch: false },
    );
    const sheet = evaluate(readFileSync(output, 'utf8')) as unknown as {
      rules: { compounds: { classes: string[] }[]; tokens?: Record<string, unknown> }[];
    };

    const setters = sheet.rules
      .filter((rule) => rule.tokens && '--tw-gradient-via' in rule.tokens)
      .map((rule) => rule.compounds.map((compound) => compound.classes.join('.')).join(' '));
    assert.deepEqual(
      setters,
      ['via-purple-500'],
      'only a via-* class gives the middle stop a colour',
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('turns and moves an element that has rotate-45 and translate-x-4', () => {
    // Tailwind v4 writes `rotate: 45deg` and `translate: ...`, two properties. Compiled into one
    // `transform` each, the cascade kept whichever class came later in the sheet.
    const dir = scratch({
      'styles.css': ENTRY,
      'screen.html': '<view class="rotate-45 translate-x-4"></view>',
    });
    const output = path.join(dir, 'app.tailwind.js');
    withTailwind(
      { projectRoot: dir, transformer: {}, resolver: { sourceExts: ['ts'] } },
      { input: path.join(dir, 'styles.css'), output, watch: false },
    );
    const sheet = evaluate(readFileSync(output, 'utf8'));
    rmSync(dir, { recursive: true, force: true });

    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: sheet as unknown as StyleSheet });
    const view = engine.createElement('view');
    engine.setClasses(view, 'rotate-45 translate-x-4');
    engine.appendChild(engine.root, view);
    engine.commit();

    assert.deepEqual(fabric.committed[0]!.props['transform'], [
      { translateX: 16 },
      { translateY: 0 },
      { rotate: '45deg' },
    ]);
  });

  it("runs Tailwind 3's own CLI for an app on Tailwind 3", () => {
    // Tailwind 3 ships its CLI inside `tailwindcss`, reads `tailwind.config.js` from the app, and
    // has no `@tailwindcss/cli`. Which one runs is the app's `tailwindcss`, not this package's.
    const dir = scratch({
      'styles.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
      'tailwind.config.js': `module.exports = {
        presets: [require(${JSON.stringify(require.resolve('@solid-native/tailwind/preset.cjs'))})],
        content: ['./*.html'],
      };`,
      'screen.html': '<view class="transform rotate-45 translate-x-4 bg-blue-500 ios:p-4"></view>',
    });
    mkdirSync(path.join(dir, 'node_modules'));
    symlinkSync(
      path.dirname(require.resolve('tailwindcss-v3/package.json')),
      path.join(dir, 'node_modules', 'tailwindcss'),
      // A junction on Windows, which needs no privileges; ignored elsewhere.
      'junction',
    );
    const output = path.join(dir, 'app.tailwind.js');
    withTailwind(
      { projectRoot: dir, transformer: {}, resolver: { sourceExts: ['ts'] } },
      { input: path.join(dir, 'styles.css'), output, watch: false },
    );
    const sheet = evaluate(readFileSync(output, 'utf8'));
    rmSync(dir, { recursive: true, force: true });

    assert.equal(
      ruleFor(sheet, 'bg-blue-500')?.declarations['backgroundColor'],
      'rgb(59, 130, 246)',
    );
    assert.ok(ruleFor(sheet, 'ios:p-4'), 'the preset reached the build');
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: sheet as unknown as StyleSheet });
    const view = engine.createElement('view');
    engine.setClasses(view, 'transform rotate-45 translate-x-4');
    engine.appendChild(engine.root, view);
    engine.commit();
    const transform = Object.assign({}, ...(fabric.committed[0]!.props['transform'] as object[]));
    assert.equal(transform.translateX, 16);
    assert.equal(transform.rotate, '45deg');
  });

  it('refuses an output name that is not a module', () => {
    // A `.css` output would be swallowed by Expo's own transform worker, which returns an empty
    // module for CSS on native - a stylesheet that silently contained nothing.
    const dir = scratch({ 'styles.css': ENTRY });
    assert.throws(
      () =>
        withTailwind(
          { projectRoot: dir, transformer: {}, resolver: { sourceExts: ['ts'] } },
          { input: path.join(dir, 'styles.css'), output: path.join(dir, 'app.css'), watch: false },
        ),
      /\.js/,
    );
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('watching', () => {
  const expo = (...args: string[]) => ['node', '/app/node_modules/.bin/expo', ...args];

  it('watches for a dev server, and not for a one-off build or in CI', () => {
    assert.equal(watchesByDefault(expo('start'), {}), true);
    assert.equal(watchesByDefault(expo('run:ios', '--port', '8081'), {}), true);
    assert.equal(watchesByDefault(expo('export', '--platform', 'ios'), {}), false);
    assert.equal(watchesByDefault(expo('export:embed'), {}), false);
    assert.equal(watchesByDefault(expo('start'), { CI: '1' }), false);
    assert.equal(watchesByDefault(expo('start'), { CI: 'false' }), true);
    // Loaded on its own to build the sheet before a typecheck.
    assert.equal(watchesByDefault(['node', '/app/metro.config.js'], {}), false);
  });

  it('lets an export exit once it is done, with nothing left running', () => {
    // `npx expo export` loads the config as a dev server does, and was only let out by Expo
    // killing the watcher it had started. Run here as an export would: the command on argv.
    const dir = scratch({
      'styles.css': ENTRY,
      'screen.html': '<view class="p-4"></view>',
      'load.cjs': [
        `const { withTailwind } = require(${JSON.stringify(require.resolve('@solid-native/tailwind/config.cjs'))});`,
        `withTailwind({ projectRoot: __dirname, transformer: {}, resolver: { sourceExts: ['ts'] } },`,
        `  { input: __dirname + '/styles.css', output: __dirname + '/app.tailwind.js' });`,
      ].join('\n'),
    });
    try {
      const env = { ...process.env, CI: '' };
      const run = spawnSync(process.execPath, [path.join(dir, 'load.cjs'), 'export'], {
        env,
        timeout: 20_000,
        // The config handles SIGTERM itself, to stop the watcher, so a hung run needs this.
        killSignal: 'SIGKILL',
      });
      assert.equal(run.error, undefined, 'the process exited by itself');
      assert.equal(run.status, 0, String(run.stderr));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the imports worth watching', () => {
  /**
   * Editing a package's `theme.css` did not reach the device.
   *
   * The CLI's watcher re-reads the entry and resolves its `@import`s from a cache, so a change
   * inside one of them rebuilds nothing - the sheet on disk stays as it was, with no error and no
   * warning. Touching the entry makes it re-read everything, so the entry's own local imports are
   * watched and a change to one touches it.
   *
   * "Local" means a file in this repository rather than a package in `node_modules`. Through
   * pnpm a workspace package is a symlink, so it resolves back into the source tree, and that is
   * exactly the set that changes while someone is working. Tailwind's own stylesheets do not.
   */
  /**
   * An app directory, which is where the entry sits and so where its imports resolve from. This
   * package serves: it has `tailwindcss` and a workspace link to `@solid-native/tailwind`.
   */
  const app = fileURLToPath(new URL('.', import.meta.url));

  it('finds a workspace package behind its symlink', () => {
    const found = localImports(`@import '@solid-native/tailwind/native.css';`, app);
    assert.equal(found.length, 1);
    assert.ok(found[0]!.endsWith(path.join('packages', 'tailwind', 'native.css')), found[0]);
    assert.ok(!found[0]!.includes('node_modules'), 'resolved through the link, not to it');
  });

  it('ignores a third-party stylesheet, which does not change while you work', () => {
    assert.deepEqual(localImports(`@import 'tailwindcss/utilities.css';`, app), []);
  });

  it('takes a relative import as written', () => {
    const found = localImports(
      `@import './tailwind-utilities.css';`,
      fileURLToPath(new URL('./fixtures', import.meta.url)),
    );
    assert.equal(found.length, 1);
    assert.ok(found[0]!.endsWith(path.join('fixtures', 'tailwind-utilities.css')));
  });

  it('skips an import that resolves to nothing rather than failing the build', () => {
    // A typo in a stylesheet is the CLI's error to report, with a line number. Throwing from the
    // watcher setup would replace that with a stack trace from Metro's config.
    assert.deepEqual(localImports(`@import 'no-such-package/x.css';`, app), []);
  });

  it('reads every import in the sheet, in both quote styles', () => {
    const css = `@import "./fixtures/tailwind-utilities.css";\n@import '@solid-native/tailwind/native.css';`;
    assert.equal(localImports(css, app).length, 2);
  });
});
