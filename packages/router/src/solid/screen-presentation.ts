/**
 * How a screen arrives, which is the part of mobile navigation a URL cannot express.
 *
 * Every field is a prop on `RNSScreen`, spelled exactly as the codegen spec spells it, so the
 * outlet forwards the object key by key rather than translating it. Anything here rides in
 * history state (ADR 0003), so going back to a screen restores the presentation it was opened
 * with.
 */

/** How the screen is mounted on the stack. */
export type StackPresentation =
  | 'push'
  | 'modal'
  | 'transparentModal'
  | 'fullScreenModal'
  | 'formSheet'
  | 'pageSheet'
  | 'containedModal'
  | 'containedTransparentModal';

/** The transition it animates in with. `default` is the platform's own. */
export type StackAnimation =
  | 'default'
  | 'flip'
  | 'simple_push'
  | 'none'
  | 'fade'
  | 'slide_from_right'
  | 'slide_from_left'
  | 'slide_from_bottom'
  | 'fade_from_bottom'
  | 'ios_from_right'
  | 'ios_from_left';

/** Which way the dismiss gesture runs. Vertical is what a sheet wants. */
export type SwipeDirection = 'vertical' | 'horizontal';

/** Whether replacing a screen animates as a push or a pop. */
export type ReplaceAnimation = 'pop' | 'push';

/** How far from the edge a dismiss gesture is recognised, in points. */
export interface GestureResponseDistance {
  readonly start?: number;
  readonly end?: number;
  readonly top?: number;
  readonly bottom?: number;
}

export interface ScreenPresentation {
  readonly stackPresentation?: StackPresentation;
  readonly stackAnimation?: StackAnimation;
  /** Milliseconds. Only read when `stackAnimation` is not `default`. */
  readonly transitionDuration?: number;
  readonly replaceAnimation?: ReplaceAnimation;

  // --- the dismiss gesture -------------------------------------------------------------

  /** Swipe back, or drag a sheet down. On by default. */
  readonly gestureEnabled?: boolean;
  /** iOS: allow the swipe to start anywhere on the screen, not just its edge. */
  readonly fullScreenSwipeEnabled?: boolean;
  readonly fullScreenSwipeShadowEnabled?: boolean;
  readonly swipeDirection?: SwipeDirection;
  readonly gestureResponseDistance?: GestureResponseDistance;
  /** Run the screen's own animation while swiping rather than the platform's. */
  readonly customAnimationOnSwipe?: boolean;
  /** Dismiss the keyboard when the gesture starts. */
  readonly hideKeyboardOnSwipe?: boolean;
  /**
   * Refuse a native dismissal outright. The screen still reports the attempt, which is how a
   * "discard your changes?" prompt is built.
   */
  readonly preventNativeDismiss?: boolean;

  // --- sheets (formSheet and pageSheet) --------------------------------------------------

  /** Heights the sheet snaps to, as fractions of the screen. */
  readonly sheetAllowedDetents?: number[];
  /** Index of the largest detent that leaves the screen behind undimmed; -1 dims at every one. */
  readonly sheetLargestUndimmedDetent?: number;
  readonly sheetGrabberVisible?: boolean;
  /** Corner radius in points; -1 is the system default. */
  readonly sheetCornerRadius?: number;
  readonly sheetExpandsWhenScrolledToEdge?: boolean;
  /** Which detent it opens at. */
  readonly sheetInitialDetent?: number;
  /** Android elevation. */
  readonly sheetElevation?: number;
  readonly sheetShouldOverflowTopInset?: boolean;

  // --- system chrome ---------------------------------------------------------------------

  readonly statusBarHidden?: boolean;
  readonly statusBarStyle?: string;
  readonly statusBarColor?: string | number;
  readonly statusBarAnimation?: string;
  readonly statusBarTranslucent?: boolean;
  readonly navigationBarColor?: string | number;
  readonly navigationBarHidden?: boolean;
  readonly navigationBarTranslucent?: boolean;
  readonly homeIndicatorHidden?: boolean;
  readonly screenOrientation?: string;
}
