/** @jsxImportSource @solidnative/platform/solid */
import { nativePlatform } from '@solidnative/fabric';
import { NativeHeader, NativeTabsOutlet, type TabIcon } from '@solidnative/router/solid';

/**
 * SF Symbols on iOS. Android has no symbol set, so it gets an image, drawn as a mask so the bar
 * tints it like a symbol.
 */
const icon = (symbol: string, image: unknown): TabIcon =>
  nativePlatform() === 'android' ? { template: image } : { sfSymbol: symbol };

/**
 * A real tab bar. The mini player docked above it is placed by each tab rather than here: only
 * inside a tab can it learn how much of the screen the bar covers (see mini-player-bar).
 */
export function Tabs() {
  const tabs = [
    {
      path: 'library',
      title: 'Library',
      icon: icon('music.note.list', require('../../assets/tab-library.png')),
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
