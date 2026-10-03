/** @jsxImportSource solid-js */
/**
 * The header's search button and its dialog. The index and the URL mapping are in `search.ts`.
 */
import { createSignal, For, Match, onCleanup, onMount, Switch } from 'solid-js';
import { Icon } from './icon.tsx';
import { LIMIT, loadPagefind, routeFor, type Hit } from './search.ts';

export function DocsSearch() {
  let dialog!: HTMLDialogElement;
  let input!: HTMLInputElement;
  const [hits, setHits] = createSignal<readonly Hit[]>([]);
  const [state, setState] = createSignal<'idle' | 'empty' | 'unavailable'>('idle');

  const open = () => {
    dialog.showModal();
    input.select();
  };
  const close = () => dialog.close();

  const openOnShortcut = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    open();
  };
  onMount(() => document.addEventListener('keydown', openOnShortcut));
  onCleanup(() => document.removeEventListener('keydown', openOnShortcut));

  /** A click on the dialog element itself, rather than inside it, is a click on the backdrop. */
  const closeOnBackdrop = (event: MouseEvent) => {
    if (event.target === dialog) close();
  };

  /** Enter takes the reader to the best match, the way every docs search behaves. */
  const openFirst = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    const first = dialog.querySelector<HTMLAnchorElement>('li a');
    if (!first) return;
    event.preventDefault();
    first.click();
  };

  const search = async (term: string) => {
    const pagefind = await loadPagefind();
    if (!pagefind) {
      setState('unavailable');
      return;
    }
    const found = await pagefind.debouncedSearch(term.trim());
    // null: a later keystroke replaced this search before it ran.
    if (!found) return;
    const results = await Promise.all(found.results.slice(0, LIMIT).map((result) => result.data()));
    if (term !== input.value) return;
    setHits(
      results.map((hit) => ({
        url: routeFor(hit.url),
        title: hit.meta.title ?? '',
        excerpt: hit.excerpt,
      })),
    );
    setState(term.trim() && !results.length ? 'empty' : 'idle');
  };

  return (
    <docs-search>
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg"
        aria-label="Search the documentation"
        aria-keyshortcuts="Meta+K Control+K"
        title="Search (⌘K)"
        onClick={open}
      >
        <Icon name="search" class="text-base" />
      </button>

      <dialog
        ref={dialog}
        class="mx-auto mt-[12vh] w-[min(40rem,calc(100%-2rem))] rounded-xl border border-border-subtle bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
        aria-label="Search the documentation"
        onClick={closeOnBackdrop}
      >
        <div class="flex items-center gap-3 border-b border-border-subtle px-4">
          <Icon name="search" class="shrink-0 text-lg text-fg-tertiary" />
          <input
            ref={input}
            type="search"
            class="h-14 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-tertiary [&::-webkit-search-cancel-button]:hidden"
            placeholder="Search the docs"
            aria-label="Search the docs"
            autocomplete="off"
            spellcheck={false}
            onInput={() => void search(input.value)}
            onKeyDown={openFirst}
          />
        </div>

        <Switch>
          <Match when={state() === 'unavailable'}>
            <p class="px-4 py-8 text-center text-sm text-fg-tertiary">
              The search index is built with the site, so it is only in a production build.
            </p>
          </Match>
          <Match when={state() === 'empty'}>
            <p class="px-4 py-8 text-center text-sm text-fg-tertiary">Nothing matches that.</p>
          </Match>
          <Match when={hits().length}>
            <ul class="max-h-[60vh] overflow-auto p-2" onClick={close}>
              <For each={hits()}>
                {(hit) => (
                  <li>
                    <a
                      href={hit.url}
                      class="block rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none"
                    >
                      <span class="block text-sm font-medium text-fg">{hit.title}</span>
                      <span
                        class="mt-0.5 line-clamp-2 block text-[13px] text-fg-secondary [&_mark]:bg-transparent [&_mark]:font-medium [&_mark]:text-brand"
                        innerHTML={hit.excerpt}
                      />
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </Match>
        </Switch>
      </dialog>
    </docs-search>
  );
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      /** This component's host tag. */
      'docs-search': HTMLAttributes<HTMLElement>;
    }
  }
}
