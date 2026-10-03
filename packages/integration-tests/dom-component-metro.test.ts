/**
 * The build half of a Solid DOM component: a browser Solid page compiled by the same Metro that
 * builds the app, and shipped the way Expo ships its own DOM components.
 *
 * A DOM component is a file that starts with `'use dom'` and mounts through
 * `@solidnative/web/solid/web-view`. Imported from native code it is not compiled at all: it becomes
 * a reference to its page, carrying the same metadata Expo's `'use dom'` plugin records, so Expo's
 * dev server serves the page and `expo export:embed` writes it into the app for a release build.
 *
 * The lowering itself, the web compile and the worker's entry swap are pinned by
 * `packages/metro/solid-dom.test.cjs`; this file adds the exact page names, the recognition edge
 * cases and what the page's entry does with an early error when it runs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { isSolidDomComponent, solidDomPage, domComponentReference } =
  require('@solidnative/metro/solid-dom.cjs') as {
    isSolidDomComponent(source: string): boolean;
    solidDomPage(filename: string, options: object): Buffer | null;
    domComponentReference(
      filename: string,
      options: { dev: boolean },
    ): {
      code: string;
      reference: string;
    };
  };

const mounts =
  "\nimport { mountInWebView } from '@solidnative/web/solid/web-view';\n" +
  'export default mountInWebView(() => null);';

const WEB_COMPONENT = `'use dom';${mounts}\n`;

describe("recognising a Solid DOM component: 'use dom' and the Solid web-view mount", () => {
  it('reads past comments to the first statement', () => {
    assert.equal(isSolidDomComponent("// note\n/* more */\n'use dom';" + mounts), true);
    assert.equal(isSolidDomComponent('"use dom";' + mounts), true);
    assert.equal(
      isSolidDomComponent("import x from 'y';\n'use dom';" + mounts),
      false,
      'first only',
    );
  });

  // D040 made the root `./web-view` the Solid entry: a page written against it must become a page
  // too, not be compiled as native Solid.
  it('recognises the root `@solidnative/web/web-view` alias too', () => {
    assert.equal(isSolidDomComponent(mounts.replace('/solid/web-view', '/web-view')), false);
    assert.equal(
      isSolidDomComponent("'use dom';" + mounts.replace('/solid/web-view', '/web-view')),
      true,
    );
  });

  it("leaves Expo's own React DOM components to Expo", () => {
    // The same directive: what makes a file ours is that the Solid web view mounts it.
    assert.equal(isSolidDomComponent("'use dom';\nexport default function Chart() {}"), false);
    assert.equal(isSolidDomComponent("'use client';" + mounts), false);
  });

  it('answers at once for an ordinary file, however it starts', () => {
    // Every file in the app is asked. A backtracking pattern once hung the bundler on these.
    const started = performance.now();
    isSolidDomComponent(' \n'.repeat(50_000) + 'export const a = 1;');
    isSolidDomComponent('/**\n' + ' * line\n'.repeat(50_000) + ' */\nexport const a = 1;');
    isSolidDomComponent('/* never closed ' + ' '.repeat(50_000));
    assert.ok(performance.now() - started < 200, 'linear, not exponential');
  });
});

describe('a DOM component imported from native code', () => {
  const filename = '/repo/app/web/note.dom.tsx';
  const reference = pathToFileURL(filename).href;

  it("names the page as Expo's dev server serves a DOM component's", () => {
    const { code } = domComponentReference(filename, { dev: true });
    assert.equal(
      code,
      'export default { domComponent: "note.dom.tsx?file=file:///repo/app/web/note.dom.tsx" };\n',
    );
  });

  it('names it as `expo export:embed` writes it into a release build', () => {
    const md5 = createHash('md5').update(reference).digest('hex');
    assert.match(
      domComponentReference(filename, { dev: false }).code,
      new RegExp(`"${md5}\\.html"`),
    );
  });

  it("records the file the way Expo's 'use dom' plugin does, which is how the export finds it", () => {
    assert.equal(domComponentReference(filename, { dev: false }).reference, reference);
  });
});

describe("the page's entry", () => {
  /** The page bootstrap our worker puts in place of Expo's React entry. */
  function page() {
    const root = mkdtempSync(path.join(tmpdir(), 'solid-native-web-entry-'));
    const entry = path.join(root, 'node_modules/expo/dom/entry.js');
    mkdirSync(path.dirname(entry), { recursive: true });
    writeFileSync(path.join(root, 'note.dom.tsx'), WEB_COMPONENT);
    const data = solidDomPage(entry, {
      platform: 'web',
      customTransformOptions: { dom: encodeURI('../../../note.dom.tsx') },
    });
    rmSync(root, { recursive: true, force: true });
    assert.ok(data);
    return data.toString();
  }

  it('reports an error thrown before Solid is up, which nothing else would catch', () => {
    // A failed import or a module that throws as it loads never reaches the page's own error
    // handling, and a web view's own console is in Safari's inspector: the page has to pass it on
    // itself.
    const posted: string[] = [];
    const listeners: Record<string, ((event: unknown) => void) | undefined> = {};
    const window: Record<string, unknown> = {
      ReactNativeWebView: { postMessage: (data: string) => posted.push(data) },
      addEventListener: (type: string, listener: (event: unknown) => void) =>
        (listeners[type] = listener),
      removeEventListener: (type: string, listener: (event: unknown) => void) => {
        if (listeners[type] === listener) listeners[type] = undefined;
      },
    };
    const loaded: string[] = [];
    new Function('window', 'require', page())(window, (id: string) => loaded.push(id));
    assert.deepEqual(loaded, ['../../../note.dom.tsx'], 'and then loads the component');

    listeners['error']!({ message: 'boom', error: new Error('boom') });
    listeners['unhandledrejection']!({ reason: new Error('rejected') });
    assert.deepEqual(
      posted.map((data) => JSON.parse(data)).map((m) => [m.type, m.message.split('\n')[0]]),
      [
        ['error', 'boom'],
        ['error', 'rejected'],
      ],
    );

    // Once the page is mounted it hands error reporting over and takes its listeners away.
    (window['__solidNativeEarlyCleanup'] as () => void)();
    assert.equal(listeners['error'], undefined);
    assert.equal(listeners['unhandledrejection'], undefined);
  });
});
