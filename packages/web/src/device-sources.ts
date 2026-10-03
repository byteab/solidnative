/**
 * The device capabilities, answered by the browser.
 *
 * `@solidnative/device` reaches React Native for these, and its factories all fall back to
 * doing nothing off a device - which is what makes that package importable by a test suite, and
 * what made it quietly wrong here. Nothing was provided in place of the fallbacks, so on the web
 * `Screen` reported a window of **zero by zero**, permanently.
 *
 * That is not a cosmetic gap. `Screen.compact()` is `width < 768`, so every component that
 * branches on it took the phone tree: the sidebar rendered its mobile sheet instead of its rail
 * in a 1200pt browser window. `anchored-overlay.ts` clamps a popover against `screen.window()`,
 * so every anchored overlay was being fitted into a zero-sized screen. Neither failed loudly.
 *
 * Found by opening the gallery rather than by reading, and it could only have been found that
 * way: jsdom reports a window too, and the tests that mount through `mount` never asked what
 * size it was.
 */
import type {
  ColorSchemeSource,
  DirectionSource,
  LayoutDirection,
  ScreenSource,
  Sizes,
} from '@solidnative/device';

/**
 * `Screen`, from the browser's own viewport.
 *
 * `window` is what the app can draw in and `screen` is the display, which is the same distinction
 * React Native draws - on Android the window excludes the system bars, and here it excludes the
 * browser's own chrome. `resize` covers a rotation, a window drag and a devtools pane opening,
 * all of which are the same event as far as a layout is concerned.
 */
export function browserScreenSource(view: Window): ScreenSource {
  const sizes = (): Sizes => ({
    window: { width: view.innerWidth, height: view.innerHeight },
    screen: {
      width: view.screen?.width ?? view.innerWidth,
      height: view.screen?.height ?? view.innerHeight,
    },
  });
  return {
    current: sizes,
    subscribe: (listener) => {
      const onResize = () => listener(sizes());
      view.addEventListener('resize', onResize);
      return () => view.removeEventListener('resize', onResize);
    },
  };
}

/**
 * `ColorScheme`, from `prefers-color-scheme`.
 *
 * The same thing the native source reads off the OS, and the reason `Theme` can default to the
 * system scheme on both platforms rather than always starting light.
 */
export function browserColorSchemeSource(view: Window): ColorSchemeSource {
  const query = view.matchMedia?.('(prefers-color-scheme: dark)');
  return {
    current: () => (query?.matches ? 'dark' : 'light'),
    subscribe: (listener) => {
      if (!query) return () => {};
      const onChange = (event: MediaQueryListEvent) => listener(event.matches ? 'dark' : 'light');
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
  };
}

/**
 * Locales written right to left, by language subtag or by script subtag.
 *
 * Lifted from CDK's `directionality.ts`, which lifted it from Closure's `goog.i18n.bidi`. It only
 * has to answer `dir="auto"`, which is HTML for "work it out": the browser works it out from the
 * *content*, which means walking the text of the page, and CDK settled long ago that the language
 * is a good enough approximation to be worth the four lines. Same trade here.
 */
const RTL_LOCALE =
  /^(ar|ckb|dv|he|iw|fa|nqo|ps|sd|ug|ur|yi|.*[-_](Adlm|Arab|Hebr|Nkoo|Rohg|Thaa))(?!.*[-_](Latn|Cyrl)($|-|_))($|-|_)/i;

function resolve(raw: string | null | undefined, view: Window): LayoutDirection {
  const value = raw?.toLowerCase() ?? '';
  if (value === 'auto') return RTL_LOCALE.test(view.navigator?.language ?? '') ? 'rtl' : 'ltr';
  return value === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * `Direction`, from the document.
 *
 * `<html dir>` is where a web app says this, and `<body dir>` is where a framework that could not
 * reach the `<html>` element says it instead - so body wins, which is the order CDK reads them in
 * and the order the cascade itself resolves them in.
 *
 * Unlike the native source this one really can change: `dir` is an attribute, and an app with a
 * language switcher flips it without reloading. A `MutationObserver` on the two elements is what
 * makes the signal follow, so a component that placed a popover to the left redraws it to the
 * right rather than waiting for a refresh.
 *
 * The parameter is `Window & typeof globalThis` rather than `Window`, unlike the two sources
 * above: the observer is constructed off the view rather than off the ambient global, so a page
 * hosting a second document - an iframe, or the jsdom the tests mount into - observes with its
 * own. `Window` alone does not declare the constructor; `document.defaultView` already has this
 * type, so no caller notices.
 */
export function browserDirectionSource(view: Window & typeof globalThis): DirectionSource {
  const document = view.document;
  const read = () =>
    resolve(
      document.body?.getAttribute('dir') ?? document.documentElement?.getAttribute('dir'),
      view,
    );

  return {
    current: read,
    subscribe: (listener) => {
      if (typeof view.MutationObserver !== 'function') return () => {};
      const observer = new view.MutationObserver(() => listener(read()));
      const options = { attributes: true, attributeFilter: ['dir'] };
      if (document.documentElement) observer.observe(document.documentElement, options);
      if (document.body) observer.observe(document.body, options);
      return () => observer.disconnect();
    },
  };
}
