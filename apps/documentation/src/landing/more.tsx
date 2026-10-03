/** @jsxImportSource solid-js */
/**
 * The link at the end of a section: "Learn more", and an arrow that moves on towards its guide.
 *
 * Every section ends the same way, so the words stay the same and the section says what it is
 * about. A screen reader gets the topic too - `Learn more about Tailwind` - because a page of
 * links all named "Learn more" is a list of the same link, read aloud. The topic is visually
 * hidden text rather than an `aria-label`, so crawlers read it as the link's text as well.
 */

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'landing-more': HTMLAttributes<HTMLElement>;
    }
  }
}

export function LandingMore(props: {
  link: string;
  /** What the section is about, for the link's accessible name. */
  topic: string;
  class?: string;
}) {
  return (
    <landing-more class={`inline-block ${props.class ?? ''}`}>
      <a class="landing-link landing-more" href={props.link}>
        Learn more<span class="sr-only"> about {props.topic}</span>
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true">
          <path
            d="M3 8h9.5M9 4.5 12.5 8 9 11.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </a>
    </landing-more>
  );
}
