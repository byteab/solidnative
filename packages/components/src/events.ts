/**
 * The `nativeEvent` payloads native sends, so a handler can be typed rather than cast.
 *
 * Events on a primitive are element events, bound as `on<Name>` props and routed by the renderer
 * to Fabric's `topName`, so `onLayout={(event) => ...}` receives a
 * `NativeSyntheticEvent<LayoutPayload>`. Nothing here is emitted from a component: a listener the
 * component registered itself would opt every instance into events such as `topLayout`, which
 * native only sends when something asks.
 */
import type { NativeSyntheticEvent, TouchPayload } from '@solid-native/fabric';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Insets {
  readonly top?: number;
  readonly left?: number;
  readonly bottom?: number;
  readonly right?: number;
}

/** `onLayout`: the view's frame, in its parent's coordinates. Native sends it only when asked. */
export interface LayoutPayload {
  readonly layout: Rect;
}
export type LayoutEvent = NativeSyntheticEvent<LayoutPayload>;

/** `onTouchStart`, `onTouchMove`, `onTouchEnd`, `onTouchCancel`. */
export interface TouchEventPayload extends TouchPayload {
  readonly touches?: readonly TouchPayload[];
  readonly changedTouches?: readonly TouchPayload[];
}
export type TouchEvent = NativeSyntheticEvent<TouchEventPayload>;

/** `onScroll` and the drag and momentum events on a scroll view. */
export interface ScrollPayload {
  readonly contentOffset: Point;
  readonly contentSize: Size;
  readonly layoutMeasurement: Size;
  readonly contentInset: Required<Insets>;
  readonly zoomScale: number;
  /** Present on the drag-end and momentum events. */
  readonly velocity?: Point;
  readonly responderIgnoreScroll?: boolean;
  readonly targetContentOffset?: Point;
}
export type ScrollEvent = NativeSyntheticEvent<ScrollPayload>;

/** `onContentSizeChange` on a scroll view: the new size of the content view. */
export type ContentSizeChangeEvent = NativeSyntheticEvent<Size>;

/** One laid-out line, from `onTextLayout`. */
export interface TextLayoutLine extends Rect {
  readonly ascender: number;
  readonly capHeight: number;
  readonly descender: number;
  readonly text: string;
  readonly xHeight: number;
}
export interface TextLayoutPayload {
  readonly lines: readonly TextLayoutLine[];
}
export type TextLayoutEvent = NativeSyntheticEvent<TextLayoutPayload>;

/** `onChange` on a text input, and the value the model is set from. */
export interface TextInputChangePayload {
  readonly text: string;
  readonly eventCount: number;
  readonly target: number;
}
export type TextInputChangeEvent = NativeSyntheticEvent<TextInputChangePayload>;

/** `onSubmitEditing` and `onEndEditing`. */
export type TextInputEditingEvent = NativeSyntheticEvent<TextInputChangePayload>;

/** `onFocus` and `onBlur` on a text input. */
export interface TextInputFocusPayload {
  readonly target: number;
  readonly eventCount?: number;
  readonly text?: string;
}
export type TextInputFocusEvent = NativeSyntheticEvent<TextInputFocusPayload>;

/** `onSelectionChange`. */
export interface SelectionChangePayload {
  readonly selection: { readonly start: number; readonly end: number };
  readonly target: number;
}
export type SelectionChangeEvent = NativeSyntheticEvent<SelectionChangePayload>;

/** `onKeyPress`: `key` is the character, or `Backspace`, `Enter`, `Tab` and so on. */
export interface KeyPressPayload {
  readonly key: string;
  readonly target?: number;
  readonly eventCount?: number;
}
export type KeyPressEvent = NativeSyntheticEvent<KeyPressPayload>;

/** `onContentSizeChange` on a multiline text input. */
export interface TextInputContentSizePayload {
  readonly contentSize: Size;
  readonly target: number;
}
export type TextInputContentSizeEvent = NativeSyntheticEvent<TextInputContentSizePayload>;

/** `onScroll` on a multiline text input. */
export interface TextInputScrollPayload {
  readonly contentOffset: Point;
}
export type TextInputScrollEvent = NativeSyntheticEvent<TextInputScrollPayload>;

/** `onChange` on a switch. */
export interface SwitchChangePayload {
  readonly value: boolean;
  readonly target: number;
}
export type SwitchChangeEvent = NativeSyntheticEvent<SwitchChangePayload>;

/** `onLoad` on an image: what was decoded. */
export interface ImageLoadPayload {
  readonly source: { readonly uri: string; readonly width: number; readonly height: number };
}
export type ImageLoadEvent = NativeSyntheticEvent<ImageLoadPayload>;

/** `onError` on an image. */
export interface ImageErrorPayload {
  readonly error: string;
}
export type ImageErrorEvent = NativeSyntheticEvent<ImageErrorPayload>;

/** `onProgress` on an image, iOS only. */
export interface ImageProgressPayload {
  readonly loaded: number;
  readonly total: number;
}
export type ImageProgressEvent = NativeSyntheticEvent<ImageProgressPayload>;

/** `onOrientationChange` on a modal, iOS only. */
export interface OrientationChangePayload {
  readonly orientation: 'portrait' | 'landscape';
}
export type OrientationChangeEvent = NativeSyntheticEvent<OrientationChangePayload>;

/** `onAccessibilityAction`: which of the view's declared actions the assistive technology fired. */
export interface AccessibilityActionPayload {
  readonly actionName: string;
}
export type AccessibilityActionEvent = NativeSyntheticEvent<AccessibilityActionPayload>;
