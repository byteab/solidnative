/** @jsxImportSource solid-js */
/**
 * A sheet of source, laid on the page like a printout: the real file, highlighted.
 *
 * The code is never transcribed. It is the example's own text, read off disk and highlighted by
 * `build/source.ts` at build time, so the component shown and the component running beside it
 * cannot drift apart. The HTML is set as it is: Shiki writes each token's colours into a `style`
 * attribute, and the markup comes from the repository's own files, not from a visitor.
 */

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'landing-code': HTMLAttributes<HTMLElement>;
    }
  }
}

export function LandingCode(props: {
  html: string;
  file?: string;
  maxHeight?: string;
  class?: string;
}) {
  return (
    <landing-code class={`block min-w-0 ${props.class ?? ''}`}>
      <div class="code-sheet">
        <div class="code-sheet-head">
          <span class="code-sheet-file">{props.file ?? 'app.tsx'}</span>
        </div>
        <div class="code-sheet-body" style={{ 'max-height': props.maxHeight }}>
          <div class="relative min-w-max">
            <div innerHTML={props.html} />
          </div>
        </div>
      </div>
    </landing-code>
  );
}
