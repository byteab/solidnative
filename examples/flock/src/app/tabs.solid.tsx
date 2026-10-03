/** @jsxImportSource @solidnative/platform/solid */
import { nativePlatform } from '@solidnative/fabric';
import {
  NativeHeader,
  NativeStackOutlet,
  NativeTabsOutlet,
  type TabIcon,
} from '@solidnative/router/solid';
import { unreadCount } from './flock.solid.ts';

/** SF Symbols on iOS; on Android a white PNG drawn as a mask, so the bar tints it. */
const icon = (symbol: string, image: unknown): TabIcon =>
  nativePlatform() === 'android' ? { template: image } : { sfSymbol: symbol };

export function TabStack() {
  return <NativeStackOutlet />;
}

/** A real UITabBarController on iOS (Liquid Glass on iOS 26), Material bottom navigation on Android. */
export function Tabs() {
  const tabs = [
    { path: 'home', title: 'Home', icon: icon('house.fill', require('../../assets/tab-home.png')) },
    {
      path: 'explore',
      title: 'Explore',
      icon: icon('magnifyingglass', require('../../assets/tab-explore.png')),
    },
    {
      path: 'notifications',
      title: 'Notifications',
      icon: icon('bell.fill', require('../../assets/tab-notifications.png')),
      // A getter, so the badge follows the signal.
      get badge() {
        return unreadCount() > 0 ? String(unreadCount()) : undefined;
      },
    },
    {
      path: 'profile',
      title: 'Profile',
      icon: icon('person.crop.circle.fill', require('../../assets/tab-profile.png')),
    },
  ];
  return (
    <>
      <NativeHeader hidden />
      <NativeTabsOutlet tabs={tabs} minimizeBehavior="onScrollDown" />
    </>
  );
}
