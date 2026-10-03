/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { ServiceScope } from '@solid-native/device/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  NativeSearchBar,
  NativeStackOutlet,
  createNativeNavigation,
  type NativeNavigation,
  type NativeSearchBarRef,
  type NativeRoute,
} from '../src/solid.ts';

export function chromeFixture(extra: readonly NativeRoute[] = []) {
  let navigation!: NativeNavigation;
  let ref!: NativeSearchBarRef;
  const [query, setQuery] = createSignal('seed');
  const [color, setColor] = createSignal('red');
  const calls: string[] = [];
  let accept = true;
  const Page = () => (
    <>
      <NativeHeader
        title="Search"
        blurEffect="light"
        largeTitleFontSize={38}
        backButtonInCustomView
        consumeLeftInset={false}
        color={color()}
      >
        <NativeHeaderItem type="searchBar">
          <NativeSearchBar
            query={query()}
            onQueryChange={(value) => {
              calls.push(value);
              if (accept) setQuery(value);
            }}
            ref={(value) => {
              ref = value;
            }}
            obscureBackground={false}
            hideNavigationBar
            onSearch={(value) => calls.push('search:' + value)}
            onCancel={() => calls.push('cancel')}
            onSearchFocus={() => calls.push('focus')}
            onSearchBlur={() => calls.push('blur')}
          />
        </NativeHeaderItem>
      </NativeHeader>
    </>
  );
  function Shell() {
    navigation = createNativeNavigation([
      { path: '', component: Page },
      { path: 'other', component: () => <text>other</text> },
      ...extra,
    ]);
    return <NativeStackOutlet navigation={navigation} />;
  }
  return {
    Scene: () => (
      <ServiceScope>
        <Shell />
      </ServiceScope>
    ),
    nav: () => navigation,
    ref: () => ref,
    query,
    setQuery,
    setColor,
    calls,
    reject: () => {
      accept = false;
    },
  };
}
