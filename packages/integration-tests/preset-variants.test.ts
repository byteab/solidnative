/**
 * The two presets, built by the real Tailwind CLI.
 *
 * `native.css` and `web.css` share `shared.css` and differ on four variants, and neither the
 * sharing nor the differing was covered by anything: `tailwind.test.ts` reads a checked-in fixture
 * of CLI output rather than invoking the CLI, so an `@import` that does not resolve, or a variant
 * that silently stops being redefined, would have compiled to nothing and failed no test.
 *
 * That matters more than usual here. A variant Tailwind does not know is a build error, but a
 * variant redefined *wrongly* is not: `hover:` pointing at a selector nothing ever matches emits
 * a rule that is simply never true, which is this project's most-repeated failure mode.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine, type StyleSheet } from '@solid-native/fabric';
import { createFakeFabric } from '@solid-native/testing';
import { build, committedProps } from './tailwind-cli.ts';

const CLASSES =
  '{hover:,press:,hovered:,focus-visible:,ios:,web:,native:,dark:}bg-red-500 pb-safe h-hairline font-mono';

describe('the two Tailwind presets', () => {
  let native = '';
  let web = '';

  before(() => {
    native = build('native', CLASSES);
    web = build('web', CLASSES);
  });

  /** The selectors one utility resolved to, as one string, so a test can say what is in them. */
  const selectorFor = (css: string, utility: string) => {
    // Tailwind escapes the colon in a class name with a single backslash: `.hover\:bg-red-500`.
    const escaped = `.${utility.replace(/:/g, '\\:')}`;
    return css.split('\n').find((line) => line.includes(escaped) && line.includes('{')) ?? '';
  };

  it('builds at all, which is what the shared import being resolvable means', () => {
    // An `@import './shared.css'` that does not resolve fails the CLI outright, so reaching here
    // with the shared utilities present is the assertion.
    assert.match(native, /--hairline/, 'the native build has the shared utilities');
    assert.match(web, /--hairline/, 'and so does the web one');
  });

  it('gives hover: a real hover on the web and not on a phone', () => {
    // The one that would be silently wrong rather than loud: on native `:hover` is a hard compile
    // error downstream, and on the web its absence is invisible until someone uses a mouse.
    assert.doesNotMatch(selectorFor(native, 'hover:bg-red-500'), /:hover/);
    assert.match(selectorFor(web, 'hover:bg-red-500'), /:hover/);

    // Both keep the press state, which is what makes one class string work on both.
    assert.match(selectorFor(native, 'hover:bg-red-500'), /:active/);
    assert.match(selectorFor(web, 'hover:bg-red-500'), /:active/);
  });

  it('points press: at the :active the engine tracks, not an attribute nothing sets', () => {
    // `data-press` came from a primitives library that no longer exists, so a variant that
    // matched only it compiled and never fired.
    for (const css of [native, web]) {
      assert.match(selectorFor(css, 'press:bg-red-500'), /:active/);
      assert.doesNotMatch(selectorFor(css, 'press:bg-red-500'), /data-press/);
      assert.doesNotMatch(selectorFor(css, 'hover:bg-red-500'), /data-press/);
    }

    // And the native compiler turns it into a rule the engine matches while a touch is down.
    const { compileSheetModule } = createRequire(import.meta.url)(
      '@solid-native/tailwind/config.cjs',
    ) as { compileSheetModule(css: string): string };
    const code = compileSheetModule(native);
    const sheet = JSON.parse(
      code.slice(code.indexOf('export default ') + 15, code.lastIndexOf(';')),
    );
    const rule = sheet.rules.find((r: { compounds: { classes: string[] }[] }) =>
      r.compounds.some((c) => c.classes.includes('press:bg-red-500')),
    );
    assert.deepEqual(rule?.compounds.at(-1).pseudo, ['active']);
  });

  it('tells focus-visible from focus on the web, and not on a phone', () => {
    // Native aliases the two because there is no clicking; a browser has mice, so the browser's
    // own heuristic is better than anything this could reimplement.
    assert.doesNotMatch(selectorFor(native, 'focus-visible:bg-red-500'), /:focus-visible/);
    assert.match(selectorFor(web, 'focus-visible:bg-red-500'), /:focus-visible/);
  });

  it('keeps the platform variants on both, so a shared class string is never an error', () => {
    // `ios:pt-2` on a web page is not a mistake, it is simply not an iPhone - so it has to
    // compile in both places and match in only one.
    for (const [name, css] of [
      ['native', native],
      ['web', web],
    ] as const) {
      assert.match(selectorFor(css, 'ios:bg-red-500'), /platform-ios/, `${name} keeps ios:`);
      assert.match(selectorFor(css, 'web:bg-red-500'), /platform-web/, `${name} keeps web:`);
    }
  });

  it('names a monospace font both platforms actually have', () => {
    /*
     * Tailwind's `--font-mono` is a stack beginning `ui-monospace`, and the native compiler takes
     * the first family from a stack because React Native's `fontFamily` is one name. So on a
     * device `font-mono` asked for a CSS generic keyword that exists on neither platform, and
     * every phone silently fell back to its system font.
     *
     * The floor has to be a font that is really there, because the platform rules only fire in an
     * app that puts `platform-ios` or `platform-android` on its root, and a rule that works only
     * when the app remembered something is the same silent failure in a new shape.
     */
    assert.match(native, /--font-mono:\s*['"]?Courier New/);
    assert.doesNotMatch(native, /--font-mono:\s*ui-monospace/);
    assert.match(native, /\.platform-ios \.font-mono/);
    assert.match(native, /\.platform-android \.font-mono/);

    // The web keeps Tailwind's own stack: a browser resolves `ui-monospace` perfectly well.
    assert.match(web, /--font-mono:\s*ui-monospace/);
  });

  it('wires the safe area to env() on the web, and leaves native to its own provider', () => {
    // The shared utilities read custom properties, which is the whole reason they can be shared:
    // each platform sets them from somewhere the other has never heard of.
    assert.match(web, /--safe-area-inset-top:\s*env\(safe-area-inset-top/);
    assert.doesNotMatch(native, /env\(safe-area-inset-top/);
  });

  it('makes a hairline one physical pixel on a dense display', () => {
    // A browser's 1px is one CSS pixel, so on a 2x screen the thinnest line a design can ask for
    // is drawn twice as thick as the native divider it is named after.
    assert.match(web, /min-resolution:\s*2dppx/);
    assert.match(web, /--hairline:\s*0\.5px/);
  });

  it('makes the peer-* variants match a later sibling, and reports the one that cannot', () => {
    // Tailwind 4 writes `peer-focus:x` as `.x:is(:is(:where(.peer):focus, ...) ~ *)`, a sibling
    // test inside `:is()`, and the compiler refused every one: "':is()' cannot contain a
    // combinator". None of them ever applied.
    const css = build(
      'native',
      'peer peer-focus:bg-red-500 peer-disabled:bg-green-500 peer-[.is-on]:bg-blue-500 ' +
        'peer-data-[state=on]:bg-yellow-500 peer-checked:bg-pink-500',
    );
    const { flattenTailwind } = createRequire(import.meta.url)('@solid-native/tailwind') as {
      flattenTailwind(css: string): string;
    };
    const { compileCss } = createRequire(import.meta.url)(
      '@solid-native/metro/css/compile.cjs',
    ) as {
      compileCss(css: string, context: string, options: object): StyleSheet;
    };
    const refused: string[] = [];
    const sheet = compileCss(flattenTailwind(css), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    // `:checked` has nothing to read on native, and says so at build time. None of them is
    // refused for a combinator.
    assert.ok(refused.some((message) => /':checked' has no state on native to read/.test(message)));
    assert.deepEqual(
      refused.filter((message) => /combinator/.test(message)),
      [],
      'no peer-* rule refused',
    );

    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: sheet });
    const row = engine.createElement('view');
    const peer = engine.createElement('view');
    const label = engine.createElement('view');
    engine.setClasses(peer, 'peer');
    engine.setClasses(
      label,
      'peer-focus:bg-red-500 peer-disabled:bg-green-500 peer-[.is-on]:bg-blue-500 ' +
        'peer-data-[state=on]:bg-yellow-500',
    );
    engine.appendChild(engine.root, row);
    engine.appendChild(row, peer);
    engine.appendChild(row, label);
    engine.commit();
    const background = () => committedProps(fabric, label)['backgroundColor'];
    const colour = (name: string) =>
      sheet.rules.find((rule) => rule.compounds.at(-1)!.classes.includes(name))!.declarations[
        'backgroundColor'
      ];
    assert.equal(background(), undefined, 'the peer is in no state yet');

    engine.dispatchEvent(peer, 'topFocus', {});
    assert.equal(background(), colour('peer-focus:bg-red-500'), 'peer-focus:');
    engine.dispatchEvent(peer, 'topBlur', {});

    engine.setProp(peer, 'data-disabled', '');
    engine.commit();
    assert.equal(background(), colour('peer-disabled:bg-green-500'), 'peer-disabled:');
    engine.setProp(peer, 'data-disabled', null);

    engine.setClasses(peer, 'peer is-on');
    engine.commit();
    assert.equal(background(), colour('peer-[.is-on]:bg-blue-500'), 'peer-[...]:');
    engine.setClasses(peer, 'peer');

    engine.setProp(peer, 'data-state', 'on');
    engine.commit();
    assert.equal(background(), colour('peer-data-[state=on]:bg-yellow-500'), 'peer-data-[...]:');
  });
});
