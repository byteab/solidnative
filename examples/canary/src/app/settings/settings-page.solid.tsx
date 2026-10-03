/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import {
  Accessibility,
  BatteryFull,
  Bell,
  Bluetooth,
  ChevronRight,
  Hand,
  Lock,
  Moon,
  Plane,
  Settings as SettingsIcon,
  Sun,
  Volume2,
  Wifi,
} from 'lucide-static';
import { Pressable, ScrollView, Switch, Text, View } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { Icon, IconProvider } from '@solid-native/icons/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  NativeSearchBar,
  useNavigation,
} from '@solid-native/router/solid';
import { GROUPS, Settings, search, type SettingRow } from './settings-model.solid.ts';
import sheet from './settings-page.native.css';
export const SETTINGS_ICONS = {
  Accessibility,
  BatteryFull,
  Bell,
  Bluetooth,
  ChevronRight,
  Hand,
  Lock,
  Moon,
  Plane,
  Settings: SettingsIcon,
  Sun,
  Volume2,
  Wifi,
};
export function SettingsPage() {
  const settings = useService(Settings),
    nav = useNavigation();
  const [query, setQuery] = createSignal(''),
    results = createMemo(() => search(query()));
  const label = (row: SettingRow) => {
    const value = settings.values()[row.id];
    return value ? `${row.title}, ${value}` : row.title;
  };
  function Row(props: { row: SettingRow; result?: boolean }) {
    const row = props.row;
    const toggle = !props.result && !!row.toggle;
    return (
      <Pressable
        class="row"
        style={{ '--tint': row.tint }}
        accessibilityRole={toggle ? 'switch' : 'button'}
        accessibilityLabel={toggle ? row.title : label(row)}
        accessibilityState={toggle ? { checked: settings.airplane() } : undefined}
        onPress={() => {
          if (toggle) settings.setAirplane(!settings.airplane());
          else if (row.to) void nav.push(`/settings/${row.to}`);
        }}
      >
        <View class="tile">
          <Icon name={row.icon} size={18} color="white" />
        </View>
        <View class="body">
          <Text class="title">{row.title}</Text>
          <Show
            when={toggle}
            fallback={
              <>
                <Show when={!props.result && settings.values()[row.id]}>
                  {(value) => (
                    <Text class="value" numberOfLines={1}>
                      {value()}
                    </Text>
                  )}
                </Show>
                <Icon name="ChevronRight" size={18} color="#b8b8bd" />
              </>
            }
          >
            <Switch
              value={settings.airplane()}
              onValueChange={settings.setAirplane}
              accessibilityElementsHidden
            />
          </Show>
        </View>
      </Pressable>
    );
  }
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <IconProvider icons={SETTINGS_ICONS}>
        <NativeHeader title="Settings" largeTitle>
          <NativeHeaderItem type="searchBar">
            <NativeSearchBar
              placeholder="Search"
              hideWhenScrolling={false}
              query={query()}
              onQueryChange={setQuery}
            />
          </NativeHeaderItem>
        </NativeHeader>
        <ScrollView
          class="page"
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
        >
          <Show
            when={query().trim()}
            fallback={
              <>
                <Pressable
                  class="group account"
                  accessibilityRole="button"
                  accessibilityLabel="Alex Morgan, Account and iCloud"
                >
                  <View class="avatar">
                    <Text class="avatar-initials">AM</Text>
                  </View>
                  <View class="account-text">
                    <Text class="account-name">Alex Morgan</Text>
                    <Text class="account-hint">Account, iCloud, Media and Purchases</Text>
                  </View>
                  <Icon name="ChevronRight" size={20} color="#b8b8bd" />
                </Pressable>
                <For each={GROUPS}>
                  {(group) => (
                    <View class="group">
                      <For each={group}>{(row) => <Row row={row} />}</For>
                    </View>
                  )}
                </For>
              </>
            }
          >
            <Show
              when={results().length}
              fallback={<Text class="empty">No results for “{query().trim()}”</Text>}
            >
              <View class="group results">
                <For each={results()}>{(row) => <Row row={row} result />}</For>
              </View>
            </Show>
          </Show>
        </ScrollView>
      </IconProvider>
    </view>
  ));
}
