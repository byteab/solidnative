/**
 * What the template tells a new app, checked against the packages it names.
 *
 * `AGENTS.md` is the first thing a coding agent reads in a new app, and it once named an import
 * from an entry that did not export it. And Expo printed "Using src/app as the root directory for
 * Expo Router." on every start of an app that has no Expo Router, because it guesses a router root
 * from the folder the template's app lives in.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const templatePath = (file: string) =>
  fileURLToPath(new URL(`../../template/${file}`, import.meta.url));
const template = (file: string) => readFileSync(templatePath(file), 'utf8');

describe('the template', () => {
  it('names only components its packages export, from the entry that exports them', async () => {
    const text = template('AGENTS.md');
    const listed = /imported from `(@solidnative\/[a-z/-]+)`: ((?:`\w+`,?\s*(?:and\s*)?)+)/.exec(
      text,
    );
    assert.ok(listed, 'AGENTS.md lists the native components and their entry');
    const components = [...listed[2]!.matchAll(/`(\w+)`/g)].map(([, name]) => name!);
    assert.ok(components.length >= 5, components.join(', '));
    const entry = (await import(listed[1]!)) as Record<string, unknown>;
    for (const name of components) {
      assert.equal(typeof entry[name], 'function', `${name} from ${listed[1]}`);
    }
  });

  it('names only exports its packages have, from the entry that exports them', async () => {
    // [name, entry, what it is]: a component or function, or an object such as `screen`.
    const claims: [name: string, entry: string, kind: 'function' | 'object'][] = [
      ['Show', '@solidnative/platform/solid', 'function'],
      ['For', '@solidnative/platform/solid', 'function'],
      ['Index', '@solidnative/platform/solid', 'function'],
      ['ErrorBoundary', '@solidnative/platform/solid', 'function'],
      ['withNativeStyles', '@solidnative/platform/solid', 'function'],
      ['createNativeNavigation', '@solidnative/router/solid', 'function'],
      ['NativeStackOutlet', '@solidnative/router/solid', 'function'],
      ['render', '@solidnative/testing', 'function'],
      ['screen', '@solidnative/testing', 'object'],
      ['userEvent', '@solidnative/testing', 'object'],
    ];
    const text = template('AGENTS.md');
    for (const [name, entry, kind] of claims) {
      assert.ok(text.includes(`\`${entry}\``), `AGENTS.md names ${entry}`);
      assert.match(text, new RegExp(`\`<?${name}\\b`), `AGENTS.md names ${name}`);
      const exported = (await import(entry)) as Record<string, unknown>;
      assert.equal(typeof exported[name], kind, `${name} from ${entry}`);
    }
  });

  it('sets the router root Expo would otherwise guess out loud', () => {
    const config = JSON.parse(template('app.json')) as {
      expo: { extra?: { router?: { root?: string } } };
    };
    assert.equal(config.expo.extra?.router?.root, 'src/app');
  });

  it('targets iOS and Android only, with nothing configured for a web build it cannot make', () => {
    const { expo } = JSON.parse(template('app.json')) as {
      expo: { platforms?: string[]; web?: unknown };
    };
    assert.deepEqual(expo.platforms, ['ios', 'android']);
    assert.equal(expo.web, undefined);
    assert.doesNotMatch(template('gitignore'), /web-build/);
    assert.equal(existsSync(templatePath('assets/favicon.png')), false);
  });
});
