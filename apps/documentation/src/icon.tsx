/** @jsxImportSource solid-js */
/**
 * A Lucide icon in the site's own chrome, drawn as inline SVG in `currentColor`.
 *
 * The markup is an `<svg-icon>` box sized by `--icon-size` (1em unless `size` says otherwise)
 * around the SVG, which the classes and CSS sizing the chrome's icons target. The paths are in
 * `icon.data.ts`.
 */
import { LUCIDE, type IconName } from './icon.data.ts';

export type { IconName };

export interface IconProps {
  readonly name: IconName;
  readonly class?: string;
  /** A number is pixels; a string is used as written (`'1.25rem'`), or as pixels when it is bare. */
  readonly size?: number | string;
}

function cssSize(size: number | string | undefined): string | undefined {
  if (size === undefined) return undefined;
  return typeof size === 'number' || /^\d+(\.\d+)?$/.test(size) ? `${size}px` : size;
}

export function Icon(props: IconProps) {
  return (
    <svg-icon
      class={props.class}
      role="img"
      aria-hidden="true"
      style={{ '--icon-size': cssSize(props.size) }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        innerHTML={LUCIDE[props.name]}
      />
    </svg-icon>
  );
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      /** The box around an icon's SVG, which the classes sizing icons target. */
      'svg-icon': HTMLAttributes<HTMLElement>;
    }
  }
}
