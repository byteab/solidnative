/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createRenderEffect, createSignal } from 'solid-js';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  type ScrollViewRef,
} from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { For, Show, withNativeStyles } from '@solid-native/platform/solid';
import type { Post, PostImage } from './feed-backend.solid.ts';
import gallerySheet from './feed-gallery.native.css';
import sheet from './feed-post.native.css';

export function FeedGallery(props: {
  postId: string;
  images: readonly PostImage[];
  initialPage?: number;
  onPageChange?: (page: number) => void;
}) {
  const front = useService(SCREEN_IN_FRONT);
  const [pager, setPager] = createSignal<ScrollViewRef>();
  const [width, setWidth] = createSignal(0),
    [page, setPage] = createSignal(0);
  const frame = createMemo(() =>
    width()
      ? { width: width(), height: Math.round(width() / (props.images[0]?.aspect ?? 1.5)) }
      : { height: 220 },
  );
  createRenderEffect(() => {
    props.postId;
    const next = props.initialPage ?? 0;
    setPage(next);
    if (front() && width()) pager()?.scrollTo({ x: next * width(), animated: false });
  });
  return withNativeStyles(gallerySheet, () => (
    <View
      class="gallery"
      onLayout={(event) => {
        const next = event.nativeEvent?.layout?.width ?? 0;
        if (next) setWidth(next);
      }}
    >
      <ScrollView
        ref={setPager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={frame()}
        onMomentumScrollEnd={(event) => {
          if (!front() || !width()) return;
          const next = Math.round((event.nativeEvent?.contentOffset?.x ?? 0) / width());
          if (next !== page()) {
            setPage(next);
            props.onPageChange?.(next);
          }
        }}
      >
        <For each={props.images}>
          {(image) => <Image source={{ uri: image.uri }} style={frame()} resizeMode="cover" />}
        </For>
      </ScrollView>
      <Text class="counter">
        {page() + 1}/{props.images.length}
      </Text>
    </View>
  ));
}

export function FeedPost(props: {
  post: Post;
  galleryPage?: number;
  onLike: () => void;
  onBookmark: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onGalleryPage: (page: number) => void;
}) {
  return withNativeStyles(sheet, () => (
    <View class="post">
      <View class="byline">
        <Text class="author">{props.post.author}</Text>
        <Text class="hint">{props.post.id}</Text>
      </View>
      <Text class="body">{props.post.text}</Text>
      <Show when={props.post.kind === 'photo'}>
        <Image
          class="photo"
          source={{ uri: props.post.images[0]!.uri }}
          style={{ aspectRatio: props.post.images[0]!.aspect }}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel={'Photo by ' + props.post.author}
        />
      </Show>
      <Show when={props.post.kind === 'gallery'}>
        <FeedGallery
          postId={props.post.id}
          images={props.post.images}
          initialPage={props.galleryPage}
          onPageChange={props.onGalleryPage}
        />
      </Show>
      <View class="actions">
        <Pressable
          class="action"
          accessibilityRole="button"
          accessibilityLabel={
            (props.post.liked ? 'Unlike, ' : 'Like, ') + props.post.likes + ' likes'
          }
          accessibilityState={{ selected: props.post.liked }}
          onPress={props.onLike}
        >
          <Text class={props.post.liked ? 'action-label on' : 'action-label'}>
            {props.post.liked ? 'Liked' : 'Like'} {props.post.likes}
          </Text>
        </Pressable>
        <Pressable
          class="action"
          accessibilityRole="button"
          accessibilityLabel={props.post.bookmarked ? 'Remove bookmark' : 'Bookmark'}
          accessibilityState={{ selected: props.post.bookmarked }}
          onPress={props.onBookmark}
        >
          <Text class={props.post.bookmarked ? 'action-label on' : 'action-label'}>
            {props.post.bookmarked ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
        <Pressable
          class="action"
          accessibilityRole="button"
          accessibilityLabel="Edit"
          onPress={props.onEdit}
        >
          <Text class="action-label">Edit</Text>
        </Pressable>
        <Pressable
          class="action"
          accessibilityRole="button"
          accessibilityLabel="Delete"
          onPress={props.onRemove}
        >
          <Text class="action-label danger">Delete</Text>
        </Pressable>
      </View>
    </View>
  ));
}
