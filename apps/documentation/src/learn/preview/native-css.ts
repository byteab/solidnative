/**
 * The native CSS compiler (`@solidnative/metro/css/*.cjs`), unmodified, running in the page on
 * lightningcss's WebAssembly build, so the preview can say what a device build would say about a
 * component's CSS: a browser will happily draw `display: grid`, and a phone build drops it with a
 * warning.
 *
 * Loaded on first use, because the WebAssembly is 3.8 MB compressed. `frame.ts` decides when that
 * is: a check that reads styles, a test that reads props, or the first run after the learner
 * changes a stylesheet or a class.
 *
 * The CommonJS files arrive as text, in a chunk of their own (`native-css-sources.ts`) fetched
 * with the WebAssembly, and run with a `require` that answers `lightningcss` with the WebAssembly
 * build and each sibling with its own exports. The one Node global they touch is `Buffer.from`,
 * for the source handed to lightningcss.
 */
const BufferShim = { from: (text: string) => new TextEncoder().encode(text) };

/** A compiled sheet, as the engine reads it off a component class. */
export interface NativeSheet {
  readonly rules: readonly unknown[];
}

type CompileCss = (
  css: string,
  context?: string,
  options?: { onUnsupported?: (message: string) => void },
) => NativeSheet;

interface Compiler {
  readonly compileCss: CompileCss;
  readonly flattenTailwind: (css: string) => string;
}

let compiler: Promise<Compiler> | undefined;

async function load(): Promise<Compiler> {
  const [lightning, { default: wasm }, { SOURCES }] = await Promise.all([
    import('lightningcss-wasm'),
    import('lightningcss-wasm/lightningcss_node.wasm?url'),
    import('./native-css-sources.ts'),
  ]);
  await lightning.default(wasm);
  // Node's lightningcss hands back a Buffer, whose `toString()` is the text; the WebAssembly
  // build hands back a Uint8Array, whose `toString()` is a list of numbers.
  const decoder = new TextDecoder();
  const transform: typeof lightning.transform = (options) => {
    const result = lightning.transform(options);
    return { ...result, code: { toString: () => decoder.decode(result.code) } as Uint8Array };
  };
  const cache: Record<string, unknown> = {};
  const require = (specifier: string): unknown => {
    if (specifier === 'lightningcss') return { ...lightning, transform };
    // `flatten.cjs` names the compiler by its package; the rest are siblings.
    const id = specifier.replace(/^@solidnative\/metro\/css\//, './');
    if (id in cache) return cache[id];
    const source = SOURCES[id];
    if (!source) throw new Error(`The native CSS compiler asked for ${id}, which is not here.`);
    const module = { exports: {} as unknown };
    cache[id] = module.exports;
    new Function(
      'require',
      'module',
      'exports',
      'Buffer',
      `${source}\n//# sourceURL=native-css/${id}`,
    )(require, module, module.exports, BufferShim);
    cache[id] = module.exports;
    return module.exports;
  };
  return {
    compileCss: (require('./compile.cjs') as { compileCss: CompileCss }).compileCss,
    flattenTailwind: (require('./flatten.cjs') as Compiler).flattenTailwind,
  };
}

/**
 * The last few compiles, by their input. Every check run and every run's notes compile the same
 * CSS again until the learner changes it, and Tailwind's is the length of a stylesheet. A sheet
 * can be handed out more than once: a component's is shared by every mount of it on a device too.
 */
const compiled = new Map<string, unknown>();
const REMEMBERED = 32;

function remember<T>(key: string, compile: () => T): T {
  if (compiled.has(key)) return compiled.get(key) as T;
  const result = compile();
  compiled.set(key, result);
  if (compiled.size > REMEMBERED) compiled.delete(compiled.keys().next().value!);
  return result;
}

/**
 * A stylesheet through the native compiler, as a device build compiles it: its rules, with each
 * declaration or rule native cannot express dropped, and `dropped` the warning a device build
 * prints for each. `error` is CSS that does not parse, which a device build stops on.
 */
export async function compileNativeCss(
  css: string,
  context: string,
): Promise<{ sheet?: NativeSheet; dropped: string[]; error?: string }> {
  compiler ??= load();
  const { compileCss } = await compiler;
  return remember(`${context}\n${css}`, () => {
    const dropped: string[] = [];
    try {
      const sheet = compileCss(css, context, { onUnsupported: (message) => dropped.push(message) });
      return { sheet, dropped };
    } catch (error) {
      return { dropped, error: (error as Error).message };
    }
  });
}

/**
 * Tailwind's CSS as a device build compiles it: flattened, then compiled with every declaration
 * native cannot express dropped and reported, as `@solidnative/tailwind`'s build step does.
 * `dropped` is what a device build would warn about.
 */
export async function compileNativeTailwind(
  css: string,
): Promise<{ sheet?: NativeSheet; dropped: string[]; error?: string }> {
  compiler ??= load();
  const { compileCss, flattenTailwind } = await compiler;
  return remember(`Tailwind\n${css}`, () => {
    const dropped: string[] = [];
    try {
      const sheet = compileCss(flattenTailwind(css), 'Tailwind', {
        // A leftover custom property was already substituted, so it is not the app's concern.
        onUnsupported: (message) => {
          if (!message.includes("dropped '--")) dropped.push(message);
        },
      });
      return { sheet, dropped };
    } catch (error) {
      return { dropped, error: (error as Error).message };
    }
  });
}
