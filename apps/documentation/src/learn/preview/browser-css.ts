/**
 * A `.native.css` file as the phone's browser host draws it: scoped to the components that pass
 * it to `withNativeStyles`, in the shape `@solid-native/web/solid` takes, `{ browser, id, css }`.
 *
 * `@solid-native/metro/solid-browser.cjs` does the same for a Vite build with lightningcss. The page
 * already has a CSS parser, so the preview uses that instead and leaves the 3.8 MB WebAssembly
 * build to the native compiler (`native-css.ts`), which only some runs need. The scoping is the
 * same: every compound selector gets the sheet's `data-s-<id>` attribute, before any
 * pseudo-element, and `:host` becomes `data-h-<id>`.
 */
export interface BrowserSheet {
  readonly browser: true;
  readonly id: string;
  readonly css: string;
}

/**
 * `text` split wherever `at` is true of a character outside brackets, parentheses and quotes, with
 * each such character kept as a part of its own.
 */
const NESTING: Readonly<Record<string, number>> = { '(': 1, '[': 1, ')': -1, ']': -1 };

function splitTop(text: string, at: (char: string) => boolean): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char in NESTING) depth += NESTING[char]!;
    else if (depth === 0 && at(char)) {
      parts.push(text.slice(start, index), char);
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** Where a compound's pseudo-element (`::before`) starts, or its length if it has none. */
function pseudoElementAt(compound: string): number {
  let depth = 0;
  for (let index = 0; index < compound.length - 1; index++) {
    const char = compound[index]!;
    if (char in NESTING) depth += NESTING[char]!;
    else if (depth === 0 && char === ':' && compound[index + 1] === ':') return index;
  }
  return compound.length;
}

function scopeCompound(compound: string, id: string): string {
  const host = /^:host(?:\((.*)\))?(.*)$/s.exec(compound);
  if (host) return `[data-h-${id}]${host[1] ?? ''}${host[2]}`;
  const at = pseudoElementAt(compound);
  return `${compound.slice(0, at)}[data-s-${id}]${compound.slice(at)}`;
}

/** One selector list, scoped to sheet `id`. */
export function scopeSelector(selector: string, id: string): string {
  return splitTop(selector, (char) => char === ',')
    .filter((part) => part !== ',')
    .map((complex) =>
      splitTop(complex.trim(), (char) => /[\s>+~]/.test(char))
        .map((part) => (part && !/^[\s>+~]$/.test(part) ? scopeCompound(part, id) : part))
        .join(''),
    )
    .join(', ');
}

/** A short, stable id for a sheet: FNV-1a over its file name and text, twice over, as hex. */
export function sheetId(file: string, css: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (const char of `${file}\0${css}`) {
    const code = char.charCodeAt(0);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x811c9dc5) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

function scopeRules(rules: CSSRuleList, id: string): void {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) rule.selectorText = scopeSelector(rule.selectorText, id);
    if ('cssRules' in rule) scopeRules((rule as CSSGroupingRule).cssRules, id);
  }
}

/** The file, parsed by the page and scoped. What the page cannot parse, it leaves out. */
export function browserSheet(css: string, file: string): BrowserSheet {
  const id = sheetId(file, css);
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  scopeRules(sheet.cssRules, id);
  return { browser: true, id, css: [...sheet.cssRules].map((rule) => rule.cssText).join('\n') };
}
