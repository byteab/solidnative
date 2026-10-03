/**
 * React Native's own modules, fetched when a service is first constructed rather than when this
 * file is loaded.
 *
 * The distinction matters more than it looks. React Native ships its JavaScript as Flow, which
 * Node cannot parse, so a static `import ... from 'react-native'` anywhere in this package would
 * make the package unimportable by the test suite - and by `@solidnative/components`, which
 * the suite imports constantly. A call inside a factory is only ever executed on a device, where
 * `react-native` is the most ordinary import there is.
 *
 * ponytail: a `require` in a codebase that otherwise has none. The alternative is the shape
 * `@solidnative/expo` uses - a file per service outside `src`, importing the module and
 * declaring the service - which is right there because Expo's packages are optional peer
 * dependencies an app may not have installed. React Native is not optional, so the seam buys
 * nothing but files.
 */

/** The subset of React Native this package reaches for, described so `require` has a type. */
export interface ReactNative {
  AccessibilityInfo: {
    isScreenReaderEnabled(): Promise<boolean>;
    isReduceMotionEnabled(): Promise<boolean>;
    isBoldTextEnabled(): Promise<boolean>;
    announceForAccessibility(announcement: string): void;
    addEventListener(
      event: 'screenReaderChanged' | 'reduceMotionChanged' | 'boldTextChanged',
      handler: (value: boolean) => void,
    ): { remove(): void };
  };
  AppState: {
    currentState: string | null;
    addEventListener(event: 'change', handler: (state: string) => void): { remove(): void };
  };
  Appearance: {
    getColorScheme(): 'light' | 'dark' | null | undefined;
    addChangeListener(handler: (preferences: { colorScheme?: string | null }) => void): {
      remove(): void;
    };
    setColorScheme?(scheme: 'light' | 'dark' | 'unspecified'): void;
  };
  BackHandler: {
    addEventListener(event: 'hardwareBackPress', handler: () => boolean): { remove(): void };
  };
  Dimensions: {
    get(dimension: 'window' | 'screen'): { width: number; height: number };
    addEventListener(
      event: 'change',
      handler: (sizes: {
        window: { width: number; height: number };
        screen: { width: number; height: number };
      }) => void,
    ): { remove(): void };
  };
  I18nManager: {
    /** Whether the app is laid out right to left. Fixed for the lifetime of the process. */
    isRTL: boolean;
  };
  Keyboard: {
    dismiss(): void;
    addListener(
      event:
        | 'keyboardDidShow'
        | 'keyboardDidHide'
        | 'keyboardWillShow'
        | 'keyboardWillHide'
        | 'keyboardWillChangeFrame',
      handler: (event: NativeKeyboardEvent) => void,
    ): { remove(): void };
  };
  StyleSheet: {
    /** The thinnest line the screen can draw, in points. `1 / PixelRatio.get()`, near enough. */
    hairlineWidth: number;
  };
  ActionSheetIOS?: {
    showActionSheetWithOptions(
      options: {
        title?: string;
        options: string[];
        cancelButtonIndex: number;
        destructiveButtonIndex?: number;
      },
      callback: (index: number) => void,
    ): void;
  };
  Alert: {
    alert(
      title: string,
      message?: string,
      buttons?: { text?: string; style?: string; onPress?: () => void }[],
      options?: object,
    ): void;
    /** iOS only. Absent on Android, where there is no such dialog. */
    prompt?(
      title: string,
      message?: string,
      callbackOrButtons?:
        | ((value: string) => void)
        | { text?: string; style?: string; onPress?: (value?: string) => void }[],
      type?: string,
      defaultValue?: string,
    ): void;
  };
  PixelRatio: {
    get(): number;
    /** The user's text size setting, as a multiplier. One is the default. */
    getFontScale(): number;
  };
  Platform: { OS: string };
  Share: {
    share(
      content: { message?: string; url?: string; title?: string },
      options?: object,
    ): Promise<{ action: string; activityType?: string | null }>;
  };
  ToastAndroid?: {
    show(message: string, duration: number): void;
    SHORT: number;
    LONG: number;
  };
  Vibration: {
    vibrate(pattern?: number | number[], repeat?: boolean): void;
    cancel(): void;
  };
  DevSettings?: {
    addMenuItem(title: string, handler: () => unknown): void;
    reload(reason?: string): void;
  };
  LayoutAnimation: {
    configureNext(config: object, onDone?: () => void, onFail?: () => void): void;
  };
  PermissionsAndroid?: {
    check(permission: string): Promise<boolean>;
    request(permission: string, rationale?: object): Promise<string>;
  };
  StatusBar: {
    /** Android reports the bar's height in dp; iOS leaves it undefined. */
    currentHeight?: number;
    setBarStyle(style: string, animated?: boolean): void;
    setHidden(hidden: boolean, animation?: string): void;
    setBackgroundColor(color: string, animated?: boolean): void;
    setTranslucent(translucent: boolean): void;
  };
  Linking: {
    getInitialURL(): Promise<string | null>;
    openURL(url: string): Promise<unknown>;
    addEventListener(event: 'url', handler: (event: { url: string }) => void): { remove(): void };
  };
}

/** What RN hands a keyboard listener. */
export interface NativeKeyboardEvent {
  readonly endCoordinates: { readonly height: number; readonly screenY: number };
  readonly duration?: number;
  /** One of `LayoutEasing`'s names; usually `'keyboard'` on iOS, and always on Android, with a zero duration. */
  readonly easing?: string;
}

/**
 * `null` off a device, where each capability falls back to doing nothing - the same as an
 * optional injection token nobody provided.
 *
 * The engine's presence is what tells the two apart. In Node there is no `nativeFabricUIManager`
 * and no React Native either, which is the ordinary case for the test suite; on a device there is
 * one, and a missing `require` would mean the bundler stopped emitting CommonJS under us. That is
 * worth saying out loud rather than quietly rendering an app whose keyboard never moves.
 */
export function reactNative(): ReactNative | null {
  // `require` has a type only where the app's tsconfig loads Node's or React Native's types, and
  // a browser app's loads neither. `@ts-expect-error` would fail where it does.
  // @ts-ignore
  if (typeof require === 'function') return require('react-native') as ReactNative;
  if ((globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager !== undefined) {
    console.error(
      '[solid-native] react-native could not be required, so every platform capability is ' +
        'inert. The bundle is not CommonJS; check the Metro transform.',
    );
  }
  return null;
}
