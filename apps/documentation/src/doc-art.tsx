/** @jsxImportSource solid-js */
/**
 * A small line drawing at the top of a component's page, saying what kind of thing it is before a
 * word is read: a switch looks like a switch, a list like rows.
 *
 * The landing page's glyph style - ink strokes, one blue accent - on a 64-unit square, set on a
 * plate of dot grid. A page asks for one with `art: <name>` in its front matter. Drawings, not
 * screenshots: they stay true in dark mode and cost nothing to load.
 */
import { For, type JSX } from 'solid-js';
import './doc-art.css';

export const DOC_ART = [
  'layout',
  'safe-area',
  'scroll-view',
  'keyboard-avoiding-view',
  'lists',
  'text',
  'image',
  'activity-indicator',
  'input',
  'switch',
  'pressable',
  'gestures',
  'modal',
  'animation',
] as const;

export type DocArtName = (typeof DOC_ART)[number];

/** Rows outside the blue viewport lines are drawn dashed: a virtual list has not made them. */
function row(y: number): string {
  return y < 14 || y > 46 ? 'ink faint dashed' : 'ink';
}

/** An activity indicator's eight spokes, fading behind the leading one. */
const SPOKES = Array.from({ length: 8 }, (_, index) => {
  const angle = -90 + index * -45;
  const radians = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  const at = (radius: number) => `${32 + cos * radius} ${32 + sin * radius}`;
  return { angle, d: `M${at(9)}L${at(18)}`, opacity: 1 - index * 0.11 };
});

const DRAWINGS: Record<DocArtName, () => JSX.Element> = {
  layout: () => (
    <>
      <rect x="8" y="12" width="48" height="40" rx="3" class="ink" />
      <rect x="13" y="17" width="12" height="30" rx="2" class="ink" />
      <rect x="29" y="17" width="22" height="13" rx="2" class="ink" />
      <rect x="29" y="34" width="22" height="13" rx="2" class="accent" />
    </>
  ),
  'safe-area': () => (
    <>
      <rect x="18" y="6" width="28" height="52" rx="6" class="ink" />
      <rect x="27" y="9.5" width="10" height="3" rx="1.5" class="ink-fill" />
      <rect x="21.5" y="16" width="21" height="34" rx="2" class="accent dashed" />
      <path d="M28 54h8" class="ink" />
    </>
  ),
  'scroll-view': () => (
    <>
      <rect x="18" y="6" width="28" height="52" rx="6" class="ink" />
      <path d="M23 15h14M23 22h11M23 29h14M23 36h9M23 43h14M23 50h11" class="ink faint" />
      <path d="M41.5 17v12" class="accent" />
    </>
  ),
  'keyboard-avoiding-view': () => (
    <>
      <rect x="18" y="6" width="28" height="52" rx="6" class="ink" />
      <rect x="21" y="38" width="22" height="16" rx="2" class="ink" />
      <path
        d="M25 42.5h2M31 42.5h2M37 42.5h2M25 46.5h2M31 46.5h2M37 46.5h2M28 50.5h8"
        class="ink"
      />
      <rect x="22" y="28" width="20" height="6" rx="2" class="accent" />
      <path d="M32 24v-8M29 19l3-3 3 3" class="ink faint" />
    </>
  ),
  lists: () => (
    <>
      <path d="M9 14h46M9 46h46" class="accent" />
      <For each={[8, 20, 30, 40, 52]}>
        {(y) => (
          <>
            <circle cx="15" cy={y} r="2.5" class={row(y)} />
            <path d={`M21 ${y}h28`} class={row(y)} />
          </>
        )}
      </For>
    </>
  ),
  text: () => (
    <>
      <text x="10" y="36" class="glyph-type">
        Aa
      </text>
      <path d="M44 20v18" class="accent" />
      <path d="M10 46h44M10 53h30" class="ink faint" />
    </>
  ),
  image: () => (
    <>
      <rect x="10" y="14" width="44" height="36" rx="3" class="ink" />
      <path d="M14 45l11-12 8 8 6-6 11 10" class="ink" />
      <circle cx="43" cy="24" r="4" class="accent" />
    </>
  ),
  'activity-indicator': () => (
    <For each={SPOKES}>
      {(spoke, index) => (
        <path d={spoke.d} class={index() === 0 ? 'accent' : 'ink'} opacity={spoke.opacity} />
      )}
    </For>
  ),
  input: () => (
    <>
      <path d="M8 15h16" class="ink faint" />
      <rect x="8" y="21" width="48" height="20" rx="4" class="ink" />
      <path d="M14 31h14" class="ink" />
      <path d="M31 26v10" class="accent" />
    </>
  ),
  switch: () => (
    <>
      <rect x="14" y="22" width="36" height="20" rx="10" class="ink" />
      <circle cx="40" cy="32" r="7" class="accent-fill" />
    </>
  ),
  pressable: () => (
    <>
      <rect x="10" y="24" width="44" height="16" rx="8" class="ink" />
      <circle cx="38" cy="32" r="9" class="accent faint" />
      <circle cx="38" cy="32" r="3" class="accent-fill" />
    </>
  ),
  gestures: () => (
    <>
      <circle cx="26" cy="38" r="3" class="accent-fill" />
      <circle cx="38" cy="26" r="3" class="accent-fill" />
      <path d="M22 42l-8 8M14 44v6h6" class="ink" />
      <path d="M42 22l8-8M44 14h6v6" class="ink" />
    </>
  ),
  modal: () => (
    <>
      <rect x="18" y="6" width="28" height="52" rx="6" class="ink" />
      <path d="M23 15h14M23 21h10" class="ink faint" />
      <path d="M21 53V35a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v18" class="accent" />
      <path d="M29 35h6" class="accent" />
      <path d="M23 26h18" class="ink faint" />
    </>
  ),
  animation: () => (
    <>
      <path d="M38 17h-7M40 22h-10" class="accent faint" />
      <circle cx="14" cy="46" r="3.5" class="ink" opacity="0.25" />
      <circle cx="25" cy="39" r="3.5" class="ink" opacity="0.45" />
      <circle cx="35" cy="28" r="3.5" class="ink" opacity="0.7" />
      <circle cx="49" cy="20" r="4.5" class="accent-fill" />
    </>
  ),
};

export function DocArt(props: { name: DocArtName }) {
  return (
    <doc-art class="doc-art">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        {DRAWINGS[props.name]?.()}
      </svg>
    </doc-art>
  );
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      /** This component's host tag. */
      'doc-art': HTMLAttributes<HTMLElement>;
    }
  }
}
