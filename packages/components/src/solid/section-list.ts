import { createMemo, mapArray, mergeProps, type Accessor } from 'solid-js';
import { nativePlatform } from '@solidnative/fabric';
import type { HostChild } from '@solidnative/platform/solid';
import { View } from './primitive.ts';
import { VirtualList, type VirtualListProps, type VirtualListRef } from './virtual-list.ts';

export interface SectionListSection<T> {
  readonly key?: string;
  readonly title?: string;
  readonly data: readonly T[];
}
export interface SectionListRef extends VirtualListRef {
  /** itemIndex 0 names the section header; 1 names its first item, matching the legacy contract. */
  scrollToLocation(options: {
    sectionIndex: number;
    itemIndex: number;
    viewOffset?: number;
    animated?: boolean;
  }): void;
}
type Height<A extends unknown[]> = number | ((...args: A) => number);
export interface SectionListProps<
  T,
  S extends SectionListSection<T> = SectionListSection<T>,
> extends Omit<
  VirtualListProps<T>,
  | 'items'
  | 'itemHeight'
  | 'estimatedItemHeight'
  | 'renderItem'
  | 'renderSeparator'
  | 'keyExtractor'
  | 'stickyIndices'
  | 'ref'
  | 'onViewableItemsChanged'
  | 'itemType'
> {
  sections: readonly (S & SectionListSection<T>)[];
  itemHeight: Height<[item: T, index: number, section: S]>;
  sectionHeaderHeight?: Height<[section: S]>;
  sectionFooterHeight?: Height<[section: S]>;
  stickySectionHeadersEnabled?: boolean;
  keyExtractor?: (item: T, index: number, section: S) => unknown;
  itemType?: (item: T, index: number, section: S) => unknown;
  renderItem: (
    item: Accessor<T>,
    index: Accessor<number>,
    section: Accessor<S>,
    sectionIndex: Accessor<number>,
  ) => HostChild;
  renderSectionHeader?: (section: Accessor<S>, sectionIndex: Accessor<number>) => HostChild;
  renderSectionFooter?: (section: Accessor<S>, sectionIndex: Accessor<number>) => HostChild;
  renderSeparator?: (
    leading: Accessor<T>,
    trailing: Accessor<T>,
    section: Accessor<S>,
  ) => HostChild;
  ref?: (ref: SectionListRef) => void;
}
interface SectionRow<T, S> {
  readonly key: object;
  readonly kind: 'header' | 'item' | 'footer';
  readonly section: S;
  readonly sectionIndex: number;
  readonly item?: T;
  readonly index: number;
}
const measure = <A extends unknown[]>(height: Height<A>, ...args: A) =>
  typeof height === 'number' ? height : height(...args);
const SECTION_PROPS = new Set([
  'sections',
  'sectionHeaderHeight',
  'sectionFooterHeight',
  'stickySectionHeadersEnabled',
  'renderSectionHeader',
  'renderSectionFooter',
  'keyExtractor',
  'renderItem',
  'renderSeparator',
  'itemHeight',
  'itemType',
  'ref',
]);

/** Keyed section/header/item owners over the same native list window and scroll APIs. */
export function SectionList<T, S extends SectionListSection<T> = SectionListSection<T>>(
  props: SectionListProps<T, S>,
): HostChild {
  const identities = new Map<
    unknown,
    { header: object; footer: object; items: Map<unknown, object> }
  >();
  const rows = createMemo(() => {
    const result: SectionRow<T, S>[] = [];
    const live = new Set<unknown>();
    props.sections.forEach((section, sectionIndex) => {
      const key = section.key ?? section;
      if (live.has(key)) throw new Error('SectionList section keys must be unique.');
      live.add(key);
      let identity = identities.get(key);
      if (!identity) {
        identity = { header: {}, footer: {}, items: new Map() };
        identities.set(key, identity);
      }
      result.push({ key: identity.header, kind: 'header', section, sectionIndex, index: -1 });
      const items = new Set<unknown>();
      section.data.forEach((item, index) => {
        const itemKey = props.keyExtractor ? props.keyExtractor(item, index, section) : item;
        if (items.has(itemKey))
          throw new Error('SectionList item keys must be unique within their section.');
        items.add(itemKey);
        let stable = identity.items.get(itemKey);
        if (!stable) {
          stable = {};
          identity.items.set(itemKey, stable);
        }
        result.push({ key: stable, kind: 'item', section, sectionIndex, item, index });
      });
      for (const itemKey of identity.items.keys())
        if (!items.has(itemKey)) identity.items.delete(itemKey);
      result.push({
        key: identity.footer,
        kind: 'footer',
        section,
        sectionIndex,
        index: section.data.length,
      });
    });
    for (const key of identities.keys()) if (!live.has(key)) identities.delete(key);
    return result;
  });
  const sticky = () => props.stickySectionHeadersEnabled ?? nativePlatform() === 'ios';
  let list!: VirtualListRef;
  const itemTypes = new Map<unknown, object>();
  const headerType = {},
    footerType = {};
  const result = VirtualList<SectionRow<T, S>>(
    mergeProps(
      () => Object.fromEntries(Object.entries(props).filter(([key]) => !SECTION_PROPS.has(key))),
      {
        get items() {
          return rows();
        },
        keyExtractor: (row: SectionRow<T, S>) => row.key,
        itemType: (row: SectionRow<T, S>) => {
          if (row.kind === 'header') return headerType;
          if (row.kind === 'footer') return footerType;
          const type = props.itemType?.(row.item!, row.index, row.section);
          let identity = itemTypes.get(type);
          if (!identity) {
            identity = {};
            itemTypes.set(type, identity);
          }
          return identity;
        },
        itemHeight: (row: SectionRow<T, S>) =>
          row.kind === 'item'
            ? measure(props.itemHeight, row.item!, row.index, row.section)
            : measure(
                (row.kind === 'header' ? props.sectionHeaderHeight : props.sectionFooterHeight) ??
                  0,
                row.section,
              ),
        get stickyIndices() {
          return sticky() && props.renderSectionHeader
            ? rows().flatMap((row, index) => (row.kind === 'header' ? [index] : []))
            : [];
        },
        renderItem(row: Accessor<SectionRow<T, S>>) {
          const section = () => row().section,
            sectionIndex = () => row().sectionIndex;
          if (row().kind === 'header') return props.renderSectionHeader?.(section, sectionIndex);
          if (row().kind === 'footer') return props.renderSectionFooter?.(section, sectionIndex);
          const item = () => row().item!,
            index = () => row().index;
          const separator = mapArray(
            () => (props.renderSeparator && index() < section().data.length - 1 ? [true] : []),
            () => props.renderSeparator!(item, () => section().data[index() + 1]!, section),
          );
          return View({
            style: { flex: 1 },
            children: [
              View({
                style: { flex: 1 },
                children: props.renderItem(item, index, section, sectionIndex),
              }),
              separator,
            ],
          });
        },
        ref(ref: VirtualListRef) {
          list = ref;
        },
      },
    ),
  );
  props.ref?.({
    ...list,
    scrollToLocation(options) {
      if (!props.sections.length) return;
      const sectionIndex = Math.max(
        0,
        Math.min(Math.floor(options.sectionIndex), props.sections.length - 1),
      );
      const section = props.sections[sectionIndex]!;
      const itemIndex = Math.max(
        0,
        Math.min(Math.floor(options.itemIndex), section.data.length + 1),
      );
      let index = itemIndex;
      for (let at = 0; at < sectionIndex; at++) index += props.sections[at]!.data.length + 2;
      const viewOffset =
        (options.viewOffset ?? 0) +
        (itemIndex > 0 && sticky() ? measure(props.sectionHeaderHeight ?? 0, section) : 0);
      list.scrollToIndex({ index, viewOffset, animated: options.animated });
    },
  });
  return result;
}
