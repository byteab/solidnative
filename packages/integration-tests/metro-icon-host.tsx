/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Icon, IconProvider } from '@solidnative/icons/solid';

/** A real lucide icon, verbatim as `lucide-static` ships it: multi-line markup, `currentColor`. */
export const Flame = `
<svg
  class="lucide lucide-flame"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
</svg>
`;

/**
 * Geometry rather than a path, which is how lucide draws half its set - copied from the real
 * `Target`, with a polyline added because lucide ships none and the conversion needs exercising.
 */
export const Target = `
<svg
  class="lucide lucide-target"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="12" cy="12" r="10" />
  <circle cx="12" cy="12" r="6" />
  <circle cx="12" cy="12" r="2" />
  <polyline points="4,4 8,8 12,4" />
</svg>
`;

/** Four icons: one by name from a provider, raw markup, labelled markup, a string size. */
export function iconHost() {
  const [size, setSize] = createSignal(24);
  const [color] = createSignal('#ff9f0a');
  /** An element no native view draws, beside one that is drawn. */
  const [odd, setOdd] = createSignal(
    '<svg viewBox="0 0 24 24"><text>x</text><circle r="1"/></svg>',
  );
  function IconHost() {
    return (
      <IconProvider icons={{ Flame }}>
        <Icon testID="named" name="flame" size={size()} color={color()} />
        <Icon testID="raw" svg={Target} strokeWidth={3} />
        <Icon testID="labelled" svg={odd()} accessibilityLabel="Target" />
        <Icon testID="static" svg={Target} size="32" />
      </IconProvider>
    );
  }
  return { IconHost, setSize, setOdd };
}
