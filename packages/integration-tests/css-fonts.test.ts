/**
 * Custom fonts, declared where they are used.
 *
 * A font on a phone is not a file the text engine fetches when it first needs it: it has to be
 * registered with the platform before any text is laid out, or the first paint is in the fallback
 * face and reflows when the real one arrives. So `@font-face` is a *build-time declaration* here -
 * the compiler collects the faces a sheet declares, the bundler turns each `url()` into an asset
 * the app already has, and the app registers them before it mounts.
 *
 * `font-family: Inter` in a rule then means what it says, with nothing else to wire up.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solidnative/metro/css/compile.cjs');
const { transformNativeCss } = require('@solidnative/metro/solid-css.cjs');

import { expoFonts, FontRegistry, loadFonts, registrationsFor } from '@solidnative/expo/fonts';

/** Fakes `require`, the same seam `optional()` reaches through on a device or in Node. */
function withExpoFont<T>(module: unknown | null, run: () => T): T {
  const host = globalThis as Record<string, unknown>;
  host['require'] = (id: string) => {
    if (id === 'expo-font' && module) return module;
    throw new Error(`Cannot find module '${id}'`);
  };
  try {
    return run();
  } finally {
    delete host['require'];
  }
}

const FACE = "@font-face { font-family: Inter; src: url('./Inter.ttf') }";

describe('declaring a face', () => {
  it('collects the family and the file it comes from', () => {
    assert.deepEqual(compileCss(FACE, 'test').fonts, [
      { family: 'Inter', source: { asset: './Inter.ttf' } },
    ]);
  });

  it('keeps a face that declares a weight or a style under its own name', () => {
    // Native matches a family by name and does no weight matching of its own, so each face is a
    // family. The weight is kept so the compiler can point a `font-weight` at the right one.
    const { fonts } = compileCss(
      "@font-face { font-family: Inter; src: url('./Inter-Bold.ttf'); font-weight: 700 }",
      'test',
    );
    assert.deepEqual(fonts, [
      { family: 'Inter', source: { asset: './Inter-Bold.ttf' }, weight: 700 },
    ]);
  });

  it('keeps the style of an italic face', () => {
    const { fonts } = compileCss(
      "@font-face { font-family: Inter; font-style: italic; src: url('./Inter-Italic.ttf') }",
      'test',
    );
    assert.deepEqual(fonts, [
      { family: 'Inter', source: { asset: './Inter-Italic.ttf' }, style: 'italic' },
    ]);
  });

  it('survives a sheet that declares faces and nothing else', () => {
    // A stylesheet of nothing but fonts is a perfectly ordinary thing to write, and the compiler
    // drops rules that do nothing - so this is exactly where a sheet could vanish silently.
    const sheet = compileCss(FACE, 'test');
    assert.equal(sheet.rules.length, 0);
    assert.equal(sheet.fonts.length, 1);
  });

  it('refuses a face with no family or no source, which could only fail at runtime', () => {
    assert.throws(() => compileCss("@font-face { src: url('./x.ttf') }", 'test'), /family/);
    assert.throws(() => compileCss('@font-face { font-family: Inter }', 'test'), /src/);
  });

  it('refuses a local() source, because there is nothing to bundle', () => {
    assert.throws(
      () => compileCss('@font-face { font-family: Inter; src: local(Inter) }', 'test'),
      /url\(\)/,
    );
  });
});

describe('reaching the app', () => {
  it('becomes a require, so the bundler ships the file', () => {
    // The sheet is emitted as a literal, and a font file is not a literal: it is a module the
    // bundler has to see to include in the bundle at all.
    const { code } = transformNativeCss(FACE, 'a.native.css', { platform: 'ios' });
    assert.match(code, /require\("\.\/Inter\.ttf"\)/);
    assert.doesNotMatch(code, /"asset"/, 'the marker does not survive into the bundle');
  });
});

describe('registering what a sheet declared', () => {
  it('registers a face under the family it named', async () => {
    const loaded: Record<string, unknown>[] = [];
    const fonts = new FontRegistry({
      loadAsync: async (map) => void loaded.push(map),
      isLoaded: () => false,
      getLoadedFonts: () => [],
    });

    await fonts.loadSheet({ fonts: [{ family: 'Inter', source: 42 }] });
    assert.deepEqual(loaded, [{ Inter: 42 }]);
  });

  it('registers a weighted face under a composed name too, because native does no matching', () => {
    // `font-family: Inter` finds exactly the family called Inter. A bold cut is a family of its
    // own on a device, so the sheet needs a name it can actually ask for.
    assert.deepEqual(
      registrationsFor([
        { family: 'Inter', source: 1 },
        { family: 'Inter', source: 2, weight: 700 },
      ]),
      { Inter: 1, 'Inter-700': 2 },
    );
  });

  it('registers an italic face under its style as well', () => {
    assert.deepEqual(
      registrationsFor([
        { family: 'Inter', source: 1 },
        { family: 'Inter', source: 3, style: 'italic' },
      ] as never),
      { Inter: 1, 'Inter-italic': 3 },
    );
  });

  it('lets the first face win the bare family name', () => {
    assert.deepEqual(
      registrationsFor([
        { family: 'Inter', source: 1, weight: 400 },
        { family: 'Inter', source: 2, weight: 700 },
      ]),
      { Inter: 1, 'Inter-400': 1, 'Inter-700': 2 },
    );
  });

  it('does nothing at all for a sheet with no faces, so bootstrap can always call it', async () => {
    let called = false;
    const fonts = new FontRegistry({
      loadAsync: async () => void (called = true),
      isLoaded: () => false,
      getLoadedFonts: () => [],
    });
    await fonts.loadSheet({}, null, undefined);
    assert.equal(called, false);
  });

  it('is inert rather than broken when expo-font is not installed', async () => {
    const fonts = new FontRegistry(null);
    assert.equal(fonts.available, false);
    assert.equal(fonts.has('Inter'), false);
    await fonts.loadSheet({ fonts: [{ family: 'Inter', source: 1 }] });
  });

  it('re-answers what is loaded once a face has been registered', async () => {
    // The platform's list is a plain array that changes underneath us. Read through a getter it
    // would render once, in the fallback face, and never again - which is the whole failure a
    // screen waiting on a font is trying to avoid.
    const registered = new Set<string>();
    const fonts = new FontRegistry({
      loadAsync: async (map) => void Object.keys(map).forEach((name) => registered.add(name)),
      isLoaded: (family) => registered.has(family),
      getLoadedFonts: () => [...registered],
    });

    assert.deepEqual(fonts.families(), []);
    assert.equal(fonts.has('Inter'), false);

    await fonts.loadSheet({ fonts: [{ family: 'Inter', source: 1 }] });

    assert.deepEqual(fonts.families(), ['Inter']);
    assert.equal(fonts.has('Inter'), true);
  });
});

describe('reaching expo-font itself', () => {
  it('loads through expo-font, and reports back what it says is loaded', async () => {
    const loaded: Record<string, unknown>[] = [];
    const registered = new Set<string>();
    const expoFont = {
      loadAsync: async (map: Record<string, unknown>) => {
        loaded.push(map);
        for (const name of Object.keys(map)) registered.add(name);
      },
      isLoaded: (family: string) => registered.has(family),
      getLoadedFonts: () => [...registered],
    };

    const native = withExpoFont(expoFont, () => expoFonts())!;
    assert.equal(native.isLoaded('Inter'), false);

    await native.loadAsync({ Inter: 1 });
    assert.deepEqual(loaded, [{ Inter: 1 }]);
    assert.equal(native.isLoaded('Inter'), true);
    assert.deepEqual(native.getLoadedFonts(), ['Inter']);
  });

  it('is null with no expo-font installed, so a web build importing this does not throw', () => {
    assert.equal(
      withExpoFont(null, () => expoFonts()),
      null,
    );
  });

  it('registers a sheet through the real expo-font seam before an app mounts', async () => {
    // `loadFonts` is the bootstrap call, made before there is an owner: it builds its own
    // `FontRegistry` around whatever `expoFonts()` finds, rather than reading one from DI.
    const loaded: Record<string, unknown>[] = [];
    const expoFont = {
      loadAsync: async (map: Record<string, unknown>) => void loaded.push(map),
      isLoaded: () => false,
      getLoadedFonts: () => [],
    };

    await withExpoFont(expoFont, () =>
      loadFonts({ fonts: [{ family: 'Inter', source: 1, weight: 700 }] }),
    );
    assert.deepEqual(loaded, [{ Inter: 1, 'Inter-700': 1 }]);
  });

  it('does nothing where expo-font is not installed, rather than throwing at bootstrap', async () => {
    await withExpoFont(null, () => loadFonts({ fonts: [{ family: 'Inter', source: 1 }] }));
  });
});
