/**
 * Tailwind 3, built by its real CLI and rendered by the engine.
 *
 * Tailwind 3 composes more across classes than 4 does. `.transform` reads `--tw-rotate`, which
 * `.rotate-45` sets; `.shadow` reads `--tw-ring-shadow`, which `.ring` sets; `.bg-blue-500` reads
 * `--tw-bg-opacity`, which `.bg-opacity-50` sets. Which of those a node has is a question only the
 * cascade can answer, so every test here renders a node and reads what it was committed with,
 * rather than inspecting the compiled sheet.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { Engine, type StyleSheet } from '@solid-native/fabric';
import { createFakeFabric } from '@solid-native/testing';
import { committedProps } from './tailwind-cli.ts';

const require = createRequire(import.meta.url);
const { flattenTailwind } = require('@solid-native/tailwind') as {
  flattenTailwind(css: string): string;
};
const { compileCss } = require('@solid-native/metro/css/compile.cjs') as {
  compileCss(css: string, context: string, options: object): StyleSheet;
};

/** Tailwind 3's CLI output for exactly these classes, through the preset as the setup guide says. */
function build(classes: string, app: object = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'tailwind-v3-'));
  const preset = require.resolve('@solid-native/tailwind/preset.cjs');
  const config = { ...app, content: [{ raw: classes }] };
  writeFileSync(
    join(dir, 'tailwind.config.js'),
    `module.exports = { presets: [require(${JSON.stringify(preset)})], ...${JSON.stringify(config)} };`,
  );
  writeFileSync(
    join(dir, 'in.css'),
    '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
  );
  try {
    execFileSync(
      process.execPath,
      [
        require.resolve('tailwindcss-v3/lib/cli.js'),
        '-c',
        'tailwind.config.js',
        '-i',
        'in.css',
        '-o',
        'out.css',
      ],
      { cwd: dir, stdio: 'pipe' },
    );
    return readFileSync(join(dir, 'out.css'), 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * One sheet built from every class a test mentions, so a rule can only be right if it ignores the
 * utilities a node does not wear. That is the failure this file exists for: `.translate-x-2`
 * picking up `.rotate-45`'s angle because both are in the sheet.
 */
function sheetFor(classes: string, app: object = {}): StyleSheet {
  return compileCss(flattenTailwind(build(classes, app)), 'tailwind', { onUnsupported: () => {} });
}

/** Renders a parent wearing `outer` around a child wearing `inner`, and returns both's props. */
function render(sheet: StyleSheet, outer: string, inner = '') {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1, { globalStyles: sheet });
  const parent = engine.createElement('view');
  const child = engine.createElement('view');
  engine.setClasses(parent, outer);
  engine.setClasses(child, inner);
  engine.appendChild(engine.root, parent);
  engine.appendChild(parent, child);
  engine.commit();
  return { parent: committedProps(fabric, parent), child: committedProps(fabric, child) };
}

/** A committed transform as one object, so a test can name the functions it cares about. */
function transformOf(props: Record<string, unknown>): Record<string, unknown> {
  return Object.assign({}, ...((props['transform'] as object[] | undefined) ?? []));
}

const TRANSFORMS = 'transform translate-x-2 rotate-45 scale-95';

describe('Tailwind 3', () => {
  it('moves a node by the translate it wears, and not by a rotate another class set', () => {
    const sheet = sheetFor(TRANSFORMS);
    const moved = transformOf(render(sheet, 'transform translate-x-2').parent);
    assert.equal(moved['translateX'], 8);
    assert.equal(moved['rotate'] ?? '0deg', '0deg', 'no rotate-45 on this node');
    assert.equal(moved['scaleX'] ?? 1, 1, 'no scale-95 on this node');
  });

  it('composes the transform utilities a node does wear', () => {
    const sheet = sheetFor(TRANSFORMS);
    const both = transformOf(render(sheet, 'transform translate-x-2 rotate-45').parent);
    assert.equal(both['translateX'], 8);
    assert.equal(both['rotate'], '45deg');
  });

  it('centres with a percentage translate, which the device cannot mix with a token', () => {
    // `-translate-x-1/2` is `-50%`, and the engine refuses a percentage beside a `var()` because
    // resolving it needs layout. Such a declaration is settled at build time instead.
    const sheet = sheetFor(`${TRANSFORMS} -translate-x-1/2 translate-y-2`);
    const centred = transformOf(render(sheet, 'transform -translate-x-1/2').parent);
    assert.equal(centred['translateX'], '-50%');
    assert.equal(centred['rotate'] ?? '0deg', '0deg');
  });

  it("does not hand a parent's rotate down to a child", () => {
    // Tailwind 3 resets every `--tw-*` on every element with `*`, which is what keeps a custom
    // property from inheriting here, where on the web it would.
    const sheet = sheetFor(TRANSFORMS);
    const { child } = render(sheet, 'transform rotate-45', 'transform translate-x-2');
    assert.equal(transformOf(child)['rotate'] ?? '0deg', '0deg');
  });

  it("draws both of a drop shadow's shadows on Android, and says iOS does not draw one", () => {
    // Tailwind 3 puts two `drop-shadow()`s in the one slot, which the compiler took for a single
    // function and dropped, leaving an empty filter.
    const refused: string[] = [];
    const sheet = compileCss(
      flattenTailwind(build('android:drop-shadow-md drop-shadow')),
      'tailwind',
      {
        onUnsupported: (message: string) => refused.push(message),
      },
    );
    const { child } = render(sheet, 'platform-android', 'android:drop-shadow-md');
    const filter = child['filter'] as { dropShadow: object }[];
    assert.equal(filter?.length, 2, JSON.stringify(filter));
    assert.ok(filter.every((one) => 'dropShadow' in one));
    assert.ok(
      refused.some((m) => /drop-shadow\(\) is not drawn on iOS/.test(m)),
      refused.join('\n'),
    );
  });

  it('filters by the filter utility a node wears, and not by one another class set', () => {
    // Filters are settled at build time, since the device refuses a filter list of tokens; a slot
    // the rule does not set has to come from the reset, not from the last utility in the file.
    const sheet = sheetFor('android:grayscale blur brightness-50');
    const { child } = render(sheet, 'platform-android', 'android:grayscale');
    assert.deepEqual(child['filter'], [{ grayscale: 1 }]);
  });

  it('paints a shadow without a ring, when another class in the sheet draws one', () => {
    const sheet = sheetFor('shadow ring ring-rose-500');
    const shadows = render(sheet, 'shadow').parent['boxShadow'] as { spreadDistance: number }[];
    assert.ok(shadows?.length, 'a shadow was painted');
    assert.ok(
      shadows.every((shadow) => shadow.spreadDistance <= 0),
      `no ring in ${JSON.stringify(shadows)}`,
    );
  });

  it('colours a shadow by the shadow colour it wears, and no other', () => {
    // `.shadow-orange-950` sets `--tw-shadow-color`, which `.shadow` reads inside
    // `--tw-shadow-colored`: settled at build time, every coloured shadow took the colour written
    // last in the file.
    const sheet = sheetFor('shadow shadow-orange-950 shadow-zinc-950');
    const colours = (classes: string) =>
      (render(sheet, classes).parent['boxShadow'] as { color: string }[]).map((s) => s.color);
    assert.deepEqual(colours('shadow shadow-orange-950'), ['rgb(67, 20, 7)', 'rgb(67, 20, 7)']);
    assert.deepEqual(colours('shadow'), ['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.1)']);
  });

  it('paints a ring in the colour and width the node asks for', () => {
    const sheet = sheetFor('ring ring-2 ring-rose-500 ring-blue-500');
    const shadows = render(sheet, 'ring-2 ring-rose-500').parent['boxShadow'] as {
      spreadDistance: number;
      color: string;
    }[];
    assert.ok(
      shadows?.some((s) => s.spreadDistance === 2 && s.color === 'rgb(244, 63, 94)'),
      JSON.stringify(shadows),
    );
  });

  it('keeps a colour solid unless an opacity utility says otherwise', () => {
    const sheet = sheetFor('bg-blue-500 bg-opacity-50');
    assert.equal(render(sheet, 'bg-blue-500').parent['backgroundColor'], 'rgb(59, 130, 246)');
    assert.equal(
      render(sheet, 'bg-blue-500 bg-opacity-50').parent['backgroundColor'],
      'rgba(59, 130, 246, 0.5)',
    );
  });

  it("fades an app's own hsl() and decimal rgb() colours by their opacity utilities", () => {
    // Tailwind 3 writes a theme colour in the space it was given: `hsl(210 40% 50% / var(...))`,
    // `rgb(10.5 20 30 / var(...))`. Only whole-number rgb() was turned into channels, so these kept
    // a token alpha inside a colour function, which the compiler refuses.
    const app = {
      theme: { extend: { colors: { hue: 'hsl(0 100% 50%)', dec: 'rgb(10.5 20 30)' } } },
    };
    const sheet = sheetFor('bg-hue bg-dec bg-opacity-50', app);
    assert.equal(render(sheet, 'bg-hue').parent['backgroundColor'], 'rgb(255, 0, 0)');
    assert.equal(
      render(sheet, 'bg-hue bg-opacity-50').parent['backgroundColor'],
      'rgba(255, 0, 0, 0.5)',
    );
    assert.equal(
      render(sheet, 'bg-dec bg-opacity-50').parent['backgroundColor'],
      'rgba(10.5, 20, 30, 0.5)',
    );
  });

  it('fades text, border and divider colours by their opacity utilities', () => {
    const sheet = sheetFor(
      'text-rose-500 text-opacity-50 border border-zinc-200 border-opacity-25 ' +
        'divide-y divide-zinc-200 divide-opacity-50 bg-blue-500/50',
    );
    assert.equal(
      render(sheet, 'text-rose-500 text-opacity-50').parent['color'],
      'rgba(244, 63, 94, 0.5)',
    );
    assert.equal(render(sheet, 'text-rose-500').parent['color'], 'rgb(244, 63, 94)');
    assert.equal(
      render(sheet, 'border border-zinc-200 border-opacity-25').parent['borderTopColor'],
      'rgba(228, 228, 231, 0.25)',
    );
    assert.equal(
      render(sheet, 'bg-blue-500/50').parent['backgroundColor'],
      'rgba(59, 130, 246, 0.5)',
    );

    // The divider is drawn on the second child, from the parent's classes.
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: sheet });
    const list = engine.createElement('view');
    const [first, second] = [engine.createElement('view'), engine.createElement('view')];
    engine.setClasses(list, 'divide-y divide-zinc-200 divide-opacity-50');
    engine.appendChild(engine.root, list);
    engine.appendChild(list, first);
    engine.appendChild(list, second);
    engine.commit();
    assert.equal(committedProps(fabric, first)['borderTopWidth'], undefined);
    assert.equal(committedProps(fabric, second)['borderTopWidth'], 1);
    assert.equal(committedProps(fabric, second)['borderTopColor'], 'rgba(228, 228, 231, 0.5)');
  });

  it('keeps a side colour to its side, beside a colour for all four', () => {
    // Both are faded by the same `--tw-border-opacity`, so each needs channels of its own: shared,
    // the side's colour painted all four sides.
    const sheet = sheetFor('border-2 border-red-500 border-t-blue-500 border-opacity-50');
    const { parent } = render(sheet, 'border-2 border-red-500 border-t-blue-500');
    assert.equal(parent['borderTopColor'], 'rgb(59, 130, 246)');
    assert.equal(parent['borderRightColor'], 'rgb(239, 68, 68)');
    assert.equal(parent['borderLeftColor'], 'rgb(239, 68, 68)');
  });

  it('spaces the children after the first', () => {
    const sheet = sheetFor('space-x-2 space-y-4');
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: sheet });
    const row = engine.createElement('view');
    const [first, second] = [engine.createElement('view'), engine.createElement('view')];
    engine.setClasses(row, 'space-x-2');
    engine.appendChild(engine.root, row);
    engine.appendChild(row, first);
    engine.appendChild(row, second);
    engine.commit();
    assert.equal(committedProps(fabric, first)['marginLeft'], undefined);
    assert.equal(committedProps(fabric, second)['marginLeft'], 8);
  });

  it('reads transform-gpu as the transform it is on native', () => {
    // `translate3d(x, y, 0)` is a hint to a browser's compositor; native has none to give it, and
    // the compiler refused the whole declaration.
    const refused: string[] = [];
    const sheet = compileCss(flattenTailwind(build('transform-gpu translate-x-2')), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.deepEqual(
      refused.filter((m) => /transform/.test(m)),
      [],
    );
    const gpu = sheet.rules.find((r) => r.compounds.at(-1)!.classes.includes('transform-gpu'));
    assert.ok(
      gpu?.deferred?.some((d) => d.props.includes('transform')),
      'transform-gpu compiled',
    );
  });

  it("says nothing about a browser's vendor-prefixed copy of a property", () => {
    // Tailwind 3 writes `-moz-column-gap` beside `column-gap`: the standard one is compiled, and a
    // warning for the copy is noise in every build.
    const refused: string[] = [];
    compileCss(flattenTailwind(build('gap-x-2 columns-2 object-cover')), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.deepEqual(
      refused.filter((m) => /-(moz|o|ms)-/.test(m)),
      [],
    );
  });

  it('keeps only the reset slots the device still reads', () => {
    // The `*` reset is matched on every element, so each slot in it is a token on every node. The
    // ones the build already settled are never read there, and cost a phone for nothing.
    const flat = flattenTailwind(build('transform rotate-45 translate-x-2 shadow ring-2'));
    const reset = /\*\s*\{([^}]*)\}/.exec(flat)?.[1] ?? '';
    assert.match(reset, /--tw-rotate:/, 'read on device by .transform');
    assert.match(reset, /--tw-ring-shadow:/, 'read on device by .shadow');
    assert.doesNotMatch(reset, /--tw-pan-x|--tw-ordinal|--tw-scroll-snap/, 'read by nothing here');
  });

  it("spaces a long list without walking each child's earlier siblings", () => {
    // Tailwind 3 writes `space-x-2` as `.space-x-2 > :not([hidden]) ~ :not([hidden])`: matched on
    // every element, and answered by walking back through every earlier sibling. Native has no
    // `hidden`, so it is "not the first child", which is answered at once.
    const flat = flattenTailwind(build('space-x-2 divide-y'));
    assert.doesNotMatch(flat, /~ :not\(\[hidden\]\)/);
    const sheet = compileCss(flat, 'tailwind', { onUnsupported: () => {} });
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: sheet });
    const list = engine.createElement('view');
    engine.setClasses(list, 'space-x-2');
    engine.appendChild(engine.root, list);
    const rows = Array.from({ length: 3000 }, () => engine.createElement('view'));
    for (const row of rows) engine.appendChild(list, row);
    const started = performance.now();
    engine.commit();
    const ms = performance.now() - started;
    assert.equal(committedProps(fabric, rows[0])['marginLeft'], undefined);
    assert.equal(committedProps(fabric, rows[2999])['marginLeft'], 8);
    assert.ok(ms < 1500, `3000 rows took ${Math.round(ms)}ms`);
  });

  it('turns by an angle, and drops a turn by a bare number or a percentage as a browser does', () => {
    // `rotate-[3]` is `rotate(3)`, which is no angle: a browser drops the whole transform, where
    // native read the number as degrees.
    const sheet = sheetFor('transform rotate-[3] rotate-[37%] rotate-[30deg] rotate-0');
    assert.equal(transformOf(render(sheet, 'transform rotate-[30deg]').parent)['rotate'], '30deg');
    assert.equal(render(sheet, 'transform rotate-[3]').parent['transform'], undefined);
    assert.equal(render(sheet, 'transform rotate-[37%]').parent['transform'], undefined);
    assert.equal(transformOf(render(sheet, 'transform rotate-0').parent)['rotate'], '0deg');
    // A zero percentage is still no angle: `rotate(0%)` is dropped as `rotate(3)` is.
    const zero = sheetFor('transform rotate-[0%]');
    assert.equal(render(zero, 'transform rotate-[0%]').parent['transform'], undefined);
  });

  it('refuses a skew where Android could apply it, and nothing else in the transform', () => {
    // Android draws no skew. Every Tailwind 3 transform reads the skew slots, set to 0 by the
    // reset, so only a rule that sets one to something else is refused.
    const refused: string[] = [];
    const sheet = compileCss(
      flattenTailwind(build('transform rotate-45 skew-x-12 ios:skew-x-12')),
      'tailwind',
      { onUnsupported: (message: string) => refused.push(message) },
    );
    assert.equal(
      refused.filter((m) => /skewX\(\) is not drawn on Android/.test(m)).length,
      1,
      refused.join('\n'),
    );
    assert.equal(transformOf(render(sheet, 'transform rotate-45').parent)['rotate'], '45deg');
    const skewed = transformOf(render(sheet, 'platform-ios', 'transform ios:skew-x-12').child);
    assert.equal(skewed['skewX'], '12deg');
  });

  it('refuses a skew for Android by its fallback, when the token it names is unset', () => {
    const refused: string[] = [];
    compileCss('.a { transform: skewX(var(--skew, 12deg)) }', 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.ok(
      refused.some((m) => /skewX\(\) is not drawn on Android/.test(m)),
      refused.join('\n'),
    );
  });

  it('takes arbitrary values', () => {
    const sheet = sheetFor('bg-[#123456] w-[37px] transform translate-x-[10px] rotate-45');
    const { parent } = render(sheet, 'bg-[#123456] w-[37px] transform translate-x-[10px]');
    assert.equal(parent['backgroundColor'], 'rgb(18, 52, 86)');
    assert.equal(parent['width'], 37);
    assert.equal(transformOf(parent)['translateX'], 10);
    assert.equal(transformOf(parent)['rotate'] ?? '0deg', '0deg');
  });

  it('fades a ring by ring-opacity', () => {
    const sheet = sheetFor('ring-2 ring-blue-500 ring-opacity-50 ring-rose-500');
    const shadows = render(sheet, 'ring-2 ring-blue-500 ring-opacity-50').parent['boxShadow'] as {
      spreadDistance: number;
      color: string;
    }[];
    assert.ok(
      shadows?.some((s) => s.spreadDistance === 2 && s.color === 'rgba(59, 130, 246, 0.5)'),
      JSON.stringify(shadows),
    );
    const solid = render(sheet, 'ring-2 ring-blue-500').parent['boxShadow'] as { color: string }[];
    assert.ok(
      solid?.some((s) => s.color === 'rgb(59, 130, 246)'),
      JSON.stringify(solid),
    );
  });

  it("draws a ring in Tailwind's default colour, and inset when asked", () => {
    const sheet = sheetFor('ring ring-inset ring-rose-500');
    const plain = render(sheet, 'ring').parent['boxShadow'] as {
      spreadDistance: number;
      color: string;
      inset: boolean;
    }[];
    assert.ok(
      plain.some(
        (s) => s.spreadDistance === 3 && s.color === 'rgba(59, 130, 246, 0.5)' && !s.inset,
      ),
      JSON.stringify(plain),
    );
    const inset = render(sheet, 'ring ring-inset').parent['boxShadow'] as {
      spreadDistance: number;
      inset: boolean;
    }[];
    // Behind a variant too: the ring's shadow reads the slot on device.
    const focusSheet = sheetFor('ring-2 focus:ring-inset');
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: focusSheet });
    const node = engine.createElement('view');
    engine.setClasses(node, 'ring-2 focus:ring-inset');
    engine.setProp(node, 'data-focus', '');
    engine.appendChild(engine.root, node);
    engine.commit();
    const focused = committedProps(fabric, node)['boxShadow'] as { inset: boolean }[];
    assert.ok(
      focused?.every((s) => s.inset),
      JSON.stringify(focused),
    );
    assert.ok(
      inset.some((s) => s.spreadDistance === 3 && s.inset),
      JSON.stringify(inset),
    );
  });

  it('paints a gradient from its from-, via- and to- classes', () => {
    const sheet = sheetFor('bg-gradient-to-r from-rose-500 via-white to-blue-500');
    const stops = (classes: string) =>
      (
        render(sheet, classes).parent['experimental_backgroundImage'] as {
          direction: unknown;
          colorStops: unknown[];
        }[]
      )?.[0];
    const rose = 'rgb(244, 63, 94)';
    const blue = 'rgb(59, 130, 246)';
    assert.deepEqual(stops('bg-gradient-to-r from-rose-500 to-blue-500'), {
      type: 'linear-gradient',
      direction: { type: 'angle', value: 90 },
      colorStops: [
        { color: rose, position: '0%' },
        { color: blue, position: '100%' },
      ],
    });
    assert.deepEqual(stops('bg-gradient-to-r from-rose-500 via-white to-blue-500')?.colorStops, [
      { color: rose, position: '0%' },
      { color: 'rgb(255, 255, 255)', position: '50%' },
      { color: blue, position: '100%' },
    ]);
  });
});

describe('the Tailwind 3 preset', () => {
  // Tailwind 3 reads no brace expansion in raw content, so each variant is written out.
  const VARIANTS = 'hover press hovered focus focus-visible disabled ios android web native dark';
  const PRESET =
    VARIANTS.split(' ')
      .map((variant) => `${variant}:bg-red-500`)
      .join(' ') +
    ' p-safe pb-safe pb-safe-4 min-pb-safe-4 mt-safe h-hairline border-b-hairline font-mono';
  let css = '';
  const selectorFor = (utility: string) => {
    const escaped = `.${utility.replace(/:/g, '\\:')}`;
    return css
      .split('\n')
      .filter((line) => line.includes(escaped) && line.includes('{'))
      .join(' ');
  };
  const declarationsOf = (utility: string) => {
    const at = css.indexOf(`\n.${utility} {`);
    return at === -1 ? '' : css.slice(at, css.indexOf('}', at));
  };

  before(() => {
    css = build(PRESET);
  });

  it('builds, and leaves preflight out', () => {
    assert.doesNotMatch(css, /box-sizing: border-box/, 'no preflight');
  });

  it('gives hover: the press state, and a real hover where there is a pointer', () => {
    assert.match(selectorFor('hover:bg-red-500'), /:active/);
    assert.match(selectorFor('hover:bg-red-500'), /\[data-hover\]/);
    assert.doesNotMatch(selectorFor('hover:bg-red-500'), /:hover/);
    assert.match(selectorFor('press:bg-red-500'), /:active/);
    assert.match(selectorFor('hovered:bg-red-500'), /\[data-hover\]/);
  });

  it('makes focus-visible: focus, and both follow data-focus', () => {
    for (const variant of ['focus', 'focus-visible']) {
      assert.match(selectorFor(`${variant}:bg-red-500`), /:focus\b/);
      assert.match(selectorFor(`${variant}:bg-red-500`), /\[data-focus\]/);
      assert.doesNotMatch(selectorFor(`${variant}:bg-red-500`), /:focus-visible/);
    }
  });

  it('follows data-disabled for disabled:', () => {
    assert.match(selectorFor('disabled:bg-red-500'), /\[data-disabled\]/);
  });

  it('matches the platform and dark variants against a class on an ancestor', () => {
    const sheet = compileCss(flattenTailwind(css), 'tailwind', { onUnsupported: () => {} });
    const red = 'rgb(239, 68, 68)';
    const on = (root: string, classes: string) =>
      render(sheet, root, classes).child['backgroundColor'];
    assert.equal(on('platform-ios', 'ios:bg-red-500'), red);
    assert.equal(on('platform-android', 'ios:bg-red-500'), undefined);
    assert.equal(on('platform-android', 'android:bg-red-500'), red);
    assert.equal(on('platform-android', 'native:bg-red-500'), red);
    assert.equal(on('platform-web', 'web:bg-red-500'), red);
    assert.equal(on('dark', 'dark:bg-red-500'), red);
    assert.equal(on('', 'dark:bg-red-500'), undefined);
  });

  it('gives group- and peer- variants the same touch meanings, rendered', () => {
    // Tailwind 3 builds `group-hover:` and `peer-hover:` from `:hover` itself, not from the
    // `hover` variant this preset redefines, so without their own definitions they compiled to a
    // selector the engine refuses.
    const classes =
      'group peer group-hover:bg-red-500 group-focus:bg-green-500 group-focus-visible:bg-blue-500 ' +
      'peer-hover:bg-red-500 peer-focus:bg-green-500 group-disabled:bg-amber-500 peer-disabled:bg-amber-500';
    const built = build(classes);
    for (const variant of ['group-hover', 'peer-hover']) {
      const line = built.split('\n').find((l) => l.includes(`${variant}\\:bg-red-500`)) ?? '';
      assert.match(line, /:active/, variant);
      assert.doesNotMatch(line, /:hover/, variant);
    }
    const refused: string[] = [];
    const sheet = compileCss(flattenTailwind(built), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.deepEqual(
      refused.filter((m) => !m.includes("dropped '--")),
      [],
    );

    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { globalStyles: sheet });
    const group = engine.createElement('view');
    const inGroup = engine.createElement('view');
    const peer = engine.createElement('view');
    const afterPeer = engine.createElement('view');
    engine.setClasses(group, 'group');
    engine.setClasses(
      inGroup,
      'group-hover:bg-red-500 group-focus:bg-green-500 group-disabled:bg-amber-500',
    );
    engine.setClasses(peer, 'peer');
    engine.setClasses(
      afterPeer,
      'peer-hover:bg-red-500 peer-focus:bg-green-500 peer-disabled:bg-amber-500',
    );
    engine.appendChild(engine.root, group);
    engine.appendChild(group, inGroup);
    engine.appendChild(engine.root, peer);
    engine.appendChild(engine.root, afterPeer);
    engine.commit();
    const bg = (node: unknown) => committedProps(fabric, node)['backgroundColor'];
    assert.equal(bg(inGroup), undefined);
    assert.equal(bg(afterPeer), undefined);

    engine.setProp(group, 'data-hover', '');
    engine.setProp(peer, 'data-hover', '');
    engine.commit();
    assert.equal(bg(inGroup), 'rgb(239, 68, 68)', 'group-hover:');
    assert.equal(bg(afterPeer), 'rgb(239, 68, 68)', 'peer-hover:');
    engine.setProp(group, 'data-hover', null);
    engine.setProp(peer, 'data-hover', null);

    engine.setProp(group, 'data-focus', '');
    engine.setProp(peer, 'data-focus', '');
    engine.commit();
    assert.equal(bg(inGroup), 'rgb(34, 197, 94)', 'group-focus:');
    assert.equal(bg(afterPeer), 'rgb(34, 197, 94)', 'peer-focus:');
    engine.setProp(group, 'data-focus', null);
    engine.setProp(peer, 'data-focus', null);

    engine.setProp(group, 'data-disabled', '');
    engine.setProp(peer, 'data-disabled', '');
    engine.commit();
    assert.equal(bg(inGroup), 'rgb(245, 158, 11)', 'group-disabled:');
    assert.equal(bg(afterPeer), 'rgb(245, 158, 11)', 'peer-disabled:');
  });

  it('keeps a stacked platform, dark and state variant', () => {
    const classes =
      'dark:ios:bg-red-500 ios:dark:bg-green-500 ios:hover:bg-blue-500 dark:hover:bg-amber-500';
    const refused: string[] = [];
    const sheet = compileCss(flattenTailwind(build(classes)), 'tailwind', {
      onUnsupported: (message: string) => refused.push(message),
    });
    assert.deepEqual(
      refused.filter((m) => !m.includes("dropped '--")),
      [],
    );
    const on = (root: string, cls: string, hover = false) => {
      const fabric = createFakeFabric();
      const engine = new Engine(fabric, 1, { globalStyles: sheet });
      const parent = engine.createElement('view');
      const child = engine.createElement('view');
      engine.setClasses(parent, root);
      engine.setClasses(child, cls);
      if (hover) engine.setProp(child, 'data-hover', '');
      engine.appendChild(engine.root, parent);
      engine.appendChild(parent, child);
      engine.commit();
      return committedProps(fabric, child)['backgroundColor'];
    };
    assert.equal(on('platform-ios dark', 'dark:ios:bg-red-500'), 'rgb(239, 68, 68)');
    assert.equal(on('platform-ios', 'dark:ios:bg-red-500'), undefined);
    assert.equal(on('platform-ios dark', 'ios:dark:bg-green-500'), 'rgb(34, 197, 94)');
    assert.equal(on('platform-ios', 'ios:hover:bg-blue-500', true), 'rgb(59, 130, 246)');
    assert.equal(on('platform-android', 'ios:hover:bg-blue-500', true), undefined);
    assert.equal(on('dark', 'dark:hover:bg-amber-500', true), 'rgb(245, 158, 11)');
  });

  it('reads the safe area from the tokens the device supplies', () => {
    assert.match(declarationsOf('pb-safe'), /padding-bottom: var\(--safe-area-inset-bottom, 0px\)/);
    assert.match(declarationsOf('mt-safe'), /margin-top: var\(--safe-area-inset-top, 0px\)/);
    assert.match(declarationsOf('p-safe'), /padding-left: var\(--safe-area-inset-left, 0px\)/);
    assert.match(
      declarationsOf('pb-safe-4'),
      /padding-bottom: calc\(var\(--safe-area-inset-bottom, 0px\) \+ 1rem\)/,
    );
    assert.match(
      declarationsOf('min-pb-safe-4'),
      /padding-bottom: max\(var\(--safe-area-inset-bottom, 0px\), 1rem\)/,
    );
  });

  it('takes only a length after the safe area', () => {
    // A bare number is dropped by a browser, `calc(inset + 3)` being no length, where native would
    // read it as points.
    const built = build('pt-safe-[13px] pt-safe-[3] min-pb-safe-[0.35] mb-safe-[1.25rem]');
    assert.match(built, /pt-safe-\\\[13px\\\]/);
    assert.match(built, /mb-safe-\\\[1\\\.25rem\\\]/);
    assert.doesNotMatch(built, /pt-safe-\\\[3\\\]/);
    assert.doesNotMatch(built, /min-pb-safe-\\\[0\\\.35\\\]/);
  });

  it('draws a hairline from the device token', () => {
    assert.match(declarationsOf('h-hairline'), /height: var\(--hairline, 1px\)/);
    assert.match(
      declarationsOf('border-b-hairline'),
      /border-bottom-width: var\(--hairline, 1px\)/,
    );
  });

  it("keeps each platform's monospace font in an app that makes every utility important", () => {
    // With `important: true`, `.font-mono` is `Courier New !important`, which beat the platform
    // rules' plain Menlo and monospace on every phone.
    const sheet = sheetFor('font-mono', { important: true });
    const font = (platform: string) => render(sheet, platform, 'font-mono').child['fontFamily'];
    assert.equal(font('platform-ios'), 'Menlo');
    assert.equal(font('platform-android'), 'monospace');
    assert.equal(font(''), 'Courier New');
  });

  it('names a monospace font both platforms have', () => {
    assert.match(declarationsOf('font-mono'), /font-family: Courier New/);
    assert.match(css, /\.platform-ios \.font-mono\s*\{\s*font-family: Menlo/);
    assert.match(css, /\.platform-android \.font-mono\s*\{\s*font-family: monospace/);
  });
});
