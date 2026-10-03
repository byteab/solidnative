/**
 * The documentation site's build.
 *
 * The site's own pages are Solid DOM and the components the site is about are Solid universal
 * components rendered by the browser host; `solidNativeWeb()` from `@solid-native/web/solid/vite`
 * compiles both (see `packages/web/solid-vite.mjs`).
 *
 * `markdown()` turns `.md` into a module the app can render, `source()` hands a component's own
 * source text to the page that shows it running, and `api()` reads every Solid component's props
 * and every exported service out of the workspace's own source so the reference pages cannot drift
 * from the code they describe. `exampleSources()` does the same for the example apps' code browser,
 * reading each app's Solid files out of `examples/`.
 *
 * The course's preview compiles the learner's TSX in the browser with Babel and Solid's JSX
 * transform. Both come from `@solid-native/metro`'s own dependencies, resolved the way
 * `solidNativeWeb()` loads its tooling, so the site adds no compiler of its own. `path` and
 * `assert` are the two Node built-ins Babel reaches for; they get small local stand-ins.
 */
import tailwindcss from '@tailwindcss/vite';
import { solidNativeWeb } from '@solid-native/web/solid/vite';
import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import url from 'node:url';
import { api } from './build/api.ts';
import { exampleSources } from './build/example-sources.ts';
import { learnNative } from './build/learn-native.ts';
import { markdown } from './build/markdown.ts';
import { source } from './build/source.ts';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(dirname, '../..');
const dist = path.resolve(dirname, 'dist');
const tooling = createRequire(
  createRequire(path.join(dirname, 'package.json')).resolve(
    '@solid-native/metro/solid-browser.cjs',
  ),
);
const preview = path.resolve(dirname, 'src/learn/preview');

/**
 * `vite preview`, taught the one lookup Cloudflare Pages does and it does not.
 *
 * `build/prerender.ts` writes each route's snapshot to `dist/<route>.html`, which Pages serves at
 * `/<route>`. Vite's preview server only tries `<route>.html` when the request ends in a slash, so
 * `/packages/components/touch` would land on the SPA fallback - the home page, for every route,
 * which looks exactly like prerendering having silently failed.
 */
function previewPrerendered(): Plugin {
  return {
    name: 'documentation:preview-prerendered',
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        const [route = '/', search] = (request.url ?? '/').split('?');
        const file = `${route.replace(/\/$/, '')}.html`;
        if (!path.extname(route) && fs.existsSync(path.join(dist, file))) {
          request.url = `${file}${search ? `?${search}` : ''}`;
        }
        next();
      });
    },
  };
}

/**
 * What `public/_headers` has Cloudflare Pages send with `/assets/*`: the course's preview frame is
 * sandboxed into an opaque origin, so everything it loads is a cross-origin request and needs this.
 * See `src/learn/protocol.ts`.
 */
const ASSET_HEADERS = { 'Access-Control-Allow-Origin': '*' };

/**
 * The dev server and `vite preview`, sending `ASSET_HEADERS` as the host does.
 *
 * A middleware rather than `server.headers` and `preview.headers`, for a reason on each side:
 *
 * - In development the frame's modules come from `/src`, `/@fs`, `/@vite` and
 *   `/node_modules/.vite` rather than one directory, so every response gets the header. And
 *   `server.headers` only reaches Vite's own responses, not the component modules a plugin
 *   serves itself, which the frame then fails to load.
 * - `preview.headers` goes on every response and cannot be scoped to a path. The course's
 *   end-to-end tests run against `vite preview`, so it sends the header with `/assets/*` only, as
 *   `public/_headers` does, and a frame that loaded anything from elsewhere fails there too.
 */
function crossOriginAssets(): Plugin {
  const send = (response: ServerResponse) => {
    for (const [name, value] of Object.entries(ASSET_HEADERS)) response.setHeader(name, value);
  };
  return {
    name: 'documentation:cross-origin-assets',
    configureServer(server) {
      server.middlewares.use((_request, response, next) => {
        send(response);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.startsWith('/assets/')) send(response);
        next();
      });
    },
  };
}

export default defineConfig({
  root: dirname,
  // Vite only exposes an env var to `import.meta.env` (and to `%NAME%` substitution in
  // `index.html`) when its name starts with one of these prefixes, precisely so a build cannot
  // leak an arbitrary environment variable into the client bundle by accident. `SITE_URL` is
  // meant to reach the client - `src/site.ts` reads it back as `import.meta.env.SITE_URL` to
  // build canonical and Open Graph URLs - so it is opted in here rather than renamed to
  // `VITE_SITE_URL`, which is not the name a preview-deploy script would already know to set.
  envPrefix: ['VITE_', 'SITE_'],
  server: {
    port: 5201,
    // `build/api.ts` reads every package's TypeScript out of the workspace, and the pages import
    // the module it generates. Vite's dev server refuses to serve a file outside its own root
    // without being told.
    fs: { allow: [workspaceRoot] },
  },
  plugins: [
    previewPrerendered(),
    crossOriginAssets(),
    markdown(),
    api(workspaceRoot),
    source(),
    exampleSources(workspaceRoot),
    learnNative(),
    ...solidNativeWeb(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@babel/core': tooling.resolve('@babel/core'),
      'babel-preset-solid': tooling.resolve('babel-preset-solid'),
      '@babel/plugin-transform-typescript': tooling.resolve('@babel/plugin-transform-typescript'),
      path: path.join(preview, 'node-path.ts'),
      assert: path.join(preview, 'node-assert.cjs'),
    },
  },
  optimizeDeps: {
    // `lightningcss-wasm` loads its own WebAssembly by URL, which pre-bundling would break.
    exclude: ['lightningcss-wasm'],
  },
  build: {
    rollupOptions: {
      // The site, and the course's preview frame: a page of its own, so that the learner's code,
      // Tailwind's browser build and the phone's platform classes stay out of the lesson page. See
      // `src/learn/preview/frame.ts`.
      input: {
        main: path.resolve(dirname, 'index.html'),
        preview: path.resolve(dirname, 'learn-preview.html'),
      },
    },
  },
});
