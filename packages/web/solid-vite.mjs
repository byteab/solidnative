import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const VITE_MARKS = new Set(['v', 't', 'import']);

/** Solid universal browser host plus explicit Solid DOM pages. */
export function solidNativeWeb() {
  let runtime, compiler, dom, native, deviceDirectory;
  const local = createRequire(import.meta.url);
  return [
    {
      name: 'solid-native:solid-browser',
      enforce: 'pre',
      config() {
        return {
          optimizeDeps: {
            exclude: [
              '@solid-native/platform',
              '@solid-native/components',
              '@solid-native/device',
              '@solid-native/icons',
              '@solid-native/web',
              'solid-js',
            ],
          },
        };
      },
      configResolved(config) {
        const require = createRequire(path.join(config.root, 'package.json'));
        let metro;
        try {
          metro = require.resolve('@solid-native/metro/solid-browser.cjs');
        } catch {
          metro = local.resolve('@solid-native/metro/solid-browser.cjs');
        }
        const tooling = createRequire(metro);
        compiler = tooling('./solid-browser.cjs');
        native = tooling('./solid-transform.cjs');
        dom = tooling('./solid-dom.cjs');
        runtime = tooling('./solid-runtime.cjs').createSolidRuntime(config.root);
        deviceDirectory = path.dirname(local.resolve('@solid-native/device/solid'));
      },
      async resolveId(id, importer) {
        // Replace only the device package's lazy native source. A direct native import still
        // fails below, and unsupported services fail on use instead of claiming a capability.
        if (/(?:^|\/)react-native\.(?:ts|js)$/.test(id)) {
          const resolved = await this.resolve(id, importer, { skipSelf: true });
          if (
            resolved &&
            path.dirname(resolved.id) === deviceDirectory &&
            /^react-native\.(?:ts|js)$/.test(path.basename(resolved.id))
          )
            return '\0solid-browser-native-unavailable';
        }
        if (id.endsWith('.native.css')) {
          const resolved = await this.resolve(id, importer, { skipSelf: true });
          if (resolved) return `\0solid-browser-css:${resolved.id}.js`;
        }
        if (id === '@solid-native/platform/solid') return local.resolve('@solid-native/web/solid');
        const resolved =
          id === 'solid-js/web' ? `${runtime.root}/web/dist/web.js` : runtime.resolve(id);
        if (resolved) return resolved;
        if (/^react-native(?:\/|$)/.test(id))
          throw new Error(`Unsupported runtime import in a Solid browser build: ${id}`);
        return null;
      },
      load(id) {
        if (id === '\0solid-browser-native-unavailable')
          return 'export function reactNative() { throw new Error("This device service needs a browser source override; React Native is unavailable in the browser host."); }';
        if (!id.startsWith('\0solid-browser-css:')) return null;
        const filename = id.slice('\0solid-browser-css:'.length, -3);
        this.addWatchFile(filename);
        return `export default ${JSON.stringify(compiler.compileBrowserCss(readFileSync(filename, 'utf8'), filename))};`;
      },
      transform(source, id) {
        const [filename, query] = id.split('?');
        if (/\.native\.css$/.test(filename)) {
          // `?raw`, `?url`, `?inline`... are other plugins' imports of the file: only a plain import
          // (or Vite's own cache-busting `?v=`/`?t=`/`?import` marks) is compiled as a stylesheet.
          if (query && [...new URLSearchParams(query).keys()].some((key) => !VITE_MARKS.has(key)))
            return null;
          return {
            code: `export default ${JSON.stringify(compiler.compileBrowserCss(source, filename))};`,
            map: null,
          };
        }
        if (dom.isSolidDomSource(source, filename)) return dom.transformSolidDom(source, filename);
        if (native.isSolidSource(source, filename))
          return compiler.transformSolidBrowser(source, filename);
        return null;
      },
      handleHotUpdate(context) {
        // Explicit clean reload: a new page disposes all roots/listeners, with no React Refresh.
        if (/\.(?:solid\.[jt]sx?|native\.css)$/.test(context.file)) {
          context.server.ws.send({ type: 'full-reload' });
          return [];
        }
      },
    },
  ];
}
