/**
 * The package manager's workspaces, which decide where an app's dependencies go.
 *
 * An app outside every workspace glob is not a workspace package: pnpm installs nothing for it,
 * and its `metro.config.js` cannot find Expo. Nx's own TypeScript preset starts with `packages/*`
 * only, so an app in `apps/` is outside it until the glob is added.
 */
const { minimatch } = require('minimatch');
const { readJson, updateJson } = require('@nx/devkit');

const PNPM = 'pnpm-workspace.yaml';

/** The `packages:` list of a `pnpm-workspace.yaml`, as written: one quoted or bare glob a line. */
function pnpmGlobs(yaml) {
  const block = /^packages:[ \t]*\n((?:[ \t]+-.*\n?)*)/m.exec(yaml)?.[1] ?? '';
  return [...block.matchAll(/^[ \t]+-\s*['"]?([^'"\n#]+?)['"]?\s*(?:#.*)?$/gm)].map(
    (match) => match[1],
  );
}

function manifestGlobs(tree) {
  const { workspaces } = readJson(tree, 'package.json');
  return Array.isArray(workspaces) ? workspaces : (workspaces?.packages ?? []);
}

function globs(tree) {
  if (tree.exists(PNPM)) return pnpmGlobs(tree.read(PNPM, 'utf-8') ?? '');
  return manifestGlobs(tree);
}

/**
 * Whether the workspace has package-manager workspaces at all. A `pnpm-workspace.yaml` with no
 * `packages:` list does not: pnpm 11 writes one to hold settings alone, in an integrated
 * workspace like the `angular-monorepo` preset's.
 */
function usesWorkspaces(tree) {
  return globs(tree).length > 0;
}

/**
 * Adds `<parent>/*` for the app's directory when no glob already covers it.
 *
 * @param {import('@nx/devkit').Tree} tree
 * @param {string} directory
 */
function includeInWorkspaces(tree, directory) {
  // A negated glob excludes; it never makes a directory a workspace package.
  const including = globs(tree).filter((glob) => !glob.startsWith('!'));
  if (including.some((glob) => minimatch(directory, glob))) return;
  const parent = directory.includes('/') ? directory.slice(0, directory.lastIndexOf('/')) : '';
  const glob = parent ? `${parent}/*` : directory;

  if (tree.exists(PNPM)) {
    const yaml = tree.read(PNPM, 'utf-8') ?? '';
    const next = /^packages:[ \t]*$/m.test(yaml)
      ? yaml.replace(/^packages:[ \t]*$/m, `packages:\n  - '${glob}'`)
      : `packages:\n  - '${glob}'\n${yaml}`;
    tree.write(PNPM, next);
    return;
  }
  updateJson(tree, 'package.json', (manifest) => {
    if (Array.isArray(manifest.workspaces)) manifest.workspaces.push(glob);
    else manifest.workspaces.packages = [...(manifest.workspaces.packages ?? []), glob];
    return manifest;
  });
}

module.exports = { usesWorkspaces, includeInWorkspaces, pnpmGlobs };
