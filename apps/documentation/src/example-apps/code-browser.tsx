/** @jsxImportSource solid-js */
/**
 * An example app's source: its files as a tree, and the one chosen, highlighted.
 *
 * The files and their highlighting come from `build/example-sources.ts`, read out of the app's
 * folder at build time. Each file is a chunk of its own, loaded when it is chosen. The HTML is
 * set as it is: it is highlighted at build time from the repository's own file.
 *
 * The page renders one browser per app, so the chosen file starts as `entry` and needs no
 * resetting when the app changes.
 */
import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { EXAMPLE_SOURCES } from 'virtual:solidnative/example-sources';
import { GITHUB_REPO } from '../site.ts';
import { fileTree, type FileNode } from './file-tree.ts';
import './example-apps.css';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'example-code-browser': HTMLAttributes<HTMLElement>;
    }
  }
}

export function ExampleCodeBrowser(props: {
  slug: string;
  sourceRoot: string;
  /** The file to open on. */
  entry: string;
}) {
  const files = createMemo(() => EXAMPLE_SOURCES[props.slug] ?? []);
  const tree = createMemo(() => fileTree(files().map((file) => file.path)));
  const [selected, setSelected] = createSignal(props.entry);

  const [code] = createResource(
    () => files().find((file) => file.path === selected()),
    (file) => file.load(),
  );

  const fileUrl = () => `${GITHUB_REPO}/blob/main/${props.sourceRoot}/${selected()}`;

  const level = (nodes: readonly FileNode[], depth: number) => (
    <ul>
      <For each={nodes}>
        {(node) => (
          <li>
            <Show
              when={node.children}
              fallback={
                <button
                  type="button"
                  class={`relative flex h-7 w-full items-center pr-3 text-left font-mono text-[12.5px] transition-colors hover:text-fg ${
                    node.path === selected()
                      ? 'bg-surface-raised font-medium text-fg before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-brand'
                      : 'text-fg-secondary'
                  }`}
                  style={{ 'padding-left': `${1 + depth * 0.875}rem` }}
                  aria-current={node.path === selected() ? 'true' : undefined}
                  onClick={() => setSelected(node.path)}
                >
                  {node.name}
                </button>
              }
            >
              {(children) => (
                <>
                  <span
                    class="flex h-7 items-center pr-3 font-mono text-[12.5px] text-fg-tertiary"
                    style={{ 'padding-left': `${1 + depth * 0.875}rem` }}
                  >
                    {node.name}/
                  </span>
                  {level(children(), depth + 1)}
                </>
              )}
            </Show>
          </li>
        )}
      </For>
    </ul>
  );

  return (
    <example-code-browser>
      <div class="grid overflow-hidden rounded-xl border border-border-subtle bg-surface-code lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav
          aria-label="Files"
          class="max-h-56 overflow-auto border-b border-border-subtle py-3 lg:max-h-[42rem] lg:border-r lg:border-b-0"
        >
          {level(tree(), 0)}
        </nav>

        <div class="flex min-w-0 flex-col">
          <div class="flex h-11 items-center justify-between gap-4 border-b border-border-subtle px-4 text-[13px]">
            <span class="truncate font-mono text-fg" data-file>
              {selected()}
            </span>
            <a class="shrink-0 text-fg-tertiary transition-colors hover:text-fg" href={fileUrl()}>
              On GitHub
            </a>
          </div>
          {/* The last file loaded stays on screen while the next one arrives, not a blank pane. */}
          <div
            class="code-pane min-h-80 overflow-auto lg:max-h-[39.25rem]"
            aria-busy={code.loading}
            innerHTML={code.latest ?? ''}
          />
        </div>
      </div>
    </example-code-browser>
  );
}
