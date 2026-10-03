/** @jsxImportSource @solidnative/platform/solid */
import { NativeHeader, NativeTabsOutlet } from '@solidnative/router/solid';

const tabs = [
  { path: 'today', title: 'Today', sfSymbol: 'checkmark.circle.fill' },
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
