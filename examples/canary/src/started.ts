/**
 * The first line of the app, imported before anything else so that everything else is measured.
 *
 * ES modules hoist their imports, so a timestamp at the top of `main.solid.ts` runs *after* Solid,
 * the router and every component module have already been evaluated - which is most of the work.
 * A module of its own, imported first, is the only place that catches them.
 */
(globalThis as { __started?: number }).__started ??= Date.now();
