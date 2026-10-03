/** @jsxImportSource solid-js */
/**
 * A command someone is meant to run, with a button that copies it.
 *
 * Horizontally scrollable rather than wrapped, so a long command stays one pasteable line on a
 * phone. The confirmation is announced once, politely, and only when a copy actually happened.
 */
import { createSignal, onCleanup } from 'solid-js';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'landing-command': HTMLAttributes<HTMLElement>;
    }
  }
}

export function LandingCommand(props: { command: string; class?: string; style?: string }) {
  const [copied, setCopied] = createSignal(false);
  let reset: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(reset));

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.command);
    } catch {
      // No clipboard permission (an insecure origin, or a browser that refused): the command is
      // still selectable, so say nothing rather than claim a copy that did not happen.
      return;
    }
    setCopied(true);
    clearTimeout(reset);
    reset = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <landing-command class={`block min-w-0 ${props.class ?? ''}`} style={props.style}>
      <div class="landing-command">
        <span class="text-graphite select-none" aria-hidden="true">
          $
        </span>
        <code tabindex="0" aria-label={`Command: ${props.command}`}>
          {props.command}
        </code>
        <button type="button" class="landing-command-copy" onClick={copy}>
          {copied() ? 'Copied' : 'Copy'}
        </button>
        <span class="sr-only" aria-live="polite">
          {copied() ? 'Copied to the clipboard' : ''}
        </span>
      </div>
    </landing-command>
  );
}
