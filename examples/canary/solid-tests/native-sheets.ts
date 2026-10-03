import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compileCss } = require('@solid-native/metro/css/compile.cjs') as {
  compileCss(source: string, context: string, options: object): { rules: unknown[] };
};

/** Each screen's `.native.css` compiles on iOS and Android with rules, and no declaration dropped. */
export function assertNativeSheets(names: readonly string[]): void {
  for (const name of names) {
    const css = readFileSync(new URL(`../src/app/${name}.native.css`, import.meta.url), 'utf8');
    for (const platform of ['ios', 'android']) {
      // Without `onUnsupported`, a declaration native cannot express throws instead of dropping.
      const sheet = compileCss(css, name, { platform });
      assert.ok(sheet.rules.length > 0, `${platform} ${name}`);
    }
  }
}
