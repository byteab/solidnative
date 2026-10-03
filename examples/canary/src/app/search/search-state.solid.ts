import { batch, createMemo, createRenderEffect, createSignal, onCleanup, untrack } from 'solid-js';
import {
  CATALOGUE,
  matches,
  type CatalogueItem,
  type Scope,
  type StoreSearch,
} from './catalogue.solid.ts';

export type SearchRow =
  | { readonly kind: 'heading'; readonly id: string; readonly text: string }
  | { readonly kind: 'item'; readonly id: string; readonly item: CatalogueItem }
  | {
      readonly kind: 'status';
      readonly id: string;
      readonly status: 'loading' | 'failed' | 'none';
    };

/** Each request and debounce belongs to the retained search screen, until final disposal. */
export function createSearchState(store: StoreSearch, debounceMs = 300) {
  const [query, setQuery] = createSignal('');
  const [scope, setScope] = createSignal<Scope>('all');
  const [settled, setSettled] = createSignal('');
  const [revision, setRevision] = createSignal(0);
  const [remote, setRemote] = createSignal<readonly CatalogueItem[]>([]);
  const [status, setStatus] = createSignal<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;
  const current = (work: AbortController) => active && request === work && !work.signal.aborted;
  const load = (q: string, kind: Scope) => {
    if (!active) return;
    const previous = request;
    const work = new AbortController();
    request = work;
    previous?.abort();
    if (!current(work)) return;
    batch(() => {
      setRemote([]);
      setStatus(q.length < 2 ? 'idle' : 'loading');
    });
    if (q.length < 2 || !current(work)) return;
    void Promise.resolve()
      .then(() => (current(work) ? store.find(q, kind, work.signal) : []))
      .then(
        (items) => {
          if (current(work))
            batch(() => {
              setRemote(items);
              setStatus('ready');
            });
        },
        () => {
          if (current(work)) setStatus('failed');
        },
      );
  };
  createRenderEffect(() => {
    const value = query();
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (active) setSettled(value);
    }, debounceMs);
  });
  createRenderEffect(() => {
    const q = settled().trim(),
      kind = scope();
    revision();
    untrack(() => load(q, kind));
  });
  onCleanup(() => {
    active = false;
    clearTimeout(timer);
    const previous = request;
    request = undefined;
    previous?.abort();
  });
  const local = createMemo(() => CATALOGUE.filter((item) => matches(item, query(), scope())));
  const rows = createMemo<SearchRow[]>(() => {
    const rows: SearchRow[] = [
      { kind: 'heading', id: 'h-library', text: `In your library (${local().length})` },
      ...local()
        .slice(0, 20)
        .map((item) => ({ kind: 'item' as const, id: item.id, item })),
    ];
    if (settled().trim().length < 2) return rows;
    rows.push({ kind: 'heading', id: 'h-store', text: 'In the store' });
    if (status() === 'loading' || status() === 'failed')
      rows.push({ kind: 'status', id: `s-${status()}`, status: status() as 'loading' | 'failed' });
    else if (!remote().length) rows.push({ kind: 'status', id: 's-none', status: 'none' });
    else for (const item of remote()) rows.push({ kind: 'item', id: item.id, item });
    return rows;
  });
  return {
    query,
    setQuery,
    scope,
    setScope,
    local,
    rows,
    status,
    remote,
    submit(value: string) {
      if (active) {
        clearTimeout(timer);
        setSettled(value);
      }
    },
    reload() {
      if (active) setRevision((value) => value + 1);
    },
  };
}
