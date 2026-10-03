/**
 * `reset.css`'s content, as a string `mount()` can inject with no bundler CSS loader required.
 *
 * A second copy of `reset.css`, because this package ships raw TypeScript with no build step of
 * its own (see `package.json`), so there is nothing here to run a codegen script as part of. A
 * consumer with no CSS loader in their bundler still gets a working stylesheet from
 * `mount({ injectReset: true })` alone, and an app that would rather control ordering against
 * Tailwind imports the `.css` file instead.
 *
 * `reset.css` is the one to read and to edit. This one carries the same rules with the comments
 * stripped, and `reset-parity.test.ts` fails the moment the two disagree about a single
 * declaration - which is not a nicety. The first edit after this file was written landed in the
 * `.css` only, and the version `mount` actually injects would have gone on shipping the old
 * rules with nothing to say so.
 */
export const RESET_CSS = `
[data-rn] {
  box-sizing: border-box;
  position: relative;
  flex-shrink: 0;
  min-width: 0;
  min-height: 0;
}

[data-rn]:where(:not([data-rn='root'])) {
  border-width: 0;
  border-style: solid;
  border-color: black;
}

html,
body {
  height: 100%;
}

[data-rn-root] {
  height: 100%;
  display: flex;
  flex-direction: column;
}

body {
  font-family: var(
    --font-sans,
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    'Helvetica Neue',
    Arial,
    sans-serif
  );
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

[data-rn]:not([data-rn='text']) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

[data-rn='text'] {
  display: inline;
}

[data-rn='scroll-view'],
[data-rn='virtual-list'] {
  flex-grow: 1;
  flex-shrink: 1;
  flex-direction: column;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

[data-rn='scroll-view'][flexdirection='row'] {
  flex-direction: row;
}

[data-rn='scroll-view'][scrollenabled='false'] {
  overflow: hidden;
}

[data-rn='image'] {
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}

:where([data-rn='image']) {
  width: var(--rn-intrinsic-width, auto);
  height: var(--rn-intrinsic-height, auto);
}

[data-rn='modal'] {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgb(0 0 0 / 50%);
}
[data-rn='modal'][hidden] {
  display: none;
}

[data-rn='input-accessory-view'] {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
}

[data-rn='activity-indicator'] {
  color: #999999;
}
[data-rn='activity-indicator']::after {
  content: '';
  box-sizing: border-box;
  flex: 1;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: rn-activity-indicator 0.8s linear infinite;
}
[data-rn='activity-indicator'][animating='false']::after {
  animation-play-state: paused;
}
[data-rn='activity-indicator'][animating='false']:not([hideswhenstopped='false'])::after {
  visibility: hidden;
}
@keyframes rn-activity-indicator {
  to {
    transform: rotate(360deg);
  }
}

[data-rn='text-input'] {
  background-color: transparent;
  font: inherit;
  color: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  margin: 0;
  padding: 0;
  resize: none;
}

[data-rn='text-input']::placeholder {
  /* A device draws an unset placeholder grey; this is the text colour, faded, on any theme. */
  color: var(--rn-placeholder-color, color-mix(in srgb, currentColor 45%, transparent));
}
`;

/**
 * The reset for an island inside someone else's page: `RESET_CSS` without the two rules that
 * reach outside the island.
 *
 * `html, body { height: 100% }` and `body`'s font are right for a page this package owns, and
 * wrong for a page it is a guest on - they would resize and re-font the host app around the
 * island. So they go, and the font moves onto `[data-rn-root]`, where text inside the island
 * still inherits it. Derived rather than written out, so it cannot drift from `RESET_CSS`.
 */
export const ISLAND_RESET_CSS = RESET_CSS.replace(/html,\s*body\s*\{[^}]*\}\s*/, '').replace(
  /(^|\n)body\s*\{/,
  '$1[data-rn-root] {',
);
