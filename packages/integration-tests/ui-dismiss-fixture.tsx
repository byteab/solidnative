/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { ServiceScope } from '@solidnative/device';
import {
  createNativeNavigation,
  NativeStackOutlet,
  useNativeDismissGuard,
  type NativeNavigation,
} from '@solidnative/router';

/** A home page and an editor that refuses a swipe-down while dirty, and counts the attempts. */
export function createDismissFixture() {
  let nav!: NativeNavigation;
  const editors: { setDirty(value: boolean): void; attempts(): number }[] = [];
  function Home() {
    return <text>Home</text>;
  }
  function Editor() {
    const [dirty, setDirty] = createSignal(false);
    const [attempts, setAttempts] = createSignal(0);
    useNativeDismissGuard(dirty, () => setAttempts((count) => count + 1));
    editors.push({ setDirty, attempts });
    return <text>Editor</text>;
  }
  function Shell() {
    nav = createNativeNavigation([
      { path: '', component: Home },
      { path: 'editor', component: Editor },
    ]);
    return <NativeStackOutlet navigation={nav} testID="root-stack" />;
  }
  function View() {
    return (
      <ServiceScope>
        <Shell />
      </ServiceScope>
    );
  }
  return {
    View,
    editors,
    get nav() {
      return nav;
    },
  };
}
