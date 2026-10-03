/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { FeedGallery } from '../src/app/feed/feed-post.solid.tsx';
/** Reassigns the actual gallery exactly as a recycled VirtualList slot does. */
export function galleryFixture() {
  let replace!: (id: string, page: number) => void;
  const changes: number[] = [];
  function Gallery() {
    const [post, setPost] = createSignal({ id: 'a', page: 0 });
    replace = (id, page) => setPost({ id, page });
    return (
      <FeedGallery
        postId={post().id}
        initialPage={post().page}
        images={[0, 1, 2].map((index) => ({ uri: `image-${index}`, aspect: 1.5 }))}
        onPageChange={(page) => changes.push(page)}
      />
    );
  }
  return { Gallery, replace: (id: string, page: number) => replace(id, page), changes };
}
