/**
 * The Metro transform chain over a Solid app: native stylesheets compiled for the platform being
 * bundled, author errors reported where they are, and a cache key that moves with the compiler.
 *
 * Source positions through the whole chain are pinned by `packages/metro/solid-transform.test.cjs`
 * ("actual Expo delegation retains authored TSX locations"), and the pass-through of sources that
 * are not Solid by "only explicit author JSX opts in" and "actual Expo receives untouched React
 * JSX", so they are not repeated here.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

const require = createRequire(import.meta.url);
const { transformNativeCss } = require('@solidnative/metro/solid-css.cjs') as {
  transformNativeCss(
    src: string,
    filename: string,
    options: { platform?: string; onUnsupported?: (message: string) => void },
  ): { code: string };
};

/** A path as a regular expression that matches it literally. */
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The stylesheet a `.native.css` module exports, and what the build warned while compiling it. */
function compile(src: string, filename: string, platform?: string) {
  const warnings: string[] = [];
  const { code } = transformNativeCss(src, filename, {
    platform,
    onUnsupported: (message) => void warnings.push(message),
  });
  return { code, warnings };
}

describe('the transform chain', () => {
  it('compiles a native stylesheet for the platform Metro is bundling', () => {
    // grayscale() is drawn on Android and ignored on iOS, so the same sheet keeps it for one and
    // drops it with a warning for the other; with no platform, as under a test, it has to suit
    // both.
    const src = '.a { opacity: 0.5; filter: grayscale(1) }';

    const android = compile(src, '/x/grey.native.css', 'android');
    assert.match(android.code, /"grayscale":1/);
    assert.deepEqual(android.warnings, []);

    for (const platform of ['ios', undefined]) {
      const { code, warnings } = compile(src, '/x/grey.native.css', platform);
      assert.doesNotMatch(code, /grayscale/);
      assert.match(code, /"opacity":0.5/, 'the rest of the rule still applies');
      assert.equal(warnings.length, 1);
      assert.match(
        warnings[0]!,
        /grey\.native\.css:1: dropped 'filter': filter: grayscale\(\) is not drawn on iOS/,
      );
    }
  });

  it('names a dropped declaration by the line of the file it is on', () => {
    const file = '/app/shared/lab.native.css';
    const { warnings } = compile(
      '.btn {\n  color: red;\n}\n.bad {\n  float: left;\n}\n',
      file,
      'ios',
    );
    assert.match(warnings.join('\n'), new RegExp(`${escape(file)}:4: dropped 'float'`));
  });

  it('exports an empty sheet, not a broken one, when nothing in it compiles', () => {
    const { code, warnings } = compile('.a { float: left; }', '/tmp/empty.native.css', 'ios');
    assert.equal(code, 'export default {"rules":[]};');
    assert.equal(warnings.length, 1);
  });
});

describe('a file that does not compile', () => {
  it('reports a syntax error in a Solid component at the line and column it is on', () => {
    const transformer = require('@solidnative/metro/solid-transformer.cjs') as {
      transform(params: object): unknown;
    };
    const src = [
      '/** @jsxImportSource @solidnative/platform/solid */',
      '',
      'export function Broken() {',
      '  const label = ;',
      '  return <text>{label}</text>;',
      '}',
      '',
    ].join('\n');

    assert.throws(
      () =>
        transformer.transform({
          filename: path.join(import.meta.dirname, 'broken.tsx'),
          src,
          options: { dev: false, platform: 'ios', projectRoot: import.meta.dirname },
          plugins: [],
        }),
      (error: Error & { loc?: { line: number; column: number } }) => {
        assert.deepEqual(
          { line: error.loc?.line, column: error.loc?.column },
          { line: 4, column: 16 },
        );
        // Nx forces colour on, and Babel's code frame is coloured when it is.
        const message = stripVTControlCharacters(error.message);
        assert.match(message, /broken\.tsx: Unexpected token \(4:16\)/);
        assert.match(message, />\s*4 \|\s+const label = ;/, 'with the line quoted');
        return true;
      },
    );
  });
});

describe("the transformer's cache key", () => {
  it("adds the compiler's own fingerprint to Expo's, so an edit to the compiler invalidates it", () => {
    const ours = require('@solidnative/metro/solid-transformer.cjs') as { getCacheKey(): string };
    const { solidCompilerFingerprint } = require('@solidnative/metro/solid-cache.cjs') as {
      solidCompilerFingerprint(): string;
    };
    const fromMetro = createRequire(require.resolve('@solidnative/metro/solid-transformer.cjs'));
    const expo = fromMetro('@expo/metro-config/build/babel-transformer') as {
      getCacheKey?(): string;
    };
    const theirs = expo.getCacheKey?.() ?? '';
    assert.ok(ours.getCacheKey().startsWith(theirs));
    assert.equal(ours.getCacheKey().slice(theirs.length), `:${solidCompilerFingerprint()}`);
    assert.match(solidCompilerFingerprint(), /^[0-9a-f]{20}$/);
  });
});
