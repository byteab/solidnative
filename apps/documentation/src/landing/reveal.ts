/**
 * Fades an element up into place the first time it scrolls into view, then leaves it alone.
 *
 * Used as `ref={reveal}` on an element that also carries the `reveal` class. A one-shot trigger,
 * not a scroll-linked animation: once shown, scrolling does nothing to it. Anything already on
 * screen when the page boots is shown at once, so the prerendered page never blinks out and back
 * in, and `prefers-reduced-motion` skips the effect entirely. The hidden state only applies under
 * `html.reveal-armed`, which is set here rather than in the markup, so the prerendered page - and
 * a browser without JavaScript - shows everything.
 *
 * Classes are toggled directly rather than through a binding, so an element is marked shown in the
 * same frame the page is armed.
 */
import { onCleanup, onMount } from 'solid-js';

export function reveal(element: HTMLElement): void {
  let observer: IntersectionObserver | undefined;
  onCleanup(() => observer?.disconnect());
  onMount(() => {
    const onScreen = element.getBoundingClientRect().top < innerHeight;
    if (onScreen || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.classList.add('is-shown');
      return;
    }
    document.documentElement.classList.add('reveal-armed');
    observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.classList.add('is-shown');
        observer?.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    observer.observe(element);
  });
}
