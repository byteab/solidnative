/**
 * Extracts every ```ts and ```tsx code block from the docs content, so they can be typechecked
 * against the real packages. Used by `docs-samples.test.ts`.
 *
 * A block is "partial" when it could never stand on its own: it contains a bare `...` elision, or
 * it never declares or imports anything, which is what a fragment inside a larger snippet or a
 * config-file patch reads like. Partial blocks are still counted and listed, just not typechecked.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export interface DocSample {
  file: string;
  line: number;
  code: string;
  /** The fence language, which is also the fixture's extension. */
  lang: 'ts' | 'tsx';
  /**
   * A browser page rather than a native screen: a DOM component (`@jsxImportSource solid-js`) or
   * code on `@solidnative/web`/`solid-js/web`. Checked with the DOM lib; everything else without it.
   */
  dom: boolean;
  /** Why this block is skipped, or undefined if it should be typechecked. */
  skipReason?: string;
}

const CONTENT_ROOT = path.resolve(import.meta.dirname, '../../apps/documentation/src/content');

function markdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...markdownFiles(full));
    } else if (entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

// A bare `...` line, or a comment that uses one as an elision marker (`// ...and elsewhere:`).
// Restricted to comments so it never catches a real `...rest` or `{ ...spread }` in code.
const ELLIPSIS_LINE = /^\s*(\.\.\.|\/\/.*\.\.\..*)\s*$/m;
const HAS_TOP_LEVEL_DECLARATION = /^\s*(import|export|const|let|class|function|interface|type|@)/m;
const HAS_IMPORT = /^\s*import\b/m;

/**
 * Structural check only - blocks that reference class members or fragments the surrounding prose
 * supplies but the fence does not are caught later, once compiling them has said so; see
 * `isFragment` in docs-samples.test.ts.
 *
 * A block with no `import` at all is skipped here rather than left for that later pass: without
 * one, an unimported name that happens to share a name with a React Native global (`screen`,
 * `name`, `location`, ...) type-checks against that global instead of failing as "not found", so
 * the fragment would pass or fail for reasons that have nothing to do with whether the docs are
 * right. Every sample this project treats as a real, checkable program already imports what it
 * uses, matching the worked examples throughout the docs.
 */
export function structuralSkipReason(code: string): string | undefined {
  if (ELLIPSIS_LINE.test(code)) return 'partial (contains an elision)';
  if (!HAS_TOP_LEVEL_DECLARATION.test(code)) return 'partial (no top-level declaration)';
  if (!HAS_IMPORT.test(code))
    return 'partial (no import - assumes context shown elsewhere on the page)';
  return undefined;
}

const DOM_SAMPLE = /@jsxImportSource solid-js\b|from '(solid-js\/web|@solidnative\/web[^']*)'/;

/** Every ```ts/```tsx fenced block in every docs markdown file, in file order. */
export function extractDocSamples(): DocSample[] {
  const samples: DocSample[] = [];
  for (const file of markdownFiles(CONTENT_ROOT)) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    let inBlock = false;
    let start = 0;
    let lang: DocSample['lang'] = 'ts';
    let body: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inBlock && (line.trim() === '```ts' || line.trim() === '```tsx')) {
        inBlock = true;
        lang = line.trim() === '```ts' ? 'ts' : 'tsx';
        start = i + 2;
        body = [];
      } else if (inBlock && line.trim() === '```') {
        inBlock = false;
        const code = body.join('\n');
        samples.push({
          file: path.relative(CONTENT_ROOT, file),
          line: start,
          code,
          lang,
          dom: DOM_SAMPLE.test(code),
          skipReason: structuralSkipReason(code),
        });
      } else if (inBlock) {
        body.push(line);
      }
    }
  }
  return samples;
}
