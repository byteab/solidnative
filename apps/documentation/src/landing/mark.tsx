/** @jsxImportSource solid-js */
/**
 * The site's mark: a solid disc held in a phone's outline - Solid inside a native app - set in
 * white on a blue squircle, the shape of an icon on a home screen.
 *
 * The same drawing is the favicon (`public/favicon.svg`); keep the two in step.
 */

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'landing-mark': HTMLAttributes<HTMLElement>;
    }
  }
}

export function LandingMark(props: { class?: string }) {
  return (
    <landing-mark class={`inline-block ${props.class ?? ''}`}>
      <svg viewBox="0 0 32 32" class="size-full" aria-hidden="true">
        <defs>
          <linearGradient id="landing-mark-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#4a7dff" />
            <stop offset="1" stop-color="#1e4fd6" />
          </linearGradient>
        </defs>
        <path
          d="M16 0C27.2 0 32 4.8 32 16S27.2 32 16 32 0 27.2 0 16 4.8 0 16 0Z"
          fill="url(#landing-mark-fill)"
        />
        <rect
          x="10"
          y="6"
          width="12"
          height="20"
          rx="3.5"
          fill="none"
          stroke="#ffffff"
          stroke-width="2"
        />
        <circle cx="16" cy="16" r="3.75" fill="#ffffff" />
      </svg>
    </landing-mark>
  );
}
