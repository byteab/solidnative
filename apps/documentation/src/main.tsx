/** @jsxImportSource solid-js */
/**
 * The entry point: the site's chrome, rendered with Solid's DOM renderer into `<app-root>`.
 *
 * The components the site is *about* are not drawn this way: each one is a universal component
 * mounted separately into an island of its own by `@solidnative/web/solid`. See `example.tsx`.
 *
 * A prerendered page arrives with its snapshot already inside `<app-root>` (see
 * `build/prerender.ts`). It stays on screen until the router has the first page ready, and is then
 * replaced rather than hydrated: the snapshot is inert markup, and Solid renders beside whatever
 * the element already holds.
 */
import { render } from 'solid-js/web';
import { App } from './app.tsx';
import { startRouter } from './router.ts';
import './styles.css';

const host = document.querySelector('app-root');
if (!host) throw new Error('index.html has no <app-root>');

void startRouter().then(() => {
  host.replaceChildren();
  render(() => <App />, host);
});
