/**
 * Every page's markdown, addressed by its route.
 *
 * `src/content` holds all of it. The workspace's decision records are not part of the site: they
 * are notes this project keeps for itself about why it is built the way it is, not documentation
 * for someone building an app.
 */
import type { DocArtName } from './doc-art.tsx';
import type { DocBlock, DocHeading } from '../build/markdown.ts';

export interface DocModule {
  readonly attributes: {
    readonly title?: string;
    readonly summary?: string;
    /** A drawing for the top of the page; see `doc-art.ts`. */
    readonly art?: DocArtName;
  };
  readonly headings: readonly DocHeading[];
  readonly blocks: readonly DocBlock[];
}

const pages = import.meta.glob<DocModule>('./content/**/*.md');

/** `guide/architecture` -> the loader for `src/content/guide/architecture.md`. */
function route(path: string): (() => Promise<DocModule>) | undefined {
  return pages[`./content/${path}.md`];
}

export function loadDoc(path: string): (() => Promise<DocModule>) | undefined {
  return route(path.replace(/^\/+|\/+$/g, ''));
}
