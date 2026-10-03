/** @jsxImportSource @solid-native/platform/solid */
import { nativePlatform } from '@solid-native/fabric';
import { NativeHeader, NativeTabsOutlet, type TabIcon } from '@solid-native/router/solid';

/**
 * SF Symbols on iOS. Android has no symbol set, so it gets an image, drawn as a mask so the bar
 * tints it like a symbol.
 */
const icon = (symbol: string, image: unknown): TabIcon =>
  nativePlatform() === 'android' ? { template: image } : { sfSymbol: symbol };

/** A real tab bar: UITabBarController on iOS, a bottom navigation bar on Android. */
export function Tabs() {
  const tabs = [
    { path: 'home', title: 'Home', icon: icon('house.fill', require('../../assets/tab-home.png')) },
    {
      path: 'activity',
      title: 'Activity',
      icon: icon('list.bullet.rectangle', require('../../assets/tab-activity.png')),
    },
    {
      path: 'settings',
      title: 'Settings',
      icon: icon('gearshape.fill', require('../../assets/tab-settings.png')),
    },
  ];
  return (
    <>
      <NativeHeader hidden />
      <NativeTabsOutlet tabs={tabs} />
    </>
  );
}
