/** @jsxImportSource solid-js */
/**
 * The usage strip under a page's opening paragraph: what to import, from where, and what to write.
 *
 * Built from the page's own `<!-- api: -->` markers and the extracted API, never written by hand:
 * the import path is wherever the export is really published (the package's Solid entry, or a
 * subpath such as `@solidnative/expo/solid/battery`), a component shows its JSX tag, and a function
 * shows the call. Every page that documents an export gets the same strip, and none of it can
 * drift from the source.
 */
import { createMemo, createSignal, For, Show } from 'solid-js';
import { API } from 'virtual:solid-native/api';
import type { ApiEntry } from '../build/api.ts';
import { Icon } from './icon.tsx';
import './doc-usage.css';

/** `Button`, or `@solidnative/components#Switch`, the way an `api` marker names an export. */
export function findApi(reference: string): ApiEntry | undefined {
  const all = API as Record<string, ApiEntry>;
  return all[reference] ?? Object.values(all).find((item) => item.name === reference);
}

/** One import statement, wrapped the way Prettier would once it has more than three names. */
function importStatement(names: readonly string[], from: string): string {
  const list = names.length > 3 ? `\n  ${names.join(',\n  ')},\n` : ` ${names.join(', ')} `;
  return `import {${list}} from '${from}';`;
}

export function DocUsage(props: {
  /** The page's `api` markers, in the order it documents them. */
  references: readonly string[];
  'data-pagefind-ignore'?: boolean | string;
}) {
  const [copied, setCopied] = createSignal(false);
  const entries = createMemo(() =>
    props.references.map(findApi).filter((entry): entry is ApiEntry => entry !== undefined),
  );

  /** One statement per path, so an Expo page that uses two entry points shows both. */
  const imports = createMemo(() => {
    const byPath = new Map<string, string[]>();
    for (const entry of entries()) {
      const names = byPath.get(entry.importPath) ?? [];
      if (!names.includes(entry.name)) names.push(entry.name);
      byPath.set(entry.importPath, names);
    }
    return [...byPath].map(([from, names]) => ({
      from,
      names: importStatement(names, from).slice('import '.length).split(' from ')[0]!,
      text: importStatement(names, from),
    }));
  });
  const components = createMemo(() =>
    entries()
      .filter((entry) => entry.kind === 'component')
      .map((entry) => `<${entry.name} />`),
  );
  const calls = createMemo(() =>
    entries()
      .filter((entry) => entry.kind === 'function')
      .map((entry) => `${entry.name}()`),
  );

  async function copyImports(): Promise<void> {
    await navigator.clipboard.writeText(
      imports()
        .map((line) => line.text)
        .join('\n'),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <doc-usage class="doc-usage" data-pagefind-ignore={props['data-pagefind-ignore']}>
      <div class="usage-row">
        <span class="usage-label">Import</span>
        <pre class="usage-code">
          <code>
            <For each={imports()}>
              {(line) => (
                <>
                  <span class="kw">import</span> {line.names} <span class="kw">from</span>{' '}
                  <span class="str">'{line.from}'</span>;{'\n'}
                </>
              )}
            </For>
          </code>
        </pre>
        <button
          type="button"
          class="usage-copy"
          aria-label={copied() ? 'Copied' : 'Copy the import'}
          onClick={() => void copyImports()}
        >
          <Icon name={copied() ? 'check' : 'copy'} size={15} />
        </button>
      </div>
      <Show when={components().length}>
        <div class="usage-row">
          <span class="usage-label">Render</span>
          <div class="usage-uses">
            <For each={components()}>{(element) => <code>{element}</code>}</For>
          </div>
        </div>
      </Show>
      <Show when={calls().length}>
        <div class="usage-row">
          <span class="usage-label">Call</span>
          <div class="usage-uses">
            <For each={calls()}>{(call) => <code>{call}</code>}</For>
          </div>
        </div>
      </Show>
    </doc-usage>
  );
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      /** This component's host tag, which CSS and prerender find it by. */
      'doc-usage': HTMLAttributes<HTMLElement>;
    }
  }
}
