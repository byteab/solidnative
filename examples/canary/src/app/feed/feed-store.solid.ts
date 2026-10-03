import { batch, createMemo, createSignal, onCleanup } from 'solid-js';
import { useService } from '@solid-native/device/solid';
import { FeedBackend, type Post } from './feed-backend.solid.ts';

export type PageState = 'idle' | 'loading' | 'failed' | 'done';
/** Screen-owned feed. Retained coverage keeps data; disposal invalidates every request. */
export function createFeedStore(backend = useService(FeedBackend)) {
  const [posts, setPosts] = createSignal<readonly Post[]>([]);
  const [pageState, setPageState] = createSignal<PageState>('idle');
  const [refreshing, setRefreshing] = createSignal(false);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [unseen, setUnseen] = createSignal(0);
  let active = true,
    generation = 0,
    sequence = 0,
    pageRequests = 0;
  let next: number | null | undefined;
  const confirmed = new Map<string, { liked: boolean; bookmarked: boolean }>();
  const latest = new Map<string, number>();
  const galleryPages = new Map<string, number>();
  const valid = (epoch: number) => active && generation === epoch;
  const find = (id: string) => posts().find((post) => post.id === id);
  const patch = (id: string, change: Partial<Post>) => {
    if (active && Object.keys(change).length)
      setPosts((current) =>
        current.map((post) => (post.id === id ? { ...post, ...change } : post)),
      );
  };
  const fresh = (incoming: readonly Post[]) => {
    const ids = new Set(posts().map((post) => post.id));
    return incoming.filter((post) => !ids.has(post.id));
  };
  const remember = (incoming: readonly Post[]) => {
    for (const post of incoming)
      if (!confirmed.has(post.id))
        confirmed.set(post.id, { liked: post.liked, bookmarked: post.bookmarked });
  };
  async function loadMore() {
    if (!active || pageState() === 'loading' || next === null) return;
    const epoch = generation,
      cursor = next ?? null;
    setPageState('loading');
    if (!valid(epoch)) return;
    pageRequests++;
    try {
      const page = await backend.page(cursor);
      if (!valid(epoch)) return;
      next = page.next;
      const incoming = fresh(page.posts);
      remember(incoming);
      batch(() => {
        setPosts((current) => [...current, ...incoming]);
        setPageState(page.next === null ? 'done' : 'idle');
      });
    } catch {
      if (valid(epoch)) setPageState('failed');
    }
  }
  async function reset() {
    if (!active) return;
    generation++;
    const epoch = generation;
    next = undefined;
    confirmed.clear();
    latest.clear();
    galleryPages.clear();
    batch(() => {
      setPosts([]);
      setPageState('idle');
      setRefreshing(false);
      setUnseen(0);
      setNotice(null);
    });
    if (valid(epoch)) await loadMore();
  }
  async function refresh() {
    if (!active || refreshing()) return;
    const top = posts()[0];
    if (!top) return reset();
    const epoch = generation;
    setRefreshing(true);
    if (!valid(epoch)) return;
    try {
      const arrived = await backend.newer(Number(top.id.slice(1)));
      if (!valid(epoch)) return;
      const incoming = fresh(arrived);
      remember(incoming);
      batch(() => {
        setPosts((current) => [...incoming, ...current]);
        setUnseen((count) => count + incoming.length);
      });
    } catch {
      if (valid(epoch)) setNotice('Could not refresh the feed');
    } finally {
      if (valid(epoch)) setRefreshing(false);
    }
  }
  async function loadMany(count: number) {
    const epoch = generation,
      latency = backend.latency;
    backend.latency = 0;
    try {
      while (valid(epoch) && posts().length < count && pageState() !== 'done') {
        // A concurrent page owns progress; do not spin microtasks while it awaits a timer.
        if (pageState() === 'loading') break;
        await loadMore();
        if (pageState() === 'failed') break;
      }
    } finally {
      backend.latency = latency;
    }
  }
  function toggle(id: string, field: 'liked' | 'bookmarked') {
    const post = find(id);
    if (!active || !post) return;
    const value = !post[field],
      epoch = generation,
      mine = ++sequence,
      key = `${id}:${field}`;
    latest.set(key, mine);
    patch(
      id,
      field === 'liked'
        ? { liked: value, likes: post.likes + (value ? 1 : -1) }
        : { bookmarked: value },
    );
    if (!valid(epoch) || latest.get(key) !== mine) return;
    const currentRequest = () => valid(epoch) && latest.get(key) === mine;
    let request: Promise<void>;
    try {
      request = field === 'liked' ? backend.setLiked(id, value) : backend.setBookmarked(id, value);
    } catch (error) {
      request = Promise.reject(error);
    }
    request.then(
      () => {
        if (!currentRequest()) return;
        const saved = confirmed.get(id);
        if (saved) saved[field] = value;
      },
      () => {
        if (!currentRequest()) return;
        const current = find(id),
          saved = confirmed.get(id);
        if (!current || !saved) return;
        batch(() => {
          patch(
            id,
            field === 'liked'
              ? {
                  liked: saved.liked,
                  likes: current.likes + (saved.liked === current.liked ? 0 : saved.liked ? 1 : -1),
                }
              : { bookmarked: saved.bookmarked },
          );
          setNotice(field === 'liked' ? 'Could not like the post' : 'Could not save the bookmark');
        });
      },
    );
  }
  onCleanup(() => {
    active = false;
    generation++;
    latest.clear();
  });
  return {
    posts,
    pageState,
    refreshing,
    notice,
    unseen,
    initialLoading: createMemo(() => posts().length === 0 && pageState() === 'loading'),
    get pageRequests() {
      return pageRequests;
    },
    loadMore,
    reset,
    refresh,
    loadMany,
    toggleLike: (id: string) => toggle(id, 'liked'),
    toggleBookmark: (id: string) => toggle(id, 'bookmarked'),
    remove(id: string) {
      if (active) setPosts((current) => current.filter((post) => post.id !== id));
      latest.delete(`${id}:liked`);
      latest.delete(`${id}:bookmarked`);
    },
    edit(id: string) {
      const post = find(id);
      if (post)
        patch(id, {
          revision: post.revision + 1,
          text: `${post.text.replace(/ \(edited \d+\)$/, '')} (edited ${post.revision + 1})`,
        });
    },
    galleryPage: (id: string) => galleryPages.get(id) ?? 0,
    setGalleryPage(id: string, page: number) {
      if (active) galleryPages.set(id, page);
    },
    markSeen() {
      if (active) setUnseen(0);
    },
    dismissNotice() {
      if (active) setNotice(null);
    },
  };
}
