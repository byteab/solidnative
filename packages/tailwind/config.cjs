/**
 * Tailwind, wired into Metro.
 *
 * ```js
 * const config = withSolidNative(getDefaultConfig(__dirname), { workspaceRoot });
 * module.exports = withTailwind(config, { input: './styles.css' });
 * ```
 *
 * and in the app:
 *
 * ```ts
 * import tailwind from '../.solid-native/app.tailwind.js';
 * // ...and pass `tailwind` to the app's global styles (see `withNativeStyles`).
 * ```
 *
 * The CLI is run rather than the JavaScript API used: scanning source files for class names is
 * most of what Tailwind does, its own binary is the thing that does it properly, and a bundler
 * plugin that reimplements the scan is a bundler plugin that disagrees with the CLI eventually.
 */
const { execFileSync, spawn } = require('node:child_process');
const {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  utimesSync,
  watchFile,
  writeFileSync,
} = require('node:fs');
const path = require('node:path');
const { compileCss } = require('@solid-native/metro/css/compile.cjs');
const { flattenTailwind } = require('./flatten.cjs');

/** Where the generated module goes if the app does not say. */
const DEFAULT_OUTPUT = '.solid-native/app.tailwind.js';

/**
 * @param {object} config a Metro config, after `withSolidNative`
 * @param {{ input: string, output?: string, watch?: boolean }} options
 *   `input` is the app's Tailwind entry - the file with the `@import`s. `output` is the module the
 *   app imports, and must be JavaScript: Expo's own transform worker claims every `.css` file
 *   before ours is asked, and hands back an empty module on any platform but web, so a stylesheet
 *   that arrived as CSS would silently contain nothing. `watch` is what makes a newly written
 *   class appear without restarting the dev server; it defaults to on for a dev server and off
 *   for a one-off build (see `watchesByDefault`).
 */
function withTailwind(config, options) {
  const projectRoot = config.projectRoot ?? process.cwd();
  const input = path.resolve(projectRoot, options.input);
  const output = path.resolve(projectRoot, options.output ?? DEFAULT_OUTPUT);
  if (!/\.[cm]?js$/.test(output)) {
    throw new Error(
      `[solid-native] the Tailwind output has to be a .js module, because Expo's transform ` +
        `worker turns every .css file into an empty one on native. Got ${output}`,
    );
  }
  // The CLI's own output, kept beside the module: useful to read when a utility goes missing.
  const css = output.replace(/\.[cm]?js$/, '.css');

  mkdirSync(path.dirname(output), { recursive: true });
  run([cliPath(projectRoot), '-i', input, '-o', css], projectRoot);
  generate(css, output);
  // Without it TypeScript infers the sheet from its literal, which is not assignable to the type
  // `globalStyles` takes. `.js` -> `.d.ts`, `.mjs` -> `.d.mts`, `.cjs` -> `.d.cts`.
  writeFileSync(
    output.replace(/\.([cm]?)js$/, '.d.$1ts'),
    "declare const sheet: import('@solid-native/fabric').StyleSheet;\nexport default sheet;\n",
  );
  if (options.watch ?? watchesByDefault()) watch(input, css, output, projectRoot);

  return config;
}

/** The Expo and React Native commands that build once and exit, rather than serve. */
const ONE_OFF_COMMANDS = new Set(['export', 'export:embed', 'bundle', 'prebuild']);

/**
 * Whether to watch when the app does not say: not in CI, and not for a one-off build.
 *
 * `npx expo export` loads the Metro config like a dev server does, and a watcher started for it
 * kept the process alive after the bundles were written, until Expo gave up and killed it with
 * "Detected 1 process preventing Expo from exiting". A build has nothing to watch for, and in CI
 * Metro watches nothing either.
 */
function watchesByDefault(argv = process.argv, env = process.env) {
  const ci = env['CI'];
  if (ci && ci !== 'false' && ci !== '0') return false;
  // `node metro.config.js`, run to build the sheet before a typecheck, is a one-off too.
  if (/^metro\.config\.[cm]?js$/.test(path.basename(argv[1] ?? ''))) return false;
  return !argv.slice(2).some((arg) => ONE_OFF_COMMANDS.has(arg));
}

/** The CLI's CSS, compiled into the module the app imports. */
function generate(css, output) {
  writeFileSync(output, compileSheetModule(readFileSync(css, 'utf8'), css));
}

/**
 * Tailwind's CSS as a module exporting the compiled stylesheet.
 *
 * Exported because it is the whole of the build step worth testing: everything else here is
 * process wrangling.
 */
function compileSheetModule(css, context = 'tailwind') {
  const dropped = [];
  const sheet = compileCss(flattenTailwind(css), context, {
    onUnsupported: (message) => dropped.push(message),
  });
  for (const message of dropped) {
    // A leftover custom property was already substituted; anything else is a utility the app used
    // and native cannot express, which is worth saying while it is still being written.
    if (!message.includes("dropped '--")) console.warn(`[solid-native] ${message}`);
  }
  return `// Generated from ${path.basename(context)}. Edit the Tailwind entry, not this.\nexport default ${JSON.stringify(sheet)};\n`;
}

/**
 * The entry's own `@import`s that live in this repository, resolved past any symlink.
 *
 * The CLI re-reads the entry on a change and resolves its imports from a cache, so editing one of
 * them rebuilds nothing: the sheet on disk stays as it was, with no error and no warning, and the
 * device goes on wearing styles from before the edit. Touching the entry makes it re-read
 * everything, so these are watched and a change to one touches it.
 *
 * Local means in the source tree rather than in `node_modules`. Through pnpm a workspace package
 * is a symlink, so it resolves back into the repository - which is exactly the set that changes
 * while someone is working on it. Tailwind's own stylesheets do not.
 *
 * Exported for the test: everything else here is process wrangling, and this is the one part with
 * a rule in it.
 */
function localImports(css, cwd) {
  const found = [];
  for (const match of css.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    try {
      const resolved = specifier.startsWith('.')
        ? path.resolve(cwd, specifier)
        : require.resolve(specifier, { paths: [cwd] });
      const real = realpathSync(resolved);
      // A typo is the CLI's error to report, with a line number. Throwing here would replace that
      // with a stack trace out of Metro's config, which names nothing useful.
      if (!real.split(path.sep).includes('node_modules')) found.push(real);
    } catch {
      continue;
    }
  }
  return found;
}

/** Build once, synchronously, so the module exists before Metro resolves the first import. */
function run(args, cwd) {
  execFileSync(process.execPath, args, { cwd, stdio: 'pipe' });
}

/**
 * The CLI, left running, and the generated module kept in step with what it writes.
 *
 * Metro watches the module, so a class written in a template reaches the device the way an edited
 * template does: the CLI notices the source, rewrites the CSS, this rewrites the module.
 */
function watch(input, css, output, cwd) {
  let stopping = false;
  const child = spawn(process.execPath, [cliPath(cwd), '-i', input, '-o', css, '--watch'], {
    cwd,
    // A pipe for stdin, never written to, rather than `ignore`.
    //
    // `ignore` gives the child `/dev/null`, which reads EOF immediately - and the CLI treats a
    // closed stdin as "the thing that started me has gone" and exits, cleanly, with code 0, about
    // a second after being spawned. An open pipe never reaches EOF, so it stays up.
    //
    // This is what made every class written after the dev server started go missing on the
    // device while being present in Node, which is a confusing shape of bug: the app is running
    // the code you just wrote, styled by a sheet from hours ago.
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  // Nothing here keeps the process alive on its own: a dev server does that, and a process that
  // is done should be able to exit with the watcher still up.
  child.unref();
  child.stdin?.unref?.();

  /*
   * Say so when it dies, because the failure is otherwise invisible and looks like anything else.
   *
   * A dead watcher does not break the build: the stylesheet on disk is still the last good one, so
   * everything written before it died keeps working and only new classes are missing. What that
   * looks like on a device is one component laid out as though a class had been misspelt, which is
   * where anybody would start looking - and it cost an afternoon before this line existed.
   */
  child.once('exit', (code, signal) => {
    if (stopping) return;
    console.error(
      `[solid-native] the Tailwind watcher exited (${signal ?? `code ${code}`}). Classes written ` +
        'from now on will not reach the device until Metro is restarted.',
    );
  });

  watchFile(css, { interval: 200, persistent: false }, () => generate(css, output));

  // A change inside an imported sheet is invisible to the CLI's cache. Touching the entry is what
  // makes it read them all again.
  for (const file of localImports(readFileSync(input, 'utf8'), path.dirname(input))) {
    watchFile(file, { interval: 200, persistent: false }, () => {
      const now = new Date();
      utimesSync(input, now, now);
    });
  }
  const stop = () => {
    stopping = true;
    child.kill();
  };
  process.once('exit', stop);
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

/**
 * The app's Tailwind CLI, resolved from the app rather than from here: it is the app's dependency.
 *
 * Tailwind 3 ships its CLI inside `tailwindcss` itself; Tailwind 4 moved it to `@tailwindcss/cli`.
 * The app's `tailwindcss` says which it is on.
 */
function cliPath(cwd) {
  const paths = { paths: [cwd, __dirname] };
  const tailwind = require.resolve('tailwindcss/package.json', paths);
  const from = require(tailwind).version.startsWith('3.')
    ? tailwind
    : require.resolve('@tailwindcss/cli/package.json', paths);
  const { bin, name } = require(from);
  const entry = typeof bin === 'string' ? bin : bin[Object.keys(bin)[0]];
  const resolved = path.join(path.dirname(from), entry);
  if (!existsSync(resolved)) {
    throw new Error(`[solid-native] found ${name} but not its binary at ${resolved}`);
  }
  return resolved;
}

module.exports = { withTailwind, compileSheetModule, localImports, watchesByDefault };
