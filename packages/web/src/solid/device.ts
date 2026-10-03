import {
  ColorScheme,
  Direction,
  HardwareBack,
  Keyboard,
  SafeArea,
  Screen,
  StatusBar,
  provideService,
  type ServiceBinding,
} from '@solidnative/device';
import {
  browserColorSchemeSource,
  browserDirectionSource,
  browserScreenSource,
} from '../device-sources.ts';

/** Each island owns browser capabilities; unrelated application services inherit normally. */
export function browserServices(document: Document): ServiceBinding[] {
  const view = document.defaultView;
  const services = [ColorScheme, Direction, HardwareBack, Keyboard, SafeArea, Screen, StatusBar];
  const bindings: ServiceBinding[] = services.map((token) => ({ token, create: token.create }));
  if (view)
    bindings.push(
      provideService(Screen.SOURCE, () => browserScreenSource(view)),
      provideService(ColorScheme.SOURCE, () => browserColorSchemeSource(view)),
      provideService(Direction.SOURCE, () => browserDirectionSource(view)),
    );
  bindings.push(
    provideService(SafeArea.SOURCE, () => ({ current: () => null, subscribe: () => () => {} })),
    provideService(HardwareBack.SOURCE, () => ({ subscribe: () => () => {} })),
    provideService(StatusBar.SOURCE, () => ({
      height: undefined,
      setStyle() {},
      setHidden() {},
      setBackgroundColor() {},
      setTranslucent() {},
    })),
    provideService(Keyboard.SOURCE, () => ({
      subscribe: () => () => {},
      dismiss() {
        (document.activeElement as HTMLElement | null)?.blur?.();
      },
    })),
  );
  return bindings;
}
