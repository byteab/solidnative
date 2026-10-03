/** One decoded value, or all values when a query key occurs more than once. */
export type RouteQuery = Readonly<Record<string, string | readonly string[]>>;
export type RouteData = Readonly<Record<string, unknown>>;

export interface RouteLocation {
  readonly url: string;
  /** Per-navigation app state; separate from URL and route inputs. */
  readonly state?: RouteData;
  /** Encoded, absolute app pathname. Full external URLs belong to the linking adapter. */
  readonly pathname: string;
  readonly query: RouteQuery;
  readonly fragment: string | undefined;
}

export interface RouteMatch extends RouteLocation {
  readonly params: Readonly<Record<string, string>>;
  readonly data: RouteData;
  /** Query < path params < static data < resolved data. Absent keys read undefined. */
  readonly inputs: RouteData;
}

const decode = (text: string): string => decodeURIComponent(text);

function normalizePath(rawPath: string, base: string): string {
  const path = !rawPath
    ? base
    : rawPath.startsWith('/')
      ? rawPath
      : `${base.slice(0, base.lastIndexOf('/') + 1)}${rawPath}`;
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else {
      decode(part); // Invalid URI sequences fail before navigation mutates any owners.
      parts.push(part);
    }
  }
  return `/${parts.join('/')}`;
}

function parseQuery(queryText: string): RouteQuery {
  const query: Record<string, string | readonly string[]> = Object.create(null);
  for (const pair of queryText.split('&')) {
    if (!pair) continue;
    const equal = pair.indexOf('=');
    const key = decode((equal < 0 ? pair : pair.slice(0, equal)).replace(/\+/g, ' '));
    const value = decode((equal < 0 ? '' : pair.slice(equal + 1)).replace(/\+/g, ' '));
    const previous = query[key];
    query[key] =
      previous === undefined
        ? value
        : Object.freeze([...(Array.isArray(previous) ? previous : [previous]), value]);
  }
  return Object.freeze(query);
}

/** Resolve relative paths against the current route's directory, like URL resolution. */
export function parseRouteLocation(url: string, base = '/'): RouteLocation {
  if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//'))
    throw new Error('Native navigation accepts app paths; external URLs require linking.');
  const hash = url.indexOf('#');
  const fragment = hash < 0 ? undefined : decode(url.slice(hash + 1));
  const beforeHash = hash < 0 ? url : url.slice(0, hash);
  const question = beforeHash.indexOf('?');
  const rawPath = question < 0 ? beforeHash : beforeHash.slice(0, question);
  const queryText = question < 0 ? '' : beforeHash.slice(question + 1);
  const pathname = normalizePath(rawPath, base);
  return Object.freeze({
    url: pathname + (question < 0 ? '' : `?${queryText}`) + (hash < 0 ? '' : url.slice(hash)),
    pathname,
    query: parseQuery(queryText),
    fragment,
  });
}

export interface PathMatch {
  readonly params: Readonly<Record<string, string>>;
  readonly score: number;
}

/** Exact flat-route matching: literal segments outrank :params, which outrank a final *. */
export function matchRoutePath(pattern: string, pathname: string): PathMatch | undefined {
  const expected = pattern.split('/').filter(Boolean);
  const actual = pathname.split('/').filter(Boolean).map(decode);
  const params: Record<string, string> = Object.create(null);
  let score = 0;
  for (let index = 0; index < expected.length; index++) {
    const segment = expected[index]!;
    if (segment === '*' && index === expected.length - 1) {
      params['*'] = actual.slice(index).join('/');
      return { params: Object.freeze(params), score };
    }
    const value = actual[index];
    if (value === undefined) return undefined;
    if (segment.startsWith(':') && segment.length > 1) {
      params[segment.slice(1)] = value;
      score += 2;
    } else if (decode(segment) === value) score += 3;
    else return undefined;
  }
  return expected.length === actual.length
    ? { params: Object.freeze(params), score: score + 1 }
    : undefined;
}

export function createRouteMatch(
  location: RouteLocation,
  params: Readonly<Record<string, string>>,
  data: RouteData,
): RouteMatch {
  return Object.freeze({
    ...location,
    params,
    data: Object.freeze({ ...data }),
    inputs: Object.freeze({ ...location.query, ...params, ...data }),
  });
}

const ROUTE_KEYS = ['url', 'state', 'pathname', 'query', 'fragment', 'params', 'data', 'inputs'];

/** A RouteMatch whose fields read through `read`, so a reactive source keeps them current. */
export function liveRouteMatch(read: () => RouteMatch): RouteMatch {
  const view = {};
  for (const key of ROUTE_KEYS)
    Object.defineProperty(view, key, {
      enumerable: true,
      get: () => read()[key as keyof RouteMatch],
    });
  return Object.freeze(view) as RouteMatch;
}
