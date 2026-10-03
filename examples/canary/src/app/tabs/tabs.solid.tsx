/** @jsxImportSource @solidnative/platform/solid */
import { nativePlatform } from '@solidnative/fabric';
import { useService } from '@solidnative/device/solid';
import { NativeHeader, NativeTabsOutlet, type TabIcon } from '@solidnative/router/solid';
import { Unread } from './unread.solid.ts';

/** The actual native tab declarations; each visited tab retains its own screen/stack. */
export function TabsPage() {
  const unread = useService(Unread);
  const symbol = (name: string, image: unknown): TabIcon =>
    nativePlatform() === 'android' ? { template: image } : { sfSymbol: name };
  const tabs = [
    {
      path: 'library',
      title: 'Library',
      icon: symbol('books.vertical.fill', require('../../../assets/tab-library.png')),
      standardAppearance: {
        stacked: {
          selected: { tabBarItemTitleFontColor: '#ff9f0a', tabBarItemIconColor: '#ff9f0a' },
        },
      },
    },
    {
      path: 'search',
      title: 'Search',
      icon: { template: require('../../../assets/tab-search.png') },
      selectedIcon: { template: require('../../../assets/tab-search-selected.png') },
    },
    {
      path: 'profile',
      title: 'Profile',
      icon: symbol('person.crop.circle', require('../../../assets/tab-profile.png')),
      get badge() {
        return unread.count() > 0 ? String(unread.count()) : undefined;
      },
    },
  ];
  return (
    <>
      <NativeHeader hidden />
      <NativeTabsOutlet tabs={tabs} />
    </>
  );
}
