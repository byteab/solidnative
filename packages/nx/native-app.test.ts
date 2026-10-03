/**
 * The generated app is the template's app, apart from the three files Nx needs changed.
 *
 * `template/` is what this project verifies before every release, by publishing it and bundling an
 * app made from it. A file here that differs from the template's, or a version that does, is an
 * app nobody has verified.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const native = require('./native-app.cjs');

const template = path.resolve(import.meta.dirname, '../../template');
const manifest = JSON.parse(readFileSync(path.join(template, 'package.json'), 'utf8'));
const templateFile = (file: string) => readFileSync(path.join(template, file), 'utf8');

describe('the generated app', () => {
  for (const file of native.SOURCE_FILES) {
    it(`copies the template's ${file} as it is`, () => {
      assert.equal(native.sourceFile(file), templateFile(file));
    });
  }

  it('keeps nothing in files/ beyond the template copies and AGENTS.md', () => {
    // An app's test register is generated (`testRegister`), never copied: a stale copy here would
    // drift from `@solidnative/testing/register` unnoticed.
    const files = readdirSync(path.join(import.meta.dirname, 'files'), { recursive: true })
      .map(String)
      .filter((name) => /\.[a-z]+$/.test(name));
    assert.deepEqual(files.sort(), [...native.SOURCE_FILES, 'AGENTS.md'].sort());
  });

  it("gives the app the template's AGENTS.md, with its own commands in place of npm's", () => {
    const agents = native.agentsFile('COMMANDS');
    const theirs = readFileSync(path.join(template, 'AGENTS.md'), 'utf8');
    assert.equal(native.sourceFile('AGENTS.md'), theirs);
    const around = (text: string) => [
      text.slice(0, text.indexOf('## Commands')),
      text.slice(text.indexOf('## Rules')),
    ];
    assert.deepEqual(around(agents), around(theirs));
    assert.match(agents, /## Commands\n\nCOMMANDS\n\n## Rules/);
  });

  it("runs the template's test command as it is when there are no path aliases to resolve", () => {
    assert.equal(native.testRegister(undefined), undefined);
    assert.equal(native.testCommand(undefined), manifest.scripts.test);
  });

  it("resolves the workspace base's path aliases in a register of its own when there are", () => {
    const register = native.testRegister('../../tsconfig.base.json');
    assert.match(register, /^import '@solidnative\/testing\/register';$/m);
    assert.match(
      register,
      /const base = new URL\("\.\.\/\.\.\/tsconfig\.base\.json", import\.meta\.url\);/,
    );
    assert.match(register, /return nextResolve\(alias\(specifier\) \?\? specifier, context\);/);
    assert.equal(
      native.testCommand('../../tsconfig.base.json'),
      'node --import ./test-register.mjs --test "src/**/*.test.ts"',
    );
  });

  it("applies the template's Metro preset around withNxMetro, so it can wrap Nx's resolver", () => {
    assert.match(
      native.METRO_CONFIG,
      /module\.exports = withSolidNative\(withNxMetro\(getDefaultConfig\(__dirname\)\)\);/,
    );
    assert.match(
      templateFile('metro.config.js'),
      /withSolidNative\(getDefaultConfig\(__dirname\)\)/,
    );
  });

  it("runs the template's typecheck and test scripts", () => {
    assert.equal(native.COMMANDS.typecheck, manifest.scripts.typecheck);
    assert.equal(native.COMMANDS.test, manifest.scripts.test);
  });

  it("uses the template's tsconfig when there is no workspace base to extend", () => {
    assert.deepEqual(native.tsconfig(undefined), JSON.parse(templateFile('tsconfig.json')));
  });

  it("extends the workspace base after Expo's, and puts Expo's settings back", () => {
    const config = native.tsconfig('../../tsconfig.base.json');
    assert.deepEqual(config.extends, ['expo/tsconfig.base', '../../tsconfig.base.json']);
    assert.deepEqual(config.compilerOptions.lib, ['DOM', 'ESNext']);
    assert.equal(config.compilerOptions.allowImportingTsExtensions, true);
    assert.equal(config.compilerOptions.noEmit, true);
    assert.equal(config.compilerOptions.jsxImportSource, '@solidnative/platform/solid');
  });

  it("installs the template's dependencies, at the template's versions", () => {
    for (const field of ['dependencies', 'devDependencies'] as const) {
      assert.deepEqual(Object.keys(native[field]).sort(), Object.keys(manifest[field]).sort());
      for (const [name, range] of Object.entries(manifest[field])) {
        if (range !== 'workspace:*') assert.equal(native[field][name], range, name);
      }
    }
  });

  it('depends on Solid', () => {
    assert.equal(native.dependencies['solid-js'], '1.9.15');
  });

  it('pins the framework packages to its own version, since they are released together', () => {
    const { version } = require('./package.json');
    assert.equal(native.dependencies['@solidnative/components'], version);
    assert.equal(native.dependencies['@solidnative/platform'], version);
  });

  it("names app.json for the project without its scope, keeping the template's settings", () => {
    const { expo } = JSON.parse(native.appJson('@org/field-notes'));
    const theirs = JSON.parse(templateFile('app.json')).expo;
    assert.equal(expo.slug, 'field-notes');
    assert.equal(expo.scheme, 'fieldnotes');
    for (const key of ['orientation', 'userInterfaceStyle', 'version', 'platforms', 'extra']) {
      assert.deepEqual(expo[key], theirs[key], key);
    }
  });

  it('names the platforms, so the react-dom Nx installs does not add web to a bare nx export', () => {
    // Expo adds `web` whenever `react-dom` resolves, and @nx/expo's @nx/react dependency puts one at
    // the root. `nx export mobile` then stopped to ask for react-native-web.
    assert.deepEqual(JSON.parse(native.appJson('mobile')).expo.platforms, ['ios', 'android']);
  });
});

describe('conflicts', () => {
  it("says nothing about the workspace's own pins of the framework packages", () => {
    const workspace = { dependencies: { '@solidnative/platform': '0.0.1' } };
    assert.deepEqual(native.conflicts(workspace), []);
  });

  it('says nothing about ranges that can resolve to what the app needs', () => {
    assert.deepEqual(
      native.conflicts({
        dependencies: { 'react-native': '~0.86.0' },
        devDependencies: { typescript: '~6.0.2' },
      }),
      [],
    );
  });

  it('accepts the older Node types a workspace already pins', () => {
    assert.deepEqual(native.conflicts({ devDependencies: { '@types/node': '^22.10.0' } }), []);
  });

  it('names a range that cannot resolve to what the app needs', () => {
    const [problem] = native.conflicts({ devDependencies: { typescript: '^5.8.0' } });
    assert.match(problem, /typescript is \^5\.8\.0 here, and solidnative needs ~6\.0\.3/);
  });
});
