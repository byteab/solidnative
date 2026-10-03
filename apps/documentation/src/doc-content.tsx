/** @jsxImportSource solid-js */
/**
 * A page's blocks, rendered.
 *
 * Prose arrives as HTML that was rendered at build time and goes in with `innerHTML`; an example
 * arrives as a name and becomes an island; an API reference arrives as a name and becomes a table.
 * See `build/markdown.ts` for why a page is a list of blocks rather than one string.
 *
 * `innerHTML` is safe here in the strict sense: this HTML is markdown from this repository,
 * compiled by this build, never anything a reader supplied.
 */
import { For, Match, Switch } from 'solid-js';
import type { DocBlock } from '../build/markdown.ts';
import { ApiReference } from './api-reference.tsx';
import { DocExample } from './example.tsx';
import { exampleLoader } from './examples.ts';

export function DocContent(props: { blocks: readonly DocBlock[]; class?: string }) {
  return (
    <doc-content class={`prose block ${props.class ?? ''}`}>
      <For each={props.blocks}>
        {(block) => (
          <Switch>
            <Match when={block.kind === 'html' && block}>
              {(html) => <div innerHTML={html().html} />}
            </Match>
            <Match when={block.kind === 'api' && block}>
              {(api) => <ApiReference reference={api().reference} />}
            </Match>
            <Match when={block.kind === 'example' && block}>
              {/* One loader per name (see `exampleLoader`), so a rebuilt list does not remount it. */}
              {(example) => (
                <DocExample name={example().name} load={exampleLoader(example().name)} />
              )}
            </Match>
          </Switch>
        )}
      </For>
    </doc-content>
  );
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      /** This component's host tag. */
      'doc-content': HTMLAttributes<HTMLElement>;
    }
  }
}
