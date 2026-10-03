/** @jsxImportSource solid-js */
/**
 * Any page whose content is a markdown file: a guide page or a package page.
 *
 * One component rather than one per section, because a page here is the same shape whatever it is
 * about - an article, a contents column beside it, and a link to the next thing to read. What
 * differs between sections is the content, and that is in the markdown.
 *
 * The document is resolved from the URL by the router (see `router.ts`) rather than declared per
 * route, so adding a page is adding a `.md` file and a line in `navigation.ts`, with nothing to
 * change here. The router loads it before switching, so the page being left stays on screen until
 * the next one is ready, and keeps this component across documents - so both props are reactive.
 */
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import type { DocBlock } from '../build/markdown.ts';
import type { DocModule } from './content.ts';
import { DocArt } from './doc-art.tsx';
import { DocContent } from './doc-content.tsx';
import { DocUsage } from './doc-usage.tsx';
import { Icon } from './icon.tsx';
import { breadcrumbsFor, READING_ORDER, type NavItem } from './navigation.ts';
import { applyNotFound, applySeo } from './seo.ts';
import { DEFAULT_DESCRIPTION, SITE_NAME } from './site.ts';

/** The brand belongs in every title, but "solid-native compared - solid-native" does not. */
function titleFor(title: string): string {
  return title.startsWith(SITE_NAME) ? title : `${title} - ${SITE_NAME}`;
}

/**
 * The page cut after its opening paragraph, where the usage strip goes, and the declarations it
 * documents. The title and first paragraph say what the thing is; the strip says how to use it
 * before any example does. A page with no paragraph under its title is cut after the title.
 */
export function split(blocks: readonly DocBlock[]): {
  lead: DocBlock[];
  rest: DocBlock[];
  references: string[];
} {
  const references = blocks.flatMap((block) => (block.kind === 'api' ? [block.reference] : []));
  const [first, ...others] = blocks;
  const title = first?.kind === 'html' ? first.html.indexOf('</h1>') : -1;
  if (!first || first.kind !== 'html' || title === -1) {
    return { lead: [], rest: [...blocks], references };
  }
  const afterTitle = title + '</h1>'.length;
  const paragraph = /^\s*<p[\s>][\s\S]*?<\/p>/.exec(first.html.slice(afterTitle));
  const cut = afterTitle + (paragraph?.[0].length ?? 0);
  return {
    lead: [{ kind: 'html', html: first.html.slice(0, cut) }],
    rest: [{ kind: 'html', html: first.html.slice(cut) }, ...others],
    references,
  };
}

/**
 * The pages either side in the reading order, skipping a `branch` (see `NavItem.branch`):
 * reachable from its own parent, prerendered and in the sitemap like any other page, but not where
 * the pager sends a reader who just finished the page before it.
 */
function neighbours(path: string): { previous?: NavItem; next?: NavItem } {
  const at = READING_ORDER.findIndex((item) => item.path === path);
  if (at === -1) return {};
  return {
    previous: READING_ORDER.slice(0, at)
      .reverse()
      .find((item) => !item.branch),
    next: READING_ORDER.slice(at + 1).find((item) => !item.branch),
  };
}

/** A contents link: the heading's anchor on this page. */
function TocLink(props: {
  path: string;
  heading: DocModule['headings'][number];
  onClick?: () => void;
}) {
  return (
    <a
      href={`/${props.path}#${props.heading.id}`}
      class={`block rounded-md py-1 text-fg-tertiary transition-colors hover:text-fg ${props.heading.level === 3 ? 'pl-6' : 'pl-3'}`}
      onClick={() => props.onClick?.()}
    >
      {props.heading.text}
    </a>
  );
}

export function DocPage(props: {
  /** The page's path without a leading slash: `guide/architecture`. */
  path: string;
  /** The document, or `null` when there is no page at this path. */
  doc?: DocModule | null;
}) {
  /** The compact "On this page" control below the xl breakpoint. Closed on every page it opens on. */
  const [tocOpen, setTocOpen] = createSignal(false);
  const parts = createMemo(() => split(props.doc?.blocks ?? []));
  const around = createMemo(() => neighbours(props.path));

  /**
   * The page's own title, description and breadcrumbs, or `applyNotFound()` when there is no
   * document. An effect, because this component is kept across documents.
   */
  createEffect(() => {
    const page = props.doc;
    if (page === null) {
      applyNotFound();
      return;
    }
    if (!page) return;
    setTocOpen(false);
    const path = props.path;
    applySeo({
      title: titleFor(page.attributes.title ?? path),
      // A summary's inline code is markup here, where search results and link previews show it raw.
      description: page.attributes.summary?.replaceAll('`', '') ?? DEFAULT_DESCRIPTION,
      path: `/${path}`,
      type: 'article',
      breadcrumbs: breadcrumbsFor(path),
    });
  });

  return (
    <doc-page>
      <Show
        when={props.doc}
        fallback={
          <div class="prose max-w-3xl">
            <h1>Not found</h1>
            <p>
              There is no page at <code>/{props.path}</code>.
            </p>
            <p>
              <a href="/">Back to the overview</a>
            </p>
          </div>
        }
      >
        {(page) => (
          <div class="flex gap-x-12">
            {/* The one part of the site the search index reads: see src/search.ts. */}
            <article class="min-w-0 flex-1" data-pagefind-body>
              <div class="max-w-3xl">
                <Show when={page().headings.length > 1}>
                  {/*
                    The sticky column below only shows from xl up, so a reader on a phone or a
                    tablet gets this instead: closed by default, because a list of headings above
                    the prose it describes is a worse first screen than the prose itself. It sits
                    above the title, so it never crowds the lead.
                  */}
                  <div
                    class="mb-8 rounded-lg border border-border-subtle xl:hidden"
                    data-pagefind-ignore
                  >
                    <button
                      type="button"
                      class="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-fg"
                      aria-expanded={tocOpen()}
                      onClick={() => setTocOpen((open) => !open)}
                    >
                      On this page
                      <Icon
                        name="chevron-down"
                        class={`text-fg-tertiary transition-transform ${tocOpen() ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <Show when={tocOpen()}>
                      <ul class="flex flex-col gap-y-0.5 border-t border-border-subtle px-3 py-2 text-sm">
                        <For each={page().headings}>
                          {(heading) => (
                            <li>
                              <TocLink
                                path={props.path}
                                heading={heading}
                                onClick={() => setTocOpen(false)}
                              />
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>
                  </div>
                </Show>

                <Show when={page().attributes.art}>{(art) => <DocArt name={art()} />}</Show>
                <DocContent blocks={parts().lead} />
                <Show when={parts().references.length}>
                  <DocUsage references={parts().references} data-pagefind-ignore="" />
                </Show>
                {/*
                  Its own prose block, so the paragraph rhythm does not reach across from the lead:
                  without the margin the second paragraph sat flush under the first.
                */}
                <DocContent
                  blocks={parts().rest}
                  class={parts().lead.length > 0 ? 'mt-4' : undefined}
                />

                <Show when={around().previous || around().next}>
                  {/*
                    Two fixed halves: Previous always on the left and Next always on the right, so
                    either one keeps its place and its size when the other is missing.
                  */}
                  <nav
                    class="mt-16 grid grid-cols-2 gap-4 border-t border-border-subtle pt-6"
                    data-pagefind-ignore
                  >
                    <Show when={around().previous}>
                      {(item) => (
                        <a
                          href={`/${item().path}`}
                          class="flex flex-col gap-0.5 rounded-lg border border-border-subtle p-4 transition-colors hover:border-border-strong"
                        >
                          <span class="text-xs text-fg-tertiary">Previous</span>
                          <span class="text-sm font-medium text-fg">{item().title}</span>
                        </a>
                      )}
                    </Show>
                    <Show when={around().next}>
                      {(item) => (
                        <a
                          href={`/${item().path}`}
                          class="col-start-2 flex flex-col items-end gap-0.5 rounded-lg border border-border-subtle p-4 text-right transition-colors hover:border-border-strong"
                        >
                          <span class="text-xs text-fg-tertiary">Next</span>
                          <span class="text-sm font-medium text-fg">{item().title}</span>
                        </a>
                      )}
                    </Show>
                  </nav>
                </Show>
              </div>
            </article>

            <Show when={page().headings.length > 1}>
              <nav class="scrollbar-hover sticky top-24 hidden h-fit max-h-[calc(100dvh-9rem)] w-56 shrink-0 overflow-auto xl:block">
                <h2 class="mb-2 px-3 text-[11px] font-semibold tracking-[0.08em] text-fg-tertiary uppercase">
                  On this page
                </h2>
                <ul class="flex flex-col gap-y-0.5 text-sm">
                  <For each={page().headings}>
                    {(heading) => (
                      <li>
                        <TocLink path={props.path} heading={heading} />
                      </li>
                    )}
                  </For>
                </ul>
              </nav>
            </Show>
          </div>
        )}
      </Show>
    </doc-page>
  );
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      /** This component's host tag. */
      'doc-page': HTMLAttributes<HTMLElement>;
    }
  }
}
