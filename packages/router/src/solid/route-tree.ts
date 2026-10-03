import type { NativeRoute } from './native-navigation.ts';
import {
  createRouteMatch,
  matchRoutePath,
  parseRouteLocation,
  type RouteMatch,
} from './route-match.ts';

export interface RouteSelection {
  readonly definition: NativeRoute;
  readonly match: RouteMatch;
}

/** Match complete leaf paths, then recover each layout's consumed path and inherited params. */
export function selectRouteTree(routes: readonly NativeRoute[], url: string): RouteSelection[] {
  const location = parseRouteLocation(url);
  const candidates: { chain: { definition: NativeRoute; path: string }[]; score: number }[] = [];
  function visit(
    definitions: readonly NativeRoute[],
    prefix: string,
    chain: { definition: NativeRoute; path: string }[],
  ): void {
    for (const definition of definitions) {
      const path = `${prefix}/${definition.path}`.replace(/\/+/g, '/');
      const next = [...chain, { definition, path }];
      if (definition.children?.length) visit(definition.children, path, next);
      else {
        const match = matchRoutePath(path, location.pathname);
        if (match) candidates.push({ chain: next, score: match.score });
      }
    }
  }
  visit(routes, '', []);
  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  if (!selected) throw new Error(`No native route matches ${location.pathname}.`);
  const segments = location.pathname.split('/').filter(Boolean);
  return selected.chain.map(({ definition, path }, index) => {
    const pathname =
      index === selected.chain.length - 1
        ? location.pathname
        : `/${segments.slice(0, path.split('/').filter(Boolean).length).join('/')}`;
    const match = matchRoutePath(path, pathname)!;
    return {
      definition,
      match: createRouteMatch(
        { ...location, pathname, url: pathname + location.url.slice(location.pathname.length) },
        match.params,
        definition.data ?? {},
      ),
    };
  });
}
