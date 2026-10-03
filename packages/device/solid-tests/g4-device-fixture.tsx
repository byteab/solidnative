/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { Show, withNativeStyles } from '@solid-native/platform/solid';
import {
  ColorScheme,
  SafeArea,
  SCREEN_IN_FRONT,
  ServiceScope,
  StatusBar,
  provideService,
  useService,
  useStatusBar,
  type ColorSchemeSource,
  type SafeAreaSource,
  type StatusBarSource,
} from '@solid-native/device/solid';

export function deviceFixture(
  colors: ColorSchemeSource,
  area: SafeAreaSource,
  bar: StatusBarSource,
) {
  const [firstFront, setFirstFront] = createSignal(true);
  const [secondFront, setSecondFront] = createSignal(false);
  const [visible, setVisible] = createSignal(true);
  const [light, setLight] = createSignal(true);
  const [hidden, setHidden] = createSignal(false);
  let color!: ColorScheme;
  let safe!: SafeArea;
  let status!: StatusBar;
  function Screen() {
    useStatusBar(() => ({ style: light() ? 'light' : 'dark', hidden: hidden() }));
    return <text>screen</text>;
  }
  function Contents() {
    color = useService(ColorScheme);
    safe = useService(SafeArea);
    status = useService(StatusBar);
    status.set({ style: 'dark', hidden: false });
    return (
      <view>
        <text testID="scheme">{color.current()}</text>
        <text testID="insets">
          {safe.insets().bottom}:{safe.known() ? safe.frame()?.width : 'unknown'}
        </text>
        <Show when={visible()}>
          <ServiceScope services={[provideService(SCREEN_IN_FRONT, () => firstFront)]}>
            <Screen />
          </ServiceScope>
          <ServiceScope services={[provideService(SCREEN_IN_FRONT, () => secondFront)]}>
            <Screen />
          </ServiceScope>
        </Show>
      </view>
    );
  }
  return {
    setFirstFront,
    setSecondFront,
    setVisible,
    setLight,
    setHidden,
    color: () => color,
    safe: () => safe,
    status: () => status,
    render: () => (
      <ServiceScope
        services={[
          provideService(ColorScheme.SOURCE, () => colors),
          provideService(SafeArea.SOURCE, () => area),
          provideService(StatusBar.SOURCE, () => bar),
        ]}
      >
        <Contents />
      </ServiceScope>
    ),
  };
}

export function conditionFixture() {
  return withNativeStyles(
    {
      rules: [
        {
          compounds: [{ classes: ['viewport'] }],
          combinators: [],
          specificity: 1000,
          order: 0,
          declarations: {},
          deferred: [{ props: ['width'], kind: 'length', compute: { unit: 'vw', factor: 50 } }],
        },
      ],
    },
    () => (
      <view>
        <text class="viewport">width</text>
      </view>
    ),
  );
}
