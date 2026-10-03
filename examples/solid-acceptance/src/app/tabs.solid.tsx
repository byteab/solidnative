/** @jsxImportSource @solidnative/platform/solid */
import { nativePlatform } from '@solidnative/fabric';
import { NativeHeader, NativeTabsOutlet, type TabIcon } from '@solidnative/router';

/** SF Symbols on iOS; Android has none, so it gets an image drawn as a mask the bar tints. */
const icon = (symbol: string, image: unknown): TabIcon =>
  nativePlatform() === 'android' ? { template: image } : { sfSymbol: symbol };

/** A real tab bar: UITabBarController on iOS, a bottom navigation bar on Android. */
export function Tabs() {
  const tabs = [
    {
      path: 'home',
      title: 'Home',
      accessibilityLabel: 'Home tab',
      icon: icon('house.fill', require('../../assets/tab-home.png')),
    },
    {
      path: 'list',
      title: 'List',
      accessibilityLabel: 'List tab',
      icon: icon('list.bullet', require('../../assets/tab-list.png')),
    },
    {
      path: 'motion',
      title: 'Motion',
      accessibilityLabel: 'Motion tab',
      icon: icon('sparkles', require('../../assets/tab-motion.png')),
    },
  ];
  return (
    <>
      <NativeHeader hidden />
      <NativeTabsOutlet testID="tabs" tabs={tabs} />
    </>
  );
}
