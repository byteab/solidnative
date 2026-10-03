/**
 * `position`, which accepted three values it cannot honour.
 *
 * `position` sits in the compiler's generic keyword list, and that list has no per-property notion
 * of which keywords are real - it takes any identifier and passes it through. Yoga implements
 * `relative`, `absolute` and `static` and nothing else, so `position: fixed` compiled cleanly,
 * committed the string `fixed` to the shadow node, and was ignored by the layout engine. A header
 * written that way simply scrolled away, with no warning anywhere to say why.
 *
 * `sticky` did fail, but by accident rather than by design: lightningcss parses it into a
 * structured value rather than a plain identifier, so the keyword extractor tripped over the shape
 * and reported "expected a keyword", which says nothing about what is wrong or what to do instead.
 *
 * A value this platform cannot express has to be refused where it is written, because there is no
 * console on a device to notice it later.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs');

/** The property as it reaches a node, or the message explaining why it did not. */
function compile(declaration: string): { value?: unknown; dropped?: string } {
  const dropped: string[] = [];
  const sheet = compileCss(`.x { ${declaration} }`, 'global', {
    onUnsupported: (message: string) => dropped.push(message),
  });
  if (dropped.length) return { dropped: dropped[0] };
  return { value: JSON.parse(JSON.stringify(sheet)).toString() };
}

describe('position', () => {
  for (const value of ['relative', 'absolute', 'static']) {
    it(`keeps ${value}, which Yoga implements`, () => {
      assert.equal(compile(`position: ${value}`).dropped, undefined);
    });
  }

  for (const value of ['fixed', 'sticky']) {
    it(`refuses ${value}, and says what to do instead`, () => {
      const { dropped } = compile(`position: ${value}`);
      assert.ok(dropped, `position: ${value} must not compile`);
      // The message has to name the value and the alternative. "expected a keyword" is neither.
      assert.match(dropped, new RegExp(value), 'the message names the value');
      assert.match(dropped, /absolute/, 'and points at what does work');
    });
  }
});
