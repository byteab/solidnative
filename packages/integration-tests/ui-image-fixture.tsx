/** @jsxImportSource @solid-native/platform/solid */
import { Image, ImageBackground } from '@solid-native/components';
import { withNativeStyles } from '@solid-native/platform/solid';
import sheet from './ui-image.native.css';

const art = { uri: 'a.jpg', width: 600, height: 300 };

export function RoundedImage() {
  return (
    <Image
      nativeID="photo"
      source={{ uri: 'a.jpg' }}
      style={{ width: 72, height: 72, borderRadius: 12 }}
    />
  );
}

export function ListenedImage() {
  return (
    <>
      <Image nativeID="listened" source={{ uri: 'a.jpg' }} onLoad={() => {}} />
      <Image nativeID="quiet" source={{ uri: 'b.jpg' }} />
    </>
  );
}

export function IntrinsicImage() {
  return withNativeStyles(sheet, () => (
    <>
      <Image nativeID="bare" source={art} />
      <Image nativeID="classed" source={art} class="size-11" />
      <Image nativeID="width-rule" source={art} class="thumb" />
      <Image nativeID="height-rule" source={art} class="tall" />
      <Image nativeID="bound" source={art} style={{ width: 120, height: 90 }} />
      <Image nativeID="bound-width" source={art} style={{ width: 120 }} />
      <Image nativeID="own-ratio" source={art} class="thumb square" />
      <Image nativeID="global" source={art} class="global-size" />
      <Image nativeID="uri-only" source={{ uri: 'b.jpg' }} />
    </>
  ));
}

/** A background sized by a class, over a picture that knows its own size. */
export function IntrinsicBackground() {
  return withNativeStyles(sheet, () => <ImageBackground class="banner" source={art} />);
}
