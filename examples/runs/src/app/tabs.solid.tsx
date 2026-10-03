/** @jsxImportSource @solid-native/platform/solid */
import { NativeHeader, NativeTabsOutlet } from '@solid-native/router/solid';

const tabs = [
  { path: 'run', title: 'Run', sfSymbol: 'figure.run' },
  { path: 'history', title: 'History', sfSymbol: 'clock' },
  { path: 'settings', title: 'Settings', sfSymbol: 'gearshape.fill' },
];

/** A real tab bar: UITabBarController on iOS, a bottom navigation bar on Android. */
export function Tabs() {
  return (
    <>
      <NativeHeader hidden />
      <NativeTabsOutlet tabs={tabs} />
    </>
  );
}
