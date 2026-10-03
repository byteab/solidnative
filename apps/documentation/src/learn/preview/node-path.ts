/**
 * Node's `path`, POSIX only and as much of it as Babel calls in the page: the learner's files are
 * names without directories. Aliased in `vite.config.ts`.
 */
function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}

export const sep = '/';
export const delimiter = ':';

export function resolve(...paths: string[]): string {
  let path = '/';
  for (const part of paths) if (part) path = part.startsWith('/') ? part : `${path}/${part}`;
  return normalize(path);
}

export function join(...paths: string[]): string {
  return normalize(paths.join('/'));
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

export function basename(path: string, ext?: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}

export function extname(path: string): string {
  const base = basename(path);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot) : '';
}

export function dirname(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash <= 0 ? '/' : path.slice(0, slash);
}

export function relative(from: string, to: string): string {
  const a = resolve(from).split('/').filter(Boolean);
  const b = resolve(to).split('/').filter(Boolean);
  let shared = 0;
  while (shared < a.length && a[shared] === b[shared]) shared++;
  return [...a.slice(shared).map(() => '..'), ...b.slice(shared)].join('/');
}

export default { sep, delimiter, resolve, join, isAbsolute, basename, extname, dirname, relative };
