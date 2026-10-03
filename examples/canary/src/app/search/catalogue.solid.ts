import { createSignal } from 'solid-js';
import { createServiceToken } from '@solid-native/device/solid';
export type Scope = 'all' | 'album' | 'artist' | 'song';

export interface CatalogueItem {
  readonly id: string;
  readonly kind: Exclude<Scope, 'all'>;
  readonly title: string;
  readonly subtitle: string;
}

const ARTISTS = [
  'Miles Davis',
  'John Coltrane',
  'Nina Simone',
  'Bill Evans',
  'Ella Fitzgerald',
  'Chet Baker',
];
const WORDS = [
  'Blue',
  'Night',
  'Train',
  'Moon',
  'River',
  'Kind',
  'Giant',
  'Steps',
  'Autumn',
  'Sketches',
  'Round',
  'Midnight',
];

function build(): CatalogueItem[] {
  const items: CatalogueItem[] = ARTISTS.map((name, i) => ({
    id: `r${i}`,
    kind: 'artist',
    title: name,
    subtitle: 'Artist',
  }));
  for (let i = 0; i < 1200; i++) {
    const a = WORDS[i % WORDS.length]!;
    const b = WORDS[(i * 7 + 3) % WORDS.length]!;
    const artist = ARTISTS[i % ARTISTS.length]!;
    const kind = i % 5 === 0 ? 'album' : 'song';
    items.push({
      id: `i${i}`,
      kind,
      title: `${a} ${b} ${i}`,
      subtitle: `${kind === 'album' ? 'Album' : 'Song'} by ${artist}`,
    });
  }
  return items;
}

/** The catalogue on the device, for filtering as the user types. */
export const CATALOGUE: readonly CatalogueItem[] = build();

export function matches(item: CatalogueItem, query: string, scope: Scope): boolean {
  if (scope !== 'all' && item.kind !== scope) return false;
  const q = query.trim().toLowerCase();
  return !q || item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q);
}

export interface StoreSearch {
  latency: number;
  failing: boolean;
  requests: number;
  cancelled: number;
  find(query: string, scope: Scope, signal?: AbortSignal): Promise<CatalogueItem[]>;
}
export function createStoreSearch(): StoreSearch {
  const store: StoreSearch = {
    latency: 500,
    failing: false,
    requests: 0,
    cancelled: 0,
    find(query, scope, signal) {
      store.requests++;
      return new Promise((resolve, reject) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const abort = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
          store.cancelled++;
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        };
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) {
          abort();
          return;
        }
        timer = setTimeout(
          () => {
            settled = true;
            signal?.removeEventListener('abort', abort);
            if (store.failing) {
              reject(new Error('The store is unreachable'));
              return;
            }
            resolve(
              Array.from({ length: 8 }, (_, i) => ({
                id: `s-${query}-${i}`,
                kind: scope === 'all' ? (['album', 'song', 'artist'] as const)[i % 3]! : scope,
                title: `${query} (store ${i + 1})`,
                subtitle: 'In the store',
              })),
            );
          },
          store.latency + Math.max(0, 6 - query.length) * 60,
        );
      });
    },
  };
  return store;
}
export const StoreSearch = createServiceToken<StoreSearch>('StoreSearch', createStoreSearch);
export function createRecentSearches() {
  const [items, setItems] = createSignal<readonly string[]>(['Coltrane', 'Blue Train']);
  return {
    items,
    remember(query: string) {
      const q = query.trim();
      if (q)
        setItems((items) =>
          [q, ...items.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 6),
        );
    },
    forget(query: string) {
      setItems((items) => items.filter((item) => item !== query));
    },
  };
}
export type RecentSearches = ReturnType<typeof createRecentSearches>;
export const RecentSearches = createServiceToken<RecentSearches>(
  'RecentSearches',
  createRecentSearches,
);
