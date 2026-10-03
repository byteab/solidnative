import { createSignal, onCleanup } from 'solid-js';
import { nativePlatform, type HostEngine, type HostNode } from '@solidnative/fabric';
import { useHostAdapter } from '@solidnative/platform/solid';
import type { NativeNavigation } from './native-navigation.ts';
import { useRouteOutlet } from './route-context.ts';
import { useNativeBarDefaults, type TabDefaults } from './native-bar-defaults.ts';
import {
  tabIconProps,
  type TabAppearance,
  type TabIcon,
  type TabIconProps,
  type TabItemAppearance,
  type TabStateAppearance,
  type TabSystemItem,
} from './tab-appearance.ts';

export interface NativeTabProps {
  readonly path: string;
  readonly title?: string;
  readonly sfSymbol?: string;
  readonly drawable?: string;
  readonly icon?: TabIcon;
  readonly selectedIcon?: TabIcon;
  readonly systemItem?: TabSystemItem;
  readonly badge?: string;
  readonly accessibilityLabel?: string;
  readonly standardAppearance?: TabAppearance;
  readonly scrollEdgeAppearance?: TabAppearance;
}
export interface NativeTabsOutletProps extends TabDefaults {
  readonly navigation?: NativeNavigation;
  /** Structure is captured once; each item's prop getters remain reactive. */
  readonly tabs: readonly NativeTabProps[];
  readonly testID?: string;
  readonly barHidden?: boolean;
  readonly minimizeBehavior?: 'automatic' | 'never' | 'onScrollDown' | 'onScrollUp';
  readonly controllerMode?: 'automatic' | 'tabBar' | 'tabSidebar';
  readonly respectsKeyboard?: boolean;
}

function iconProps(engine: HostEngine, icon: TabIcon | undefined): TabIconProps {
  if (!icon) return {};
  if ('sfSymbol' in icon) return { iconType: 'sfSymbol', iconResourceName: icon.sfSymbol };
  if ('xcasset' in icon) return { iconType: 'xcasset', iconResourceName: icon.xcasset };
  if ('drawable' in icon) return { drawableIconResourceName: icon.drawable };
  const source = engine.resolveAsset('image' in icon ? icon.image : icon.template);
  return nativePlatform() === 'android'
    ? { imageIconResource: source }
    : { iconType: 'image' in icon ? 'image' : 'template', iconImageSource: source };
}
function appearance(engine: HostEngine, value: TabAppearance | undefined): object | undefined {
  if (!value) return undefined;
  const state = (value: TabStateAppearance | undefined) =>
    value && {
      ...value,
      tabBarItemTitleFontWeight:
        value.tabBarItemTitleFontWeight === undefined
          ? undefined
          : String(value.tabBarItemTitleFontWeight),
      tabBarItemTitleFontColor: engine.color(value.tabBarItemTitleFontColor),
      tabBarItemIconColor: engine.color(value.tabBarItemIconColor),
      tabBarItemBadgeBackgroundColor: engine.color(value.tabBarItemBadgeBackgroundColor),
    };
  const item = (value: TabItemAppearance | undefined) =>
    value && {
      normal: state(value.normal),
      selected: state(value.selected),
      focused: state(value.focused),
      disabled: state(value.disabled),
    };
  return {
    ...value,
    stacked: item(value.stacked),
    inline: item(value.inline),
    compactInline: item(value.compactInline),
    tabBarBackgroundColor: engine.color(value.tabBarBackgroundColor),
    tabBarShadowColor: engine.color(value.tabBarShadowColor),
  };
}

/** Direct platform RNSTabsHost/RNSTabsScreen hosts, with independently retained child stacks. */
export function NativeTabsOutlet(props: NativeTabsOutletProps): HostNode {
  const adapter = useHostAdapter();
  const navigation = props.navigation ?? useRouteOutlet();
  const tabs = [...props.tabs];
  navigation.configureTabs(tabs.map((tab) => tab.path));
  onCleanup(navigation.attachOutlet());
  navigation.configureTabs(tabs.map((tab) => tab.path));
  const defaults = useNativeBarDefaults();
  const host = adapter.createElement('native-tabs-outlet');
  const [provenance, setProvenance] = createSignal(0);
  adapter.spreadProps(host, () => ({
    testID: props.testID,
    navStateRequest: {
      selectedScreenKey: navigation.current()?.definition.path,
      baseProvenance: provenance(),
    },
    tabBarHidden: props.barHidden,
    tabBarTintColor: props.tintColor ?? defaults.tabs().tintColor,
    nativeContainerBackgroundColor: props.backgroundColor ?? defaults.tabs().backgroundColor,
    colorScheme: props.colorScheme ?? defaults.tabs().colorScheme,
    tabBarMinimizeBehavior: props.minimizeBehavior,
    tabBarControllerMode: props.controllerMode,
    tabBarRespectsIMEInsets: props.respectsKeyboard,
  }));
  adapter.insertChildren(
    host,
    tabs.map((tab) => {
      const node = adapter.createElement('native-tab');
      adapter.spreadProps(node, () => ({
        screenKey: tab.path,
        title: tab.title,
        isTitleUndefined: tab.title === undefined,
        badgeValue: tab.badge,
        tabBarItemAccessibilityLabel: tab.accessibilityLabel,
        systemItem: tab.systemItem,
        ...tabIconProps(
          iconProps(
            adapter.engine,
            tab.icon ??
              (tab.sfSymbol
                ? { sfSymbol: tab.sfSymbol }
                : tab.drawable
                  ? { drawable: tab.drawable }
                  : undefined),
          ),
          iconProps(adapter.engine, tab.selectedIcon),
        ),
        standardAppearance: appearance(
          adapter.engine,
          tab.standardAppearance ?? props.standardAppearance ?? defaults.tabs().standardAppearance,
        ),
        scrollEdgeAppearance: appearance(
          adapter.engine,
          tab.scrollEdgeAppearance ??
            props.scrollEdgeAppearance ??
            defaults.tabs().scrollEdgeAppearance,
        ),
      }));
      adapter.insertChildren(
        node,
        () => navigation.entries().find((entry) => entry.definition.path === tab.path)?.owner.node,
      );
      return node;
    }),
  );
  let active = true;
  onCleanup(() => {
    active = false;
  });
  onCleanup(
    adapter.engine.setEventListener(host, 'topTabSelected', (event: unknown) => {
      const selection = (
        event as { nativeEvent?: { selectedScreenKey?: unknown; provenance?: unknown } }
      )?.nativeEvent;
      if (
        !active ||
        typeof selection?.selectedScreenKey !== 'string' ||
        typeof selection.provenance !== 'number' ||
        !Number.isSafeInteger(selection.provenance) ||
        selection.provenance < provenance()
      )
        return;
      setProvenance(selection.provenance);
      if (!tabs.some((tab) => tab.path === selection.selectedScreenKey)) return;
      // The reactive request also restores authoritative selection after guard refusal.
      void navigation.selectTab(selection.selectedScreenKey);
    }),
  );
  return host;
}
