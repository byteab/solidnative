/** @jsxImportSource solid-js */
/**
 * A live example, and the reason this site is built the way it is.
 *
 * A component built from `@solid-native/components/solid` cannot be put in an ordinary Solid DOM
 * page. It renders native elements - `<view>`, `<text>`, `<scroll-view>` - through a universal
 * renderer that commits them to a host, plus a `HostEngine` for anything that measures itself.
 * Solid's DOM renderer supplies neither, so the same component that draws a button on a phone
 * would draw nothing here.
 *
 * `Island` from `@solid-native/web/solid` gives each example exactly that: an element of its own,
 * `<solid-native-island>`, that becomes the root of a small, separate universal tree drawn by the
 * browser host, owned by this page so it is disposed with it. The page around it stays a
 * document, and the two never share a renderer.
 *
 * The island's height is the example's own: it is as tall as its content unless the example asks
 * otherwise through `height`.
 */
import { createResource, createSignal, For, Show } from 'solid-js';
import { Island, type BrowserComponent } from '@solid-native/web/solid';
import { Icon, type IconName } from './icon.tsx';

/** What `examples.ts` resolves a name to: the component, and the text that produced it. */
export interface LoadedExample {
  readonly component: BrowserComponent<object>;
  /** The source, highlighted at build time by `build/source.ts`. */
  readonly source: string;
  /** The same source as plain text, for the copy button. */
  readonly text: string;
  /** An explicit height, for an example whose content cannot size itself (a scroll view). */
  readonly height?: number;
}

type Pane = 'preview' | 'source';

const TABS: readonly { id: Pane; label: string; icon: IconName }[] = [
  { id: 'preview', label: 'Preview', icon: 'eye' },
  { id: 'source', label: 'Source', icon: 'code' },
];

export function DocExample(props: {
  /** The name from the markdown marker. */
  name: string;
  /** Resolved by the page from that name; see `examples.ts`. */
  load: () => Promise<LoadedExample>;
}) {
  const [example] = createResource(
    () => props.load,
    (load) => load(),
  );
  const [showing, setShowing] = createSignal<Pane>('preview');
  const [copied, setCopied] = createSignal(false);

  const copySource = () => {
    const text = example()?.text;
    if (text === undefined) return;
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <doc-example class="block my-6" data-example={props.name}>
      <div class="not-prose overflow-hidden rounded-xl border border-border-default">
        <div class="flex items-center gap-1 border-b border-border-subtle bg-surface-raised px-2 py-1.5">
          <div class="flex gap-0.5 rounded-lg bg-black/[0.04] p-0.5 dark:bg-white/[0.04]">
            <For each={TABS}>
              {(tab) => (
                <button
                  type="button"
                  class={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors ${
                    showing() === tab.id
                      ? 'bg-surface text-fg shadow-sm ring-1 ring-border-subtle'
                      : 'text-fg-tertiary hover:text-fg'
                  }`}
                  aria-pressed={showing() === tab.id}
                  onClick={() => setShowing(tab.id)}
                >
                  <Icon name={tab.icon} class="text-[13px]" />
                  {tab.label}
                </button>
              )}
            </For>
          </div>
          <button
            type="button"
            class="ml-auto inline-flex size-7 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-sunken hover:text-fg"
            aria-label={copied() ? 'Copied' : 'Copy the source'}
            onClick={copySource}
          >
            <Icon name={copied() ? 'check' : 'copy'} class="text-sm" />
          </button>
        </div>

        {/*
          Both panes stay in the DOM and one is hidden, rather than one being created on demand.
          Destroying the preview would destroy the island along with any state the reader had put
          into it, so switching to the source and back would silently reset the example - which
          is exactly the thing an interactive example exists to let them keep.
        */}
        <div
          class="flex min-h-40 items-center justify-center bg-surface p-8"
          hidden={showing() !== 'preview'}
        >
          <div
            class="w-full max-w-md"
            style={{ height: example()?.height ? `${example()!.height}px` : undefined }}
          >
            <Show when={example()}>
              {(loaded) => <Island component={loaded().component} inputs={{}} class="h-full" />}
            </Show>
          </div>
        </div>
        <div
          class="bg-surface-code"
          hidden={showing() !== 'source'}
          innerHTML={example()?.source ?? ''}
        />
      </div>
    </doc-example>
  );
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      /** This component's host tag, which CSS and prerender find it by. */
      'doc-example': HTMLAttributes<HTMLElement>;
    }
  }
}
