import { createServiceToken, useService } from '@solidnative/device/solid';

export type PostKind = 'text' | 'photo' | 'gallery';

export interface PostImage {
  readonly uri: string;
  /** Width over height, as a real API sends it, so the row reserves its space before it loads. */
  readonly aspect: number;
}

export interface Post {
  readonly id: string;
  readonly kind: PostKind;
  readonly author: string;
  readonly text: string;
  readonly images: readonly PostImage[];
  readonly likes: number;
  readonly liked: boolean;
  readonly bookmarked: boolean;
  /** Bumped by an edit, so a replaced post is visibly the new one. */
  readonly revision: number;
}

export interface FeedPage {
  readonly posts: readonly Post[];
  /** Where the next page starts, or null at the end of the feed. */
  readonly next: number | null;
}

const AUTHORS = ['Ada', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Frances'];
const WORDS =
  'native views scroll fast when the list recycles rows and measures each one once so the feed stays smooth under a thumb that never stops'.split(
    ' ',
  );

/** A small deterministic generator, so a given post is the same post on every run. */
function seeded(seed: number): () => number {
  let state = seed * 2654435761;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

export function makePost(n: number, revision = 0): Post {
  const random = seeded(n + 1);
  const kinds: PostKind[] = ['text', 'text', 'photo', 'gallery'];
  const kind = kinds[Math.floor(random() * kinds.length)]!;
  const length = 6 + Math.floor(random() * (kind === 'text' ? 60 : 18));
  const text = Array.from({ length }, () => WORDS[Math.floor(random() * WORDS.length)]).join(' ');
  const image = (i: number): PostImage => ({
    uri: `https://picsum.photos/seed/an${n}x${i}/600/400`,
    aspect: [1.5, 1, 0.8, 1.78][Math.floor(random() * 4)]!,
  });
  const images =
    kind === 'photo'
      ? [image(0)]
      : kind === 'gallery'
        ? Array.from({ length: 3 + Math.floor(random() * 4) }, (_, i) => image(i))
        : [];
  return {
    id: `p${n}`,
    kind,
    author: AUTHORS[n % AUTHORS.length]!,
    text: revision ? `${text} (edited ${revision})` : text,
    images,
    likes: Math.floor(random() * 500),
    liked: false,
    bookmarked: false,
    revision,
  };
}

/**
 * The server the feed talks to, simulated: latency, paging, new posts appearing at the top, and
 * failures on demand. A test replaces the timing with `latency = 0` and drives failures directly.
 */
export class FeedBackendSource {
  /** Milliseconds each request takes. */
  latency = 450;
  /** Every request fails while this is set, as it would offline. */
  offline = false;
  /** The next request fails, once. */
  failNext = false;
  /** Posts on the server, newest has the highest number. The feed starts at post 100000. */
  private newest = 100_000;
  /** How many posts the server has in total, going back from the newest. */
  readonly total = 20_000;
  /** Server-side likes, which a like request writes. */
  private readonly likes = new Map<string, boolean>();

  /** Older posts, starting at `cursor` (a post number) and going back. */
  page(cursor: number | null, size = 25): Promise<FeedPage> {
    return this.respond(() => {
      const start = cursor ?? this.newest;
      const oldest = this.newest - this.total;
      const posts: Post[] = [];
      for (let n = start; n > Math.max(oldest, start - size); n--) posts.push(this.withLike(n));
      const next = start - size > oldest ? start - size : null;
      return { posts, next };
    });
  }

  /** Posts newer than `since`, which is what a pull to refresh asks for. */
  newer(since: number, arrived = 3): Promise<readonly Post[]> {
    return this.respond(() => {
      this.newest += arrived;
      const posts: Post[] = [];
      for (let n = this.newest; n > since; n--) posts.push(this.withLike(n));
      return posts;
    });
  }

  setLiked(id: string, liked: boolean): Promise<void> {
    return this.respond(() => {
      this.likes.set(id, liked);
    });
  }

  setBookmarked(_id: string, _bookmarked: boolean): Promise<void> {
    return this.respond(() => undefined);
  }

  private withLike(n: number): Post {
    const post = makePost(n);
    const liked = this.likes.get(post.id);
    return liked === undefined ? post : { ...post, liked, likes: post.likes + (liked ? 1 : 0) };
  }

  private respond<T>(answer: () => T): Promise<T> {
    const fail = this.offline || this.failNext;
    this.failNext = false;
    return new Promise((resolve, reject) => {
      const settle = () =>
        fail ? reject(new Error('The network is unreachable')) : resolve(answer());
      if (this.latency === 0) queueMicrotask(settle);
      else setTimeout(settle, this.latency);
    });
  }
}

/** Lazy scoped source seam; importing the data never loads a framework/native module. */
export type FeedBackend = Pick<FeedBackendSource, keyof FeedBackendSource>;
const source = createServiceToken<FeedBackend>('FeedBackend.source', () => new FeedBackendSource());
export const FeedBackend = Object.freeze({
  ...createServiceToken<FeedBackend>('FeedBackend', () => useService(source)),
  SOURCE: source,
});
