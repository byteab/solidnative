/**
 * What React Native accepts, read from its own type declarations: every style prop by name, and
 * for a prop that takes keywords, which ones.
 *
 * The engine writes props for React Native to read, and a prop it does not know, or a keyword it
 * does not take, is ignored on device with at most a log line. Reading the installed version's
 * types means a React Native upgrade that renames or drops one fails a test here.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = dirname(require.resolve('react-native/package.json'));

/** The declaration files the style and component props are in. */
const FILES = [
  'Libraries/StyleSheet/StyleSheetTypes.d.ts',
  'Libraries/Image/ImageResizeMode.d.ts',
  'Libraries/Text/Text.d.ts',
  'Libraries/Components/View/ViewPropTypes.d.ts',
];

/** The interfaces whose members are props the engine may write. */
const INTERFACES = [
  'FlexStyle',
  'ShadowStyleIOS',
  'TransformsStyle',
  'ViewStyle',
  'TextStyle',
  'TextStyleIOS',
  'TextStyleAndroid',
  'ImageStyle',
  'TextProps',
  'TextPropsIOS',
  'TextPropsAndroid',
];

export interface ReactNativeProps {
  /** Every prop name the interfaces declare. */
  readonly names: ReadonlySet<string>;
  /** For a prop whose type is keywords only, the keywords. */
  readonly keywords: ReadonlyMap<string, ReadonlySet<string>>;
}

let cached: ReactNativeProps | undefined;

export function reactNativeProps(): ReactNativeProps {
  return (cached ??= read());
}

function read(): ReactNativeProps {
  const source = FILES.map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');
  const aliases = new Map<string, string>();
  for (const [, name, type] of source.matchAll(/export type (\w+)\s*=\s*([^;]+);/g)) {
    aliases.set(name!, type!);
  }
  const names = new Set<string>();
  const keywords = new Map<string, Set<string>>();
  for (const name of INTERFACES) {
    const body = interfaceBody(source, name);
    if (body === null) continue;
    for (const [, prop, type] of body.matchAll(/^\s*(\w+)\?:\s*([^;]+);/gm)) {
      names.add(prop!);
      // Declared in more than one interface, `overflow` for one: a view takes `scroll`, an image
      // does not, and any of them is a value React Native reads.
      const literals = keywordsOf(type!, aliases);
      if (literals) keywords.set(prop!, new Set([...(keywords.get(prop!) ?? []), ...literals]));
    }
  }
  return { names, keywords };
}

/** The text between an interface's braces, braces inside it included. */
function interfaceBody(source: string, name: string): string | null {
  const start = source.search(new RegExp(`interface ${name}\\b[^{]*\\{`));
  if (start === -1) return null;
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0)
      return source.slice(source.indexOf('{', start) + 1, i);
  }
  return null;
}

/**
 * A type's keywords, when it is nothing but keywords, directly or through aliases that are:
 * `'auto' | 'top' | undefined`, or `BlendMode | undefined`. Null for anything else.
 */
function keywordsOf(
  type: string,
  aliases: ReadonlyMap<string, string>,
  seen = new Set<string>(),
): Set<string> | null {
  const out = new Set<string>();
  for (const raw of type
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)) {
    if (raw === 'undefined' || raw === 'null') continue;
    const literal = /^'([^']*)'$/.exec(raw);
    if (literal) {
      out.add(literal[1]!);
      continue;
    }
    const alias = aliases.get(raw);
    if (alias === undefined || seen.has(raw)) return null;
    const inner = keywordsOf(alias, aliases, new Set([...seen, raw]));
    if (inner === null) return null;
    for (const word of inner) out.add(word);
  }
  return out.size ? out : null;
}
