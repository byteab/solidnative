/** @jsxImportSource solid-js */
/**
 * The end of the page: one line, and the ways onward.
 *
 * Type only, centred under the mark - the page has shown enough phones by here, and the hero's
 * are the ones a reader remembers. The blue underline under "every screen" is the same hand as the
 * hero's under "Solid".
 */
import { SITE_NAME } from '../site.ts';
import { LINKS } from './content.ts';
import { underline } from './ink.ts';
import { LandingMark } from './mark.tsx';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'landing-final-cta': HTMLAttributes<HTMLElement>;
    }
  }
}

const RULE = underline(0, 6, 100, 404);

export function LandingFinalCta() {
  const links = LINKS;
  return (
    <landing-final-cta>
      <section aria-labelledby="cta-title">
        <div class="mx-auto flex max-w-[56rem] flex-col items-center px-[var(--gutter)] py-32 text-center">
          <LandingMark class="size-14" />
          <h2
            id="cta-title"
            class="landing-display mt-8 text-[clamp(2.6rem,5.4vw,4.6rem)] text-balance"
          >
            Your Solid app belongs on{' '}
            <span class="relative inline-block">
              every screen.
              <svg
                class="absolute -bottom-[0.14em] left-0 h-[0.22em] w-full overflow-visible"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path class="ink-accent ink-stretch cta-rule" d={RULE} />
              </svg>
            </span>
          </h2>
          <div class="mt-12 flex flex-wrap items-center justify-center gap-3">
            <a class="landing-button" data-kind="primary" href={links.getStarted}>
              Get started
            </a>
            <a class="landing-button" data-kind="secondary" href={links.docs}>
              Read the docs
            </a>
            <a class="landing-button" data-kind="secondary" href={links.github}>
              Star on GitHub
            </a>
          </div>
          <div class="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
            <a class="landing-link" href={links.examples}>
              Browse the examples
            </a>
            <a class="landing-link" href={links.issues}>
              Open an issue
            </a>
          </div>
          <p class="mt-10 text-sm text-graphite">
            {SITE_NAME} is free, MIT licensed and built in the open.{' '}
            <a class="landing-link" href={links.sponsor}>
              Sponsor its development
            </a>
            .
          </p>
        </div>
      </section>
    </landing-final-cta>
  );
}
