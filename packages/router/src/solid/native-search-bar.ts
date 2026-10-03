import { createRenderEffect, createSignal, untrack } from 'solid-js';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { useHostAdapter } from '@solid-native/platform/solid';
import type { HostNode, NativeSyntheticEvent } from '@solid-native/fabric';

export type SearchBarPlacement =
  'automatic' | 'inline' | 'stacked' | 'integrated' | 'integratedButton' | 'integratedCentered';
export interface NativeSearchBarRef {
  readonly node: HostNode;
  focus(): void;
  blur(): void;
  clear(): void;
  cancelSearch(): void;
}
export interface NativeSearchBarProps {
  readonly query?: string;
  readonly defaultQuery?: string;
  readonly onQueryChange?: (query: string) => void;
  readonly placeholder?: string;
  readonly hideWhenScrolling?: boolean;
  readonly cancelButtonText?: string;
  readonly placement?: SearchBarPlacement;
  readonly allowToolbarIntegration?: boolean;
  readonly autoCapitalize?: 'systemDefault' | 'none' | 'words' | 'sentences' | 'characters';
  readonly obscureBackground?: boolean;
  readonly hideNavigationBar?: boolean;
  readonly tintColor?: string;
  readonly textColor?: string;
  readonly onSearch?: (query: string) => void;
  readonly onCancel?: () => void;
  readonly onSearchFocus?: () => void;
  readonly onSearchBlur?: () => void;
  readonly ref?: (ref: NativeSearchBarRef) => void;
  readonly testID?: string;
}

/** RN Screens search field, with owner-bound commands and parent-authoritative text. */
export function NativeSearchBar(props: NativeSearchBarProps): HostNode {
  const adapter = useHostAdapter();
  const node = adapter.createElement('native-search-bar');
  const inFront = useService(SCREEN_IN_FRONT);
  const controlled = props.query !== undefined;
  const [local, setLocal] = createSignal(props.defaultQuery ?? '');
  const [revision, setRevision] = createSignal(0);
  const query = () => (controlled ? (props.query ?? '') : local());
  let fieldText = '';
  let active = true;
  const pending = new Set<() => void>();
  const live = () => active && inFront() && adapter.isAttached(node);
  const command = (name: string, args?: unknown[]) => {
    if (!active || !inFront()) return;
    let cancel: () => void;
    cancel = adapter.afterCommit(() => {
      pending.delete(cancel);
      if (live()) adapter.engine.dispatchCommand(node, name, args);
    });
    pending.add(cancel);
  };
  let cancelCorrection: (() => void) | undefined;
  createRenderEffect(() => {
    query();
    revision();
    inFront();
    cancelCorrection?.();
    cancelCorrection = adapter.afterCommit(() => {
      if (!live()) return;
      const value = query();
      if (value === fieldText) return;
      fieldText = value;
      adapter.engine.dispatchCommand(node, 'setText', [value]);
    });
  });
  const propose = (value: string) => {
    if (!live()) return;
    fieldText = value;
    if (!controlled) setLocal(value);
    try {
      props.onQueryChange?.(value);
    } finally {
      if (active) setRevision((v) => v + 1);
    }
  };
  adapter.spreadProps(
    node,
    () => ({
      placeholder: props.placeholder,
      hideWhenScrolling: props.hideWhenScrolling,
      cancelButtonText: props.cancelButtonText,
      placement: props.placement,
      allowToolbarIntegration: props.allowToolbarIntegration,
      autoCapitalize: props.autoCapitalize,
      obscureBackground:
        props.obscureBackground === undefined ? undefined : String(props.obscureBackground),
      hideNavigationBar:
        props.hideNavigationBar === undefined ? undefined : String(props.hideNavigationBar),
      tintColor: props.tintColor,
      textColor: props.textColor,
      testID: props.testID,
      onChangeText: (event: NativeSyntheticEvent<{ text?: string }>) =>
        propose(event.nativeEvent?.text ?? ''),
      onSearchButtonPress: (event: NativeSyntheticEvent<{ text?: string }>) => {
        if (live()) props.onSearch?.(event.nativeEvent?.text ?? query());
      },
      onCancelButtonPress: () => {
        if (live()) props.onCancel?.();
      },
      onSearchFocus: () => {
        if (live()) props.onSearchFocus?.();
      },
      onSearchBlur: () => {
        if (live()) props.onSearchBlur?.();
      },
    }),
    true,
  );
  adapter.onCleanup(node, () => {
    active = false;
    cancelCorrection?.();
    for (const cancel of pending) cancel();
    pending.clear();
  });
  untrack(() =>
    props.ref?.({
      node,
      focus: () => command('focus'),
      blur: () => command('blur'),
      clear: () => {
        if (!live()) return;
        propose('');
        // Controlled parents may reject clear; the post-commit correction remains authoritative.
        if (active && query() === '') command('clearText');
      },
      cancelSearch: () => command('cancelSearch'),
    }),
  );
  return node;
}
