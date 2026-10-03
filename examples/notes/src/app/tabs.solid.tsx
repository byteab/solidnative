/** @jsxImportSource @solidnative/platform/solid */
import { NativeHeader, NativeTabsOutlet } from '@solidnative/router/solid';

/** A real tab bar: UITabBarController on iOS, a bottom navigation bar on Android. */
export function Tabs() {
  return (
    <>
      <NativeHeader hidden />
      <NativeTabsOutlet
        tabs={[
          { path: 'notes', title: 'Notes', sfSymbol: 'note.text' },
          { path: 'settings', title: 'Settings', sfSymbol: 'gearshape.fill' },
        ]}
      />
    </>
  );
}
