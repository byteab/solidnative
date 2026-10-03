/** @jsxImportSource solid-js */
/**
 * The landing page's header: a narrow label along the top of the sheet.
 *
 * Transparent over the hero, then the page's own colour with a thin rule once the hero has gone -
 * `solid` is set by the page, which knows where the hero ends. On a narrow screen the links move
 * into a full-screen menu rather than a dropdown too small to hit. The theme switch is the docs'
 * own, so light or dark carries between the two.
 */
import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { Icon } from '../icon.tsx';
import { SITE_NAME } from '../site.ts';
import { scheme, toggleScheme } from '../theme.ts';
import { LINKS } from './content.ts';
import { LandingMark } from './mark.tsx';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'landing-header': HTMLAttributes<HTMLElement>;
    }
  }
}

export function LandingHeader(props: {
  /** The page has scrolled: a paper ground, so nothing shows through the links. */
  solid: boolean;
  /** Past the hero: the thin rule under the label as well. */
  ruled: boolean;
}) {
  const links = LINKS;
  const [open, setOpen] = createSignal(false);
  const close = () => setOpen(false);

  onMount(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    onCleanup(() => document.removeEventListener('keydown', onKey));
  });

  return (
    <landing-header>
      <header
        class="landing-header"
        data-solid={String(props.solid || open())}
        data-ruled={String(props.ruled)}
      >
        <nav
          class="mx-auto flex h-16 max-w-[80rem] items-center gap-6 px-[var(--gutter)]"
          aria-label="Main"
        >
          <a href="/" class="flex items-center gap-2.5" aria-label={`${SITE_NAME}, home`}>
            <LandingMark class="size-7" />
            <span class="landing-display text-[1.05rem] tracking-[-0.02em]">{SITE_NAME}</span>
          </a>

          <ul class="ml-auto hidden items-center gap-7 text-[0.9375rem] md:flex">
            <li>
              <a class="hover:text-brand-ink" href={links.docs}>
                Docs
              </a>
            </li>
            <li>
              <a class="hover:text-brand-ink" href={links.learn}>
                Learn
              </a>
            </li>
            <li>
              <a class="hover:text-brand-ink" href={links.examples}>
                Examples
              </a>
            </li>
            <li>
              <a class="hover:text-brand-ink" href={links.github}>
                GitHub
              </a>
            </li>
            <li>
              <a class="flex items-center gap-1.5 hover:text-brand-ink" href={links.sponsor}>
                Sponsor
              </a>
            </li>
            <li>
              <a class="landing-button !min-h-10" data-kind="primary" href={links.getStarted}>
                Get started
              </a>
            </li>
          </ul>

          {/* The site's own theme switch, so a reader's choice carries between here and the docs. */}
          <button
            type="button"
            class="ml-auto inline-flex size-10 items-center justify-center rounded-md text-graphite transition-colors hover:text-ink md:ml-0"
            aria-label={`Switch to ${scheme() === 'dark' ? 'light' : 'dark'} theme`}
            onClick={toggleScheme}
          >
            <Icon name={scheme() === 'dark' ? 'sun' : 'moon'} class="text-lg" />
          </button>

          <button
            type="button"
            class="inline-flex size-11 items-center justify-center md:hidden"
            aria-controls="landing-menu"
            aria-expanded={open()}
            onClick={() => setOpen(true)}
          >
            <span class="sr-only">Menu</span>
            <svg viewBox="0 0 24 24" class="size-6" aria-hidden="true">
              <path
                d="M4 8h16M4 16h11"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </nav>
      </header>

      <Show when={open()}>
        <div
          id="landing-menu"
          class="landing-menu md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div class="flex h-14 items-center justify-between">
            <span class="landing-display text-lg">{SITE_NAME}</span>
            <button
              type="button"
              class="inline-flex size-11 items-center justify-center"
              onClick={close}
            >
              <span class="sr-only">Close menu</span>
              <svg viewBox="0 0 24 24" class="size-6" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
          {/* Each link fills its row, so a tap beside the word still follows it. */}
          <ul class="landing-display mt-7 flex flex-col text-4xl" onClick={close}>
            <li>
              <a class="block py-3" href={links.docs}>
                Docs
              </a>
            </li>
            <li>
              <a class="block py-3" href={links.learn}>
                Learn
              </a>
            </li>
            <li>
              <a class="block py-3" href={links.examples}>
                Examples
              </a>
            </li>
            <li>
              <a class="block py-3" href={links.github}>
                GitHub
              </a>
            </li>
            <li>
              <a class="block py-3" href={links.sponsor}>
                Sponsor
              </a>
            </li>
          </ul>
          <a
            class="landing-button mt-auto justify-center"
            data-kind="primary"
            href={links.getStarted}
            onClick={close}
          >
            Get started
          </a>
        </div>
      </Show>
    </landing-header>
  );
}
