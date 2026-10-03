/**
 * `nx g @solid-native/nx:app apps/mobile`: a native Solid app as a project of this workspace.
 *
 * The app is an Expo project, built by Metro. `@nx/expo`'s plugin, which `init` registers, infers
 * its Expo targets from the files written here; `project.json` adds the two it cannot infer:
 * `typecheck`, since Expo's `tsconfig` sets `noEmit` and `@nx/js` disables its own for that, and
 * `test`, which runs the app's tests in Node's test runner. It also replaces the inferred `start`,
 * which is `@nx/expo:start`, an executor Nx deprecates and warns about on every run, with the
 * `expo start` that executor runs, as the plugin already infers `run-ios` and `export`. Once the
 * plugin infers `start` as a command too, this one can go.
 *
 * Where the dependencies go depends on the workspace. With package-manager workspaces, the Nx
 * default since 20, the app is a workspace package and lists them itself, which pnpm needs in
 * order to link them. In an integrated workspace, with one root `package.json`, they go there.
 */
const path = require('node:path').posix;
const {
  formatFiles,
  joinPathFragments,
  logger,
  offsetFromRoot,
  readJson,
  runTasksInSerial,
  addProjectConfiguration,
  installPackagesTask,
  addDependenciesToPackageJson,
} = require('@nx/devkit');
const native = require('../native-app.cjs');
const { init } = require('../init/index.cjs');
const { usesWorkspaces, includeInWorkspaces } = require('./workspaces.cjs');

function names(tree, options) {
  const directory = path.normalize(options.directory).replace(/\/$/, '');
  const name = options.name ?? path.basename(directory);
  const scope = readJson(tree, 'package.json').name?.match(/^@[^/]+/)?.[0];
  const workspaces = usesWorkspaces(tree);
  // A workspace package is named for the workspace's scope, as Nx names its own.
  const projectName = workspaces && scope ? `${scope}/${name}` : name;
  return { directory, name, projectName, workspaces };
}

/**
 * @param {string} directory
 * @param {string[]} conditions the workspace's custom conditions, which Node's test runner does not
 *   read from tsconfig
 */
function targets(directory, conditions, workspaceBase) {
  const run = (command) => ({ executor: 'nx:run-commands', options: { cwd: directory, command } });
  const flags = conditions.map((condition) => `--conditions=${condition} `).join('');
  return {
    typecheck: {
      ...run(native.COMMANDS.typecheck),
      cache: true,
      inputs: ['default', '^production'],
    },
    test: {
      ...run(native.testCommand(workspaceBase).replace(/^node /, `node ${flags}`)),
      cache: true,
      inputs: ['default', '^production'],
    },
    start: { ...run('expo start'), continuous: true },
  };
}

/** The Commands section of the app's `AGENTS.md`, as this workspace runs them. */
function commands(name) {
  const rows = [
    [`nx start ${name}`, 'Metro; press i or a for a simulator, or scan the QR code with Expo Go'],
    [`nx run ${name}:run-ios`, 'the iOS simulator'],
    [`nx run ${name}:run-android`, 'the Android emulator'],
    [`nx test ${name}`, "Node's test runner, against a fake native layer: no simulator needed"],
    [`nx typecheck ${name}`, 'TypeScript, without emitting'],
  ];
  const width = Math.max(...rows.map(([command]) => command.length)) + 2;
  return [
    '```sh',
    ...rows.map(([command, what]) => `${command.padEnd(width)}# ${what}`),
    '```',
    '',
    '`src/main.solid.ts` mounts the root component, `src/app/app.solid.tsx`. ' +
      `Run \`nx test ${name}\` and \`nx typecheck ${name}\` after a change; both are fast.`,
  ].join('\n');
}

/**
 * The workspace's custom conditions beside Expo's own, which only a workspace without a base to
 * take path aliases from needs: see `native.tsconfig`.
 */
function customConditions(tree, workspaces) {
  if (!workspaces || !tree.exists('tsconfig.base.json')) return [];
  const conditions = readJson(tree, 'tsconfig.base.json').compilerOptions?.customConditions ?? [];
  return conditions.filter((condition) => condition !== 'react-native');
}

/** The workspace's `tsconfig.base.json` relative to the app, where an integrated workspace has one. */
function workspaceBaseOf(tree, directory, workspaces) {
  return !workspaces && tree.exists('tsconfig.base.json')
    ? `${offsetFromRoot(directory)}tsconfig.base.json`
    : undefined;
}

function writeFiles(tree, { directory, projectName, workspaces }) {
  const file = (name, content) => tree.write(joinPathFragments(directory, name), content);
  for (const name of native.SOURCE_FILES) file(name, native.sourceFile(name));
  file('app.json', native.appJson(projectName));
  file('AGENTS.md', native.agentsFile(commands(projectName)));
  file('CLAUDE.md', '@AGENTS.md\n');
  file('metro.config.js', native.METRO_CONFIG);

  const workspaceBase = workspaceBaseOf(tree, directory, workspaces);
  const conditions = customConditions(tree, workspaces);
  file('tsconfig.json', JSON.stringify(native.tsconfig(workspaceBase, conditions), null, 2) + '\n');
  const register = native.testRegister(workspaceBase);
  if (register) file('test-register.mjs', register);

  const manifest = {
    name: projectName,
    version: '0.0.1',
    private: true,
    main: 'src/main.solid.ts',
  };
  if (workspaces) {
    Object.assign(manifest, {
      dependencies: native.dependencies,
      devDependencies: native.devDependencies,
    });
  } else {
    manifest.dependencies = native.prebuildPins(readJson(tree, 'package.json'));
  }
  file('package.json', JSON.stringify(manifest, null, 2) + '\n');
}

/** Expo's cache directory, once. */
function ignoreExpo(tree) {
  if (!tree.exists('.gitignore')) return;
  const ignore = tree.read('.gitignore', 'utf-8') ?? '';
  if (/^\.expo\/?$/m.test(ignore)) return;
  tree.write('.gitignore', ignore.replace(/\n*$/, '\n\n# Expo\n.expo/\n'));
}

/**
 * @param {import('@nx/devkit').Tree} tree
 * @param {{ directory: string, name?: string, tags?: string, skipInstall?: boolean, skipFormat?: boolean }} options
 */
async function application(tree, options) {
  const resolved = names(tree, options);
  const { directory, projectName, workspaces } = resolved;
  if (tree.exists(joinPathFragments(directory, 'package.json'))) {
    throw new Error(`${directory} already has a package.json. Choose another directory.`);
  }
  const initTask = await init(tree, { skipInstall: true, skipFormat: true });

  if (workspaces) {
    includeInWorkspaces(tree, directory);
  } else {
    for (const problem of native.conflicts(readJson(tree, 'package.json'))) logger.warn(problem);
    addDependenciesToPackageJson(
      tree,
      native.dependencies,
      native.devDependencies,
      'package.json',
      true,
    );
  }
  writeFiles(tree, resolved);
  addProjectConfiguration(tree, projectName, {
    root: directory,
    sourceRoot: directory,
    projectType: 'application',
    tags: (options.tags ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    targets: targets(
      directory,
      customConditions(tree, workspaces),
      workspaceBaseOf(tree, directory, workspaces),
    ),
  });

  ignoreExpo(tree);

  if (!options.skipFormat) await formatFiles(tree);
  logger.info(
    `Created ${directory}. nx start ${projectName} runs Metro; nx run ${projectName}:run-ios, ` +
      `nx test ${projectName}, nx typecheck ${projectName}, nx export ${projectName}.`,
  );
  if (options.skipInstall) return initTask;
  return runTasksInSerial(initTask, () => installPackagesTask(tree, true));
}

module.exports = { application };
