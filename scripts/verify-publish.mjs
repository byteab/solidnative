/**
 * Publish everything to a local registry, generate an app from the template, test it and bundle it.
 *
 * The thing this checks that nothing else does is *distribution*: that the packages publish at
 * all, that they find each other by version through a registry rather than through workspace
 * links, and that `create-expo-app --template` produces something that builds and whose tests
 * run. A tarball installed by path proves none of that - it resolves siblings by file path, which
 * is exactly the part a real install does differently.
 *
 * Nothing reaches npmjs. Verdaccio serves `@solidnative/*` itself and proxies the rest, and
 * the registry is configured with no uplink for our scope so a package that failed to publish
 * cannot be quietly satisfied by the real registry.
 *
 * `--generators` also adds a native app to a fresh Nx workspace with `nx add @solidnative/nx`, and
 * tests and bundles it. It installs with npm, which refuses a peer range it cannot satisfy where
 * pnpm only warns. It takes minutes, so the release workflow runs it and CI does not.
 *
 * `--scenario=<name>` runs one of `SCENARIOS` below instead, for the weekly workflow in
 * `latest.yml`: a workspace made the way a user makes one, on the newest versions its ranges
 * allow, then installed a second time, tested, and exported for both platforms. It ends by
 * printing the Solid, Expo, React Native, Nx, TypeScript and Vite it resolved, into the
 * job summary on GitHub Actions, so a failure names the release that caused it.
 *
 * `--web` also sets up a browser app on `@solidnative/web` the way its documentation page does, from
 * the registry, builds it with Vite and checks it renders and responds in Chromium. The `web`
 * scenario runs that alone.
 *
 * Usage: node scripts/verify-publish.mjs [--generators] [--web] | --scenario=<name>
 *        (with verdaccio listening on 4873, or on $REGISTRY)
 */
import { execFileSync, spawn } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = process.env.REGISTRY ?? 'http://localhost:4873';

/** Every package that would go to npm, plus the template. */
const PUBLISHED = [
  'packages/components',
  'packages/device',
  'packages/expo',
  'packages/fabric',
  'packages/icons',
  'packages/metro',
  'packages/nx',
  'packages/platform',
  'packages/router',
  'packages/tailwind',
  'packages/testing',
  'packages/web',
  'template',
];

/**
 * Fresh caches for every run: npm's, pnpm's metadata, and `create-expo-app`'s template cache,
 * which lives under the temp directory.
 *
 * Every build publishes the same `0.0.0`, so a cache keyed by name and version hands back whatever
 * the *last* run published. `create-expo-app` did exactly that: the app it generated was from a
 * template several changes old, and the check passed or failed on code nobody had written this
 * time. pnpm's content-addressed store is safe to share, because fresh metadata brings a fresh
 * integrity hash with it.
 */
const caches = mkdtempSync(path.join(tmpdir(), 'solid-native-caches-'));

const run = (cmd, args, cwd, quiet = true) =>
  execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: {
      ...process.env,
      npm_config_registry: REGISTRY,
      npm_config_cache: path.join(caches, 'npm'),
      // pnpm's metadata cache, for the installs `create-nx-workspace` and `nx add` start, which
      // pass no `--cache-dir`. Not `npm_config_cache_dir`, which npm warns about on every command.
      XDG_CACHE_HOME: path.join(caches, 'xdg'),
      TMPDIR: caches,
      // Off, as it is on CI already: a daemon outlives the workspace it was started in.
      NX_DAEMON: 'false',
    },
  });

/** `npm install` or `pnpm install`, from the registry, with this run's fresh caches. */
const install = (pm, cwd) =>
  pm === 'pnpm'
    ? run('pnpm', ['install', '--cache-dir', path.join(caches, 'pnpm')], cwd)
    : run('npm', ['install'], cwd);

const manifestOf = (dir) => path.join(root, dir, 'package.json');

function publishAll() {
  for (const dir of PUBLISHED) {
    const { name, version } = JSON.parse(readFileSync(manifestOf(dir), 'utf8'));
    // Every run publishes the same version, so an earlier run's is removed first: skipping it would
    // check that run's build instead of this one. Nothing to remove is fine.
    try {
      run('npm', ['unpublish', `${name}@${version}`, '--force', '--registry', REGISTRY], root);
    } catch {}
    try {
      // `--no-git-checks`: this runs against a working tree, committed or not.
      run(
        'pnpm',
        ['publish', '--registry', REGISTRY, '--no-git-checks', '--tag', 'local'],
        path.join(root, dir),
      );
      console.log(`  published  ${name}`);
    } catch (error) {
      throw new Error(`${name}: ${String(error.stdout ?? '')}${String(error.stderr ?? '')}`);
    }
  }
}

function generateApp(dir = mkdtempSync(path.join(tmpdir(), 'solid-native-probe-'))) {
  const app = path.join(dir, 'app');
  console.log(`\ngenerating an app in ${app}`);
  run(
    'npx',
    [
      '--yes',
      'create-expo-app@latest',
      app,
      '--template',
      '@solidnative/template',
      '--no-install',
      '--no-agents-md',
    ],
    dir,
  );
  return app;
}

/**
 * Installs, typechecks, tests and bundles an app from the template. `latest` is a scenario's
 * wider check: the install run a second time, as a user's next `npm install` would, and an Android
 * bundle beside the iOS one.
 */
function check(app, { pm = 'pnpm', latest = false } = {}) {
  // The generated app resolves @solidnative/* from the registry, by version, like a stranger.
  writeFileSync(path.join(app, '.npmrc'), `registry=${REGISTRY}\n`);
  console.log(`installing from the registry with ${pm}`);
  install(pm, app);
  if (latest) {
    console.log(`${pm} install, again`);
    install(pm, app);
  }

  console.log('typechecking');
  run('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit'], app);

  // The template's own example test, through `@solidnative/testing/register` as installed: the proof
  // that Solid's JSX and `.native.css` compile out of `node_modules/@solidnative/*`, which inside
  // this workspace are symlinked source instead.
  console.log('testing');
  run(pm, ['test'], app);

  console.log('bundling');
  const modules = bundle(
    'npx',
    ['expo', 'export', '--platform', 'ios', '--output-dir', path.join(app, 'dist')],
    app,
  );
  if (latest) {
    console.log('bundling for android');
    bundle(
      'npx',
      ['expo', 'export', '--platform', 'android', '--output-dir', path.join(app, 'dist-android')],
      app,
    );
  }

  // The dev bundle too: it carries the HMR blocks a release bundle leaves out, and those broke on
  // `node_modules/@solidnative/...` paths while the release bundle above still built.
  console.log('bundling for development');
  run(
    'npx',
    ['expo', 'export', '--platform', 'ios', '--dev', '--output-dir', path.join(app, 'dist-dev')],
    app,
  );
  return modules;
}

/** The iOS bundle of an app, and its module count, or a failure with Metro's output. */
function bundle(cmd, args, cwd) {
  // Nx passes the child's colours through, which split the line this reads.
  const out = run(cmd, args, cwd).replace(/\x1b\[[0-9;]*m/g, '');
  const modules = /Bundled \d+ms .*? \((\d+) modules\)/.exec(out)?.[1];
  if (!modules) throw new Error(`no bundle was produced:\n${out}`);
  return modules;
}

/**
 * Starts a dev server the way a person would, and has it build the app: Metro up, the iOS manifest
 * Expo Go would ask for, then the bundle that manifest names. Stopped either way.
 */
async function serve(cmd, args, cwd, port) {
  const child = spawn(cmd, args, {
    cwd,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_registry: REGISTRY, CI: '1' },
  });
  let log = '';
  child.stdout.on('data', (chunk) => (log += chunk));
  child.stderr.on('data', (chunk) => (log += chunk));
  const base = `http://localhost:${port}`;
  try {
    for (let tries = 0; ; tries++) {
      const status = await fetch(`${base}/status`).then(
        (r) => r.text(),
        () => '',
      );
      if (status.includes('packager-status:running')) break;
      if (tries === 180 || child.exitCode !== null) throw new Error(`no dev server:\n${log}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const manifest = await fetch(base, { headers: { 'expo-platform': 'ios' } }).then((r) =>
      r.json(),
    );
    const bundle = await fetch(manifest.launchAsset.url);
    const code = await bundle.text();
    if (!bundle.ok || code.length < 100_000) {
      throw new Error(
        `the dev server did not build the app (${bundle.status}):\n${code.slice(0, 2000)}`,
      );
    }
    return `${Math.round(code.length / 1024)} KB`;
  } finally {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone: Metro can exit on its own before the server ever answers.
    }
  }
}

/**
 * A workspace from Nx's TypeScript preset, with an app from `@solidnative/nx`. `latest` also
 * installs a second time, and runs the rest of the targets a user would: an Android export, a
 * bare one for every platform, and `nx prebuild`.
 */
async function nxWorkspace(dir, { pm = 'npm', latest = false, port = 8092 } = {}) {
  console.log(`\ncreate-nx-workspace --preset=ts with ${pm}, then nx add @solidnative/nx`);
  run(
    'npx',
    [
      '--yes',
      'create-nx-workspace@latest',
      'monorepo',
      '--preset=ts',
      `--packageManager=${pm}`,
      // No `--ci=skip`: create-nx-workspace 23.2.1 passes it on twice and then fails on
      // `'skip,skip'`. Without it, a non-interactive run generates no CI workflow anyway.
      '--nxCloud=skip',
      '--interactive=false',
    ],
    dir,
  );
  const workspace = path.join(dir, 'monorepo');
  writeFileSync(path.join(workspace, '.npmrc'), `registry=${REGISTRY}\n`);
  run('npx', ['nx', 'add', '@solidnative/nx@local'], workspace);
  run('npx', ['nx', 'g', '@solidnative/nx:app', 'apps/mobile', '--no-interactive'], workspace);
  // `mobile`, or `@monorepo/mobile` where the root package is scoped, as the TypeScript preset's is.
  const project = readJson(path.join(workspace, 'apps/mobile/package.json')).name;
  if (latest) {
    console.log(`${pm} install, again`);
    install(pm, workspace);
  }
  console.log('typechecking and testing');
  run('npx', ['nx', 'run-many', '-t', 'typecheck', 'test', '-p', project], workspace);
  console.log(`nx export ${project}`);
  const modules = bundle('npx', ['nx', 'export', project, '--platform', 'ios'], workspace);
  if (latest) {
    console.log(`nx export ${project} --platform android`);
    bundle('npx', ['nx', 'export', project, '--platform', 'android'], workspace);
    console.log(`nx export ${project}, for every platform`);
    bundle('npx', ['nx', 'export', project], workspace);
  }
  console.log(`nx start ${project}`);
  const served = await serve(
    'npx',
    ['nx', 'start', project, '--port', String(port)],
    workspace,
    port,
  );
  if (latest) {
    // Last, because it writes the native projects into the app. `--no-install` leaves CocoaPods
    // out of it, which only a Mac has.
    console.log(`nx prebuild ${project}`);
    run('npx', ['nx', 'prebuild', project, '--no-install'], workspace);
  }
  return `${modules} modules, and nx start builds ${served}`;
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/**
 * The browser app `apps/documentation/src/content/packages/web.md` sets up, file for file: a Vite
 * config with `solidNativeWeb()`, Tailwind with the web preset, and one universal Solid component
 * with a text, a pressable that counts, and a view styled by its own `.native.css`.
 */
const WEB_FILES = {
  'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My app</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
  'vite.config.ts': `import tailwindcss from '@tailwindcss/vite';
import { solidNativeWeb } from '@solidnative/web/solid/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [solidNativeWeb(), tailwindcss()],
});
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
`,
  'src/styles.css': `@import 'tailwindcss/theme.css';
@import 'tailwindcss/utilities.css';
@import '@solidnative/tailwind/web.css';
`,
  'src/main.ts': `import { mount } from '@solidnative/web/solid';
import { App } from './app.solid.tsx';
import './styles.css';

mount(document.getElementById('root')!, App);
`,
  'src/app.native.css': `.card {
  margin: 24px;
  padding: 16px;
  gap: 12px;
  border-radius: 12px;
  background-color: rgb(238, 242, 255);
}
`,
  'src/app.solid.tsx': `/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, Text, View } from '@solidnative/components/solid';
import { withNativeStyles } from '@solidnative/platform/solid';
import sheet from './app.native.css';

export function App() {
  const [count, setCount] = createSignal(0);
  return withNativeStyles(sheet, () => (
    <View class="card" testID="card">
      <Text class="text-lg font-semibold">Hello from solid-native</Text>
      <Pressable
        class="rounded-lg bg-blue-600 px-4 py-2"
        testID="counter"
        accessibilityRole="button"
        onPress={() => setCount(count() + 1)}
      >
        <Text class="text-white">Pressed {count()} times</Text>
      </Pressable>
    </View>
  ));
}
`,
};

/** The install commands `web.md` gives, in order. */
const WEB_INSTALLS = [
  ['install', 'solid-js', '@solidnative/components', '@solidnative/web', '@solidnative/metro'],
  ['install', '--save-dev', 'vite', 'typescript'],
  ['install', '--save-dev', 'tailwindcss', '@tailwindcss/vite', '@solidnative/tailwind'],
];

/**
 * A browser app from the packages on the registry: installed the way `web.md` says, typechecked,
 * built with Vite, served with `vite preview` and driven in Chromium. The text renders, a press
 * updates the count, and the view's own CSS and a Tailwind class both reach the page.
 *
 * Chromium comes from `@solidnative/web`'s own Playwright in this workspace, so the app installs
 * nothing a user would not.
 */
async function webApp(dir) {
  const app = path.join(dir, 'web');
  console.log(`\nsetting up a browser app in ${app}`);
  mkdirSync(path.join(app, 'src'), { recursive: true });
  writeFileSync(path.join(app, '.npmrc'), `registry=${REGISTRY}\n`);
  run('npm', ['init', '-y'], app);
  run('npm', ['pkg', 'set', 'type=module'], app);
  for (const args of WEB_INSTALLS) run('npm', args, app);
  for (const [file, text] of Object.entries(WEB_FILES)) writeFileSync(path.join(app, file), text);

  console.log('typechecking');
  run('npx', ['tsc', '-p', 'tsconfig.json'], app);
  console.log('vite build');
  run('npx', ['vite', 'build'], app);
  console.log('vite preview, in Chromium');
  return preview(app, 4180);
}

/** Serves the built app and checks it in a real browser, stopping the server either way. */
async function preview(app, port) {
  const child = spawn(
    process.execPath,
    [
      path.join(app, 'node_modules/vite/bin/vite.js'),
      'preview',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: app, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let log = '';
  child.stdout.on('data', (chunk) => (log += chunk));
  child.stderr.on('data', (chunk) => (log += chunk));
  const url = `http://localhost:${port}/`;
  const { chromium } = createRequire(path.join(root, 'packages/web/package.json'))('playwright');
  const browser = await chromium.launch();
  const up = () =>
    fetch(url).then(
      (response) => response.ok,
      () => false,
    );
  try {
    for (let tries = 0; !(await up()); tries++) {
      if (tries === 60 || child.exitCode !== null) throw new Error(`no preview server:\n${log}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return await checkWebPage(await browser.newPage(), url);
  } finally {
    await browser.close();
    child.kill();
  }
}

/** What the page has to show, and what a press has to change. */
async function checkWebPage(page, url) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await page.goto(url);
  const counter = page.getByTestId('counter');
  try {
    await page.getByText('Hello from solid-native').waitFor({ timeout: 10_000 });
    await counter.getByText('Pressed 0 times').waitFor({ timeout: 1_000 });
  } catch {
    throw new Error(`the app did not render:\n${errors.join('\n') || (await page.content())}`);
  }
  await counter.click();
  await counter.click();
  await counter.getByText('Pressed 2 times').waitFor({ timeout: 2_000 });

  const styles = await page.evaluate(() => {
    const read = (id, property) =>
      getComputedStyle(document.querySelector(`[data-testid="${id}"]`))[property];
    return { card: read('card', 'backgroundColor'), counter: read('counter', 'backgroundColor') };
  });
  if (styles.card !== 'rgb(238, 242, 255)') {
    throw new Error(`the component's own CSS did not apply: ${styles.card}`);
  }
  // Tailwind 4's `bg-blue-600` is an oklch() colour; without the class there is no background.
  if (!styles.counter.startsWith('oklch(')) {
    throw new Error(`the Tailwind class did not apply: ${styles.counter}`);
  }
  if (errors.length) throw new Error(`the page logged errors:\n${errors.join('\n')}`);
  return 'with Vite and, in Chromium, renders, counts presses and applies its CSS and Tailwind';
}

/**
 * The weekly checks against the newest versions each setup's ranges allow, one CI job each. `app`
 * is where the native app ends up, which is where its versions are read from.
 */
const SCENARIOS = {
  'template-npm': { app: 'app', run: (dir) => templateScenario(dir, 'npm') },
  'template-pnpm': { app: 'app', run: (dir) => templateScenario(dir, 'pnpm') },
  'nx-ts-npm': {
    app: 'monorepo/apps/mobile',
    run: (dir) => nxWorkspace(dir, { pm: 'npm', latest: true }),
  },
  'nx-ts-pnpm': {
    app: 'monorepo/apps/mobile',
    run: (dir) => nxWorkspace(dir, { pm: 'pnpm', latest: true, port: 8093 }),
  },
  web: { app: 'web', run: webApp },
};

function templateScenario(dir, pm) {
  return `${check(generateApp(dir), { pm, latest: true })} modules`;
}

/** What a failure most likely moved under us. */
const REPORTED = {
  Solid: 'solid-js',
  Expo: 'expo',
  'React Native': 'react-native',
  Nx: 'nx',
  TypeScript: 'typescript',
  Vite: 'vite',
};

/** The version of `name` the app resolves, looking up through `node_modules` as far as `top`. */
function resolvedVersion(name, app, top) {
  for (let dir = app; dir.startsWith(top); dir = path.dirname(dir)) {
    const manifest = path.join(dir, 'node_modules', name, 'package.json');
    if (existsSync(manifest)) return readJson(manifest).version;
  }
  return undefined;
}

/** The versions a scenario ran on, in the log and, on GitHub Actions, in the job summary. */
function reportVersions(name, outcome, app, top) {
  const rows = Object.entries(REPORTED).map(
    ([label, pkg]) => `| ${label} | \`${pkg}\` | ${resolvedVersion(pkg, app, top) ?? '-'} |`,
  );
  const table = [
    `### ${name}: ${outcome}`,
    '',
    '| | Package | Resolved |',
    '| --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
  console.log(`\n${table}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
}

async function runScenario(name) {
  const scenario = SCENARIOS[name];
  const dir = mkdtempSync(path.join(tmpdir(), `solid-native-${name}-`));
  const started = Date.now();
  const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;
  try {
    console.log(`\nok  ${name}: the app bundles ${await scenario.run(dir)}, in ${elapsed()}`);
    reportVersions(name, `passed in ${elapsed()}`, path.join(dir, scenario.app), dir);
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    reportVersions(name, `failed after ${elapsed()}`, path.join(dir, scenario.app), dir);
    console.log(`the workspace is left in ${dir}`);
    rmSync(caches, { recursive: true, force: true });
    throw error;
  }
}

const scenario = process.argv.find((arg) => arg.startsWith('--scenario='))?.split('=')[1];
if (scenario !== undefined && !SCENARIOS[scenario]) {
  throw new Error(`No scenario "${scenario}". There are: ${Object.keys(SCENARIOS).join(', ')}.`);
}

// The packages publish their `dist`, so what goes out is what the build makes now.
run('pnpm', ['nx', 'run-many', '-t', 'build', '-p', '@solidnative/*'], root);
console.log(`publishing to ${REGISTRY}`);
publishAll();

if (scenario) {
  await runScenario(scenario);
} else {
  const app = generateApp();
  const modules = check(app);
  console.log(`\nok  an app generated from the template bundles ${modules} modules`);
  rmSync(path.dirname(app), { recursive: true, force: true });

  if (process.argv.includes('--generators')) {
    const dir = mkdtempSync(path.join(tmpdir(), 'solid-native-workspace-'));
    console.log(
      `\nok  nx g @solidnative/nx:app: the native app bundles ${await nxWorkspace(dir)}`,
    );
    rmSync(dir, { recursive: true, force: true });
  }

  if (process.argv.includes('--web')) {
    const dir = mkdtempSync(path.join(tmpdir(), 'solid-native-web-'));
    console.log(`\nok  a browser app on @solidnative/web bundles ${await webApp(dir)}`);
    rmSync(dir, { recursive: true, force: true });
  }
}
rmSync(caches, { recursive: true, force: true });
