/** Native tab appearance and icon data; no framework/runtime imports. */
export type TabIcon =
  | { readonly sfSymbol: string }
  /** An image in the iOS asset catalogue, by name. */
  | { readonly xcasset: string }
  /** A `require()`d asset or a `{ uri }`, drawn as authored. */
  | { readonly image: unknown }
  /** The same, drawn as a mask and tinted. */
  | { readonly template: unknown }
  /** Android: a drawable resource name. */
  | { readonly drawable: string };

/** One of Apple's standard items, which brings its own icon and title. */
export type TabSystemItem =
  | 'none'
  | 'bookmarks'
  | 'contacts'
  | 'downloads'
  | 'favorites'
  | 'featured'
  | 'history'
  | 'more'
  | 'mostRecent'
  | 'mostViewed'
  | 'recents'
  | 'search'
  | 'topRated';

export type TabBarBlurEffect =
  | 'none'
  | 'systemDefault'
  | 'extraLight'
  | 'light'
  | 'dark'
  | 'regular'
  | 'prominent'
  | 'systemUltraThinMaterial'
  | 'systemThinMaterial'
  | 'systemMaterial'
  | 'systemThickMaterial'
  | 'systemChromeMaterial';

/**
 * How an item looks in one state. The names are the native ones, spelled as the codegen spec
 * spells them, so this forwards rather than translates and Apple's own documentation still reads
 * across.
 */
export interface TabStateAppearance {
  tabBarItemTitleFontFamily?: string;
  tabBarItemTitleFontSize?: number;
  tabBarItemTitleFontWeight?: string | number;
  tabBarItemTitleFontStyle?: string;
  tabBarItemTitleFontColor?: string | number;
  tabBarItemTitlePositionAdjustment?: { horizontal?: number; vertical?: number };
  tabBarItemIconColor?: string | number;
  tabBarItemBadgeBackgroundColor?: string | number;
}

/** The four states an item can be in. Anything absent falls back to the platform's own. */
export interface TabItemAppearance {
  normal?: TabStateAppearance;
  selected?: TabStateAppearance;
  focused?: TabStateAppearance;
  disabled?: TabStateAppearance;
}

/**
 * How the bar looks, per layout. `stacked` is the usual icon-over-title item; `inline` and
 * `compactInline` are the side-by-side layouts iPad and a compact height use.
 */
export interface TabAppearance {
  stacked?: TabItemAppearance;
  inline?: TabItemAppearance;
  compactInline?: TabItemAppearance;
  tabBarBackgroundColor?: string | number;
  tabBarShadowColor?: string | number;
  tabBarBlurEffect?: TabBarBlurEffect;
}

/** One icon, as the props native reads it through. */
export interface TabIconProps {
  iconType?: string;
  iconResourceName?: string;
  iconImageSource?: unknown;
  drawableIconResourceName?: string;
  imageIconResource?: unknown;
}

/**
 * An icon and its selected counterpart, as one set of props.
 *
 * Native carries a single `iconType` for both states, so the two have to be the same kind of
 * thing: a template image cannot become a symbol when selected. React Native Screens throws on
 * that pairing and so does this, because the alternative - what happened before this checked - is
 * that native quietly keeps the unselected icon and nothing anywhere says why.
 */
export function tabIconProps(
  icon: TabIconProps,
  selectedIcon: TabIconProps,
): TabIconProps & {
  selectedIconResourceName?: string;
  selectedIconImageSource?: unknown;
  selectedDrawableIconResourceName?: string;
  selectedImageIconResource?: unknown;
} {
  const hasBase = icon.iconType !== undefined || icon.drawableIconResourceName !== undefined;
  const hasSelected =
    selectedIcon.iconType !== undefined || selectedIcon.drawableIconResourceName !== undefined;

  if (hasSelected && !hasBase) {
    throw new Error(
      '[native-solid-router] <native-tab> has a selectedIcon but no icon to select from',
    );
  }
  if (hasSelected && icon.iconType !== selectedIcon.iconType) {
    throw new Error(
      `[native-solid-router] <native-tab> icon and selectedIcon must be the same kind: native has ` +
        `one iconType for both, so '${icon.iconType}' and '${selectedIcon.iconType}' cannot pair.`,
    );
  }

  return {
    ...icon,
    selectedIconResourceName: selectedIcon.iconResourceName,
    selectedIconImageSource: selectedIcon.iconImageSource,
    selectedDrawableIconResourceName: selectedIcon.drawableIconResourceName,
    selectedImageIconResource: selectedIcon.imageIconResource,
  };
}
