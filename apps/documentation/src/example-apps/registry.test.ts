import { existsSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { describe, expect, test } from 'vitest';
import { highlightFile, sourceFiles } from '../../build/example-sources.ts';
import { EXAMPLE_APPS } from './registry.ts';

const documentation = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const workspace = path.resolve(documentation, '../..');

describe('the example apps', () => {
  test.each(EXAMPLE_APPS.map((app) => [app.slug, app] as const))(
    '%s is a folder in the repository, with its screenshots and its entry file',
    (slug, app) => {
      expect(app.sourceRoot).toBe(`examples/${slug}`);
      const root = path.join(workspace, app.sourceRoot);
      expect(existsSync(path.join(root, 'package.json'))).toBe(true);
      expect(sourceFiles(root).includes(app.entry)).toBe(true);
      expect(app.screenshots.length).toBeGreaterThan(0);
      for (const shot of app.screenshots) {
        expect(existsSync(path.join(documentation, 'public', shot.src)), shot.src).toBe(true);
      }
    },
  );

  test('the slugs are unique', () => {
    const slugs = EXAMPLE_APPS.map((app) => app.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('the canary is a test harness, not an example', () => {
    expect(EXAMPLE_APPS.some((app) => app.sourceRoot === 'examples/canary')).toBe(false);
  });

  test('every feature links to a docs page', () => {
    for (const feature of EXAMPLE_APPS.flatMap((app) => app.features)) {
      expect(feature.docs, feature.label).toMatch(/^\/(guide|packages)\//);
      const page = path.join(documentation, 'src/content', `${feature.docs}.md`);
      expect(existsSync(page), feature.docs).toBe(true);
    }
  });
});

describe('the code browser', () => {
  const wallet = path.join(workspace, 'examples/wallet');

  test("lists the wallet's own Solid files and nothing generated", () => {
    const files = sourceFiles(wallet);
    expect(files).toEqual(
      expect.arrayContaining([
        'src/app/app.solid.tsx',
        'src/app/home/home.solid.tsx',
        'src/app/send/send.solid.tsx',
        'src/app/send/send.native.css',
      ]),
    );
    // The older .ts sources still beside them are not the app the page describes.
    expect(files).not.toContain('src/app/home/home.ts');
    expect(files.some((file) => file.startsWith('node_modules/'))).toBe(false);
    expect(files.some((file) => file.startsWith('.'))).toBe(false);
    expect(files.some((file) => /^(ios|android)\//.test(file))).toBe(false);
    expect(files.some((file) => file.endsWith('.png'))).toBe(false);
  });

  test('highlights a file the way a docs code block is highlighted', async () => {
    const html = await highlightFile(wallet, 'src/app/home/home.solid.tsx');
    expect(html).toMatch(/^<pre class="shiki/);
    expect(html).toMatch(/--shiki-dark/);
    expect(html).toMatch(/Ada Lovelace/);
  });
});
