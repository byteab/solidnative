/** @jsxImportSource solid-js */
/**
 * The shell: a fixed header, a sidebar that is the reading order, and the page. Rendered into the
 * `<app-root>` that `index.html` ships; see `main.tsx`.
 *
 * All of it is ordinary Solid over the DOM. The only native components on this site are inside
 * islands (a `doc-example`, the landing page's devices), and that is deliberate rather than a
 * limitation - a documentation site whose own chrome went through the same renderer as the
 * components would be unable to say which of the two a bug belonged to.
 */
import { createSignal, For, Show, type JSX } from 'solid-js';
import { Icon } from './icon.tsx';
import { LINKS } from './landing/content.ts';
import { LandingMark } from './landing/mark.tsx';
import { SECTIONS, type NavItem } from './navigation.ts';
import { currentLayout, currentPath, RouteView } from './router.ts';
import { DocsSearch } from './search.tsx';
import { GITHUB_REPO, SITE_NAME } from './site.ts';
import { scheme, toggleScheme } from './theme.ts';

const HEADER_LINK =
  'hidden h-8 items-center rounded-md px-3 text-sm text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg sm:inline-flex';
const DRAWER_LINK =
  'flex h-9 items-center rounded-md px-3 text-[15px] font-medium text-fg transition-colors hover:bg-surface-raised';
const ITEM_ACTIVE =
  'bg-surface-raised !font-medium !text-fg before:absolute before:top-1/2 before:left-0 before:h-3.5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand';
const CHILD_ACTIVE =
  '!text-fg !font-medium before:absolute before:top-1/2 before:-left-[9px] before:h-3.5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand';

/**
 * Whether a link's page is showing: the page itself, or (unless `exact`) any page beneath it.
 */
function isActive(path: string, exact = false): boolean {
  const current = currentPath();
  return current === path || (!exact && current.startsWith(`${path}/`));
}

/**
 * A group's pages, with its own index page first.
 *
 * Without the index in the list there is nothing to mark when you are standing on it, and the
 * group's own row is the wrong thing to mark: it sits above the indented list, so the marker
 * reads as belonging to the section rather than to a page in it.
 */
function pages(item: NavItem): NavItem[] {
  return [{ path: item.path, title: 'Overview' }, ...(item.children ?? [])];
}

/**
 * Whether a group's pages are showing: the one the reader is inside, and no other. Read from the
 * URL rather than held in a signal a click toggles, so arriving at a sub-page from a link or a
 * reload opens the right group without anything having to remember.
 */
function isOpen(item: NavItem): boolean {
  return isActive(`/${item.path}`);
}

/** The reading order, written once for the sticky column and the drawer alike. */
function Links(): JSX.Element {
  return (
    <For each={SECTIONS}>
      {(section) => (
        <div>
          <h2 class="mb-2 px-3 text-[11px] font-semibold tracking-[0.08em] text-fg-tertiary uppercase">
            {section.title}
          </h2>
          <ul class="flex flex-col gap-y-0.5">
            <For each={section.items}>
              {(item) => (
                <li class="relative">
                  <Show
                    when={item.children?.length}
                    fallback={
                      <a
                        href={`/${item.path}`}
                        class={`flex h-8 items-center rounded-md px-3 text-sm text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg ${isActive(`/${item.path}`) ? ITEM_ACTIVE : ''}`}
                      >
                        {item.title}
                      </a>
                    }
                  >
                    {/*
                      A group's own row carries no active state, because its index page is listed
                      below as "Overview" and that is what marks it.
                    */}
                    <a
                      href={`/${item.path}`}
                      class={`flex h-8 items-center rounded-md px-3 text-sm transition-colors hover:bg-surface-raised hover:text-fg ${isOpen(item) ? 'font-medium text-fg' : 'text-fg-secondary'}`}
                    >
                      {item.title}
                    </a>
                  </Show>

                  {/*
                    Only the open group's pages, so the sidebar stays a list of packages until you
                    are inside one. Showing every page at once would bury the names someone is
                    actually scanning for.
                  */}
                  <Show when={item.children?.length && isOpen(item)}>
                    <ul class="mt-0.5 mb-1 ml-3 flex flex-col gap-y-0.5 border-l border-border-subtle pl-2">
                      <For each={pages(item)}>
                        {(child) => (
                          <>
                            {/*
                              A group's label sits out on the rail, in full ink, with room above
                              it: set in the links' own grey and indent it read as one more link.
                            */}
                            <Show when={child.group}>
                              <li
                                aria-hidden="true"
                                class="relative -ml-[9px] mt-4 mb-1 flex items-center gap-2 bg-surface py-0.5 pr-2 text-[10.5px] font-semibold tracking-[0.1em] text-fg uppercase select-none first:mt-2"
                              >
                                <span class="h-px w-2 bg-border" />
                                {child.group}
                              </li>
                            </Show>
                            <li class="relative">
                              <a
                                href={`/${child.path}`}
                                class={`flex h-7 items-center rounded-md px-3 text-[13px] text-fg-tertiary transition-colors hover:text-fg ${isActive(`/${child.path}`, true) ? CHILD_ACTIVE : ''}`}
                              >
                                {child.title}
                              </a>
                            </li>
                          </>
                        )}
                      </For>
                    </ul>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </div>
      )}
    </For>
  );
}

export function App(): JSX.Element {
  const [menuOpen, setMenuOpen] = createSignal(false);
  /** Every guide and package page is the docs, whichever one the Docs link happens to open. */
  const inDocs = () => /^\/(guide|packages)(\/|$)/.test(currentPath());

  return (
    <Show
      when={currentLayout() !== 'home'}
      fallback={
        // The landing page brings its own header, main and footer: see landing/landing.tsx.
        <RouteView />
      }
    >
      <header class="fixed top-0 z-30 w-full border-b border-border-subtle bg-surface/75 backdrop-blur-xl">
        <nav class="mx-auto flex h-16 w-full max-w-[90rem] items-center gap-x-4 px-5 lg:px-8">
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg lg:hidden"
            aria-expanded={menuOpen()}
            aria-label="Navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen() ? 'x' : 'menu'} class="text-lg" />
          </button>

          {/* The landing page's mark and wordmark, so the two halves of the site are one brand. */}
          <a href="/" class="flex items-center gap-2.5" aria-label={`${SITE_NAME}, home`}>
            <LandingMark class="size-7" />
            <span class="font-display text-[17px] font-semibold tracking-[-0.02em] text-fg">
              {SITE_NAME}
            </span>
          </a>

          <div class="ml-auto flex items-center gap-x-1">
            {/* The landing page's links, in its order, without its call to action. */}
            <a class={`${HEADER_LINK} ${inDocs() ? '!text-fg' : ''}`} href={LINKS.docs}>
              Docs
            </a>
            <a class={`${HEADER_LINK} ${isActive('/learn') ? '!text-fg' : ''}`} href="/learn">
              Learn
            </a>
            <a class={`${HEADER_LINK} ${isActive('/examples') ? '!text-fg' : ''}`} href="/examples">
              Examples
            </a>
            <a class={HEADER_LINK} href={GITHUB_REPO}>
              GitHub
            </a>
            <a
              class="hidden h-8 items-center gap-1.5 rounded-md px-3 text-sm text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg sm:inline-flex"
              href="/sponsor"
            >
              Sponsor
            </a>
            <DocsSearch />
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg"
              aria-label={`Switch to ${scheme() === 'dark' ? 'light' : 'dark'}`}
              onClick={toggleScheme}
            >
              <Icon name={scheme() === 'dark' ? 'sun' : 'moon'} class="text-base" />
            </button>
          </div>
        </nav>
      </header>

      <Show
        when={currentLayout() !== 'workspace'}
        fallback={
          // A lesson is a workspace that fills the window under the header; see learn/lesson-page.tsx.
          <main class="pt-16">
            <RouteView />
          </main>
        }
      >
        <div class="mx-auto w-full max-w-[90rem] px-5 pt-24 lg:px-8">
          <div class="flex gap-x-10">
            {/*
              Two sidebars in one, and the same list either way: on a wide screen it is a sticky
              column beside the page, and below that a drawer over it. Writing it once means the
              reading order cannot differ between a laptop and a phone.
            */}
            <Show when={currentLayout() === 'docs'}>
              <nav class="scrollbar-hover sticky top-24 hidden h-[calc(100dvh-9rem)] w-52 shrink-0 flex-col gap-y-7 overflow-auto overscroll-contain pb-10 lg:flex">
                <Links />
              </nav>
            </Show>

            <Show when={menuOpen()}>
              <div class="fixed inset-0 z-40 lg:hidden">
                <button
                  type="button"
                  class="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  aria-label="Close navigation"
                  onClick={() => setMenuOpen(false)}
                />
                <nav class="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-auto border-r border-border-subtle bg-surface px-5 py-6">
                  <div class="flex flex-col gap-y-7" onClick={() => setMenuOpen(false)}>
                    {/* The header hides its links on a phone, so they lead the drawer there. */}
                    <ul class="flex flex-col gap-y-0.5 sm:hidden">
                      <li>
                        <a href={LINKS.docs} class={DRAWER_LINK}>
                          Docs
                        </a>
                      </li>
                      <li>
                        <a href="/learn" class={DRAWER_LINK}>
                          Learn
                        </a>
                      </li>
                      <li>
                        <a href="/examples" class={DRAWER_LINK}>
                          Examples
                        </a>
                      </li>
                      <li>
                        <a href={GITHUB_REPO} class={DRAWER_LINK}>
                          GitHub
                        </a>
                      </li>
                      <li>
                        <a href="/sponsor" class={DRAWER_LINK}>
                          Sponsor
                        </a>
                      </li>
                    </ul>
                    <Links />
                  </div>
                </nav>
              </div>
            </Show>

            <main class="min-w-0 flex-1 pb-20">
              <RouteView />
            </main>
          </div>

          <footer class="mt-8 flex flex-col items-center gap-y-1 border-t border-border-subtle px-5 py-10 text-xs text-fg-tertiary">
            <p>Solid components as native iOS and Android views, built and shipped with Expo.</p>
            <p>
              An alpha. MIT licensed.{' '}
              <a class="underline underline-offset-2 hover:text-fg" href="/sponsor">
                Sponsor its development
              </a>
              .
            </p>
            <p>
              Built on{' '}
              <a
                class="underline underline-offset-2 hover:text-fg"
                href="https://github.com/ng-native/ng-native"
              >
                ng-native
              </a>{' '}
              by Ashley Hunter.
            </p>
            <p>
              An independent project, not affiliated with or endorsed by the Solid team or Expo.
            </p>
          </footer>
        </div>
      </Show>
    </Show>
  );
}
