/**
 * `nx add @solidnative/nx`: `@nx/expo` at the workspace's Nx version, and its plugin registered.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import type { Tree } from '@nx/devkit';

const require = createRequire(import.meta.url);
const { createTreeWithEmptyWorkspace } = require('@nx/devkit/testing') as {
  createTreeWithEmptyWorkspace: () => Tree;
};
const { readJson, readNxJson, updateJson, updateNxJson } =
  require('@nx/devkit') as typeof import('@nx/devkit');
const { init, EXPO_PLUGIN } = require('./index.cjs');

function workspace(nx = '23.2.0') {
  const tree = createTreeWithEmptyWorkspace();
  updateJson(tree, 'package.json', (manifest) => ({ ...manifest, devDependencies: { nx } }));
  return tree;
}

describe('init', () => {
  it("adds @nx/expo at the workspace's own Nx version", async () => {
    const tree = workspace('23.1.4');
    await init(tree, { skipFormat: true });
    assert.equal(readJson(tree, 'package.json').devDependencies['@nx/expo'], '23.1.4');
  });

  it("adds @nx/expo, and react-dom and the Expo CLI at the app's versions rather than init's", async () => {
    const tree = workspace();
    await init(tree, { skipFormat: true });
    const manifest = readJson(tree, 'package.json');
    assert.deepEqual(Object.keys(manifest.devDependencies).sort(), [
      '@babel/runtime',
      '@expo/cli',
      '@nx/expo',
      'nx',
      'react-dom',
    ]);
    assert.equal(manifest.devDependencies['react-dom'], '19.2.3');
    assert.match(manifest.devDependencies['@expo/cli'], /^\^57\./);
    assert.deepEqual(manifest.dependencies, {});
  });

  it("puts Babel 7's runtime at the root, where Expo's Babel preset imports it from", async () => {
    // @angular-devkit/build-angular hoists Babel 8's runtime there, which has no `regenerator`, and
    // every `nx start` warned that Metro had to fall back to file-based resolution to find it.
    const tree = workspace();
    await init(tree, { skipFormat: true });
    assert.match(readJson(tree, 'package.json').devDependencies['@babel/runtime'], /^\^7\./);
  });

  it("registers @nx/expo's plugin, with the target names Nx documents", async () => {
    const tree = workspace();
    await init(tree, { skipFormat: true });
    const plugin = readNxJson(tree)?.plugins?.find(
      (entry) => typeof entry !== 'string' && entry.plugin === '@nx/expo/plugin',
    );
    assert.deepEqual(plugin, EXPO_PLUGIN);
  });

  it('leaves a plugin entry and an @nx/expo that are already there alone', async () => {
    const tree = workspace();
    updateNxJson(tree, { ...readNxJson(tree), plugins: ['@nx/expo/plugin'] });
    updateJson(tree, 'package.json', (manifest) => {
      manifest.devDependencies['@nx/expo'] = '23.0.0';
      return manifest;
    });
    await init(tree, { skipFormat: true });
    assert.deepEqual(readNxJson(tree)?.plugins, ['@nx/expo/plugin']);
    assert.equal(readJson(tree, 'package.json').devDependencies['@nx/expo'], '23.0.0');
  });

  it('returns a task that installs, unless asked not to', async () => {
    assert.equal(typeof (await init(workspace(), { skipFormat: true })), 'function');
    const skipped = await init(workspace(), { skipFormat: true, skipInstall: true });
    assert.equal(skipped(), undefined);
  });
});
