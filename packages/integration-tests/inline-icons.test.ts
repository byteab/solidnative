/**
 * `lucide-static`'s entry re-exports every icon it has - Metro resolves its `main`, one 900 KB
 * file of 1,900-odd SVG strings - and Metro keeps a module whole, so an app that imported three
 * icons shipped all of them: about a quarter of the canary's release bundle. The transformer
 * replaces a named import from the package with the strings it names, so the package never
 * enters the graph.
 *
 * That the Solid transformer runs this on every file is pinned by
 * `packages/metro/solid-transform.test.cjs` ("Solid transformer inlines named lucide-static
 * imports").
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { Flame } from 'lucide-static';

const require = createRequire(import.meta.url);
const { inlineIcons } = require('@solidnative/metro/inline-icons.cjs') as {
  inlineIcons(src: string, filename: string): string;
};

/** A file in this package, so the package resolves as it would from an app's own source. */
const here = fileURLToPath(new URL('./app.tsx', import.meta.url));

describe('inlining icons from lucide-static', () => {
  it('replaces a named import with the SVG strings it names, on the same line', () => {
    const src = "import {\n  Compass,\n  Target,\n} from 'lucide-static';\nexport const a = 1;\n";
    const out = inlineIcons(src, here);
    assert.doesNotMatch(out, /lucide-static/);
    assert.match(
      out,
      /^const Compass = "<svg class=\\"lucide lucide-compass\\"[^\n]*<\/svg>", Target = "<svg/,
    );
    assert.equal(out.split('\n').length, src.split('\n').length, 'line numbers are kept');
  });

  it('inlines the same markup the package exports', () => {
    const out = inlineIcons("import { Flame } from 'lucide-static';\n", here);
    const inlined = JSON.parse(/^const Flame = (".*");$/m.exec(out)![1]!) as string;
    assert.equal(inlined, Flame.replace(/\s*\n\s*/g, ' ').trim());
  });

  it('keeps an as rename, and reads an alias the package exports', () => {
    const src = "import { AlarmCheck as alarm } from 'lucide-static';\n";
    assert.match(
      inlineIcons(src, here),
      /^const alarm = "<svg class=\\"lucide lucide-alarm-clock-check\\"/,
    );
  });

  it('leaves the import alone when a name is not in the package, so the error is the real one', () => {
    const src = "import { Compass, NoSuchIcon } from 'lucide-static';\n";
    assert.equal(inlineIcons(src, here), src);
  });

  it('leaves a namespace import and a type import alone', () => {
    for (const src of [
      "import * as lucide from 'lucide-static';\n",
      "import type { Compass } from 'lucide-static';\n",
    ]) {
      assert.equal(inlineIcons(src, here), src);
    }
  });

  it('does nothing to a file that imports no icons', () => {
    const src = "import { createSignal } from 'solid-js';\n";
    assert.equal(inlineIcons(src, here), src);
  });
});
