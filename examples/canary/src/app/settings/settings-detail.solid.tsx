/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, getOwner, onCleanup, runWithOwner } from 'solid-js';
import { Check, Lock } from 'lucide-static';
import { Pressable, ScrollView, Switch, Text, View } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { UiHost, UiSlider } from '@solid-native/expo/solid/expo-ui-components';
import { Brightness } from '@solid-native/expo/solid/brightness';
import { Icon, IconProvider } from '@solid-native/icons/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader, useRoute } from '@solid-native/router/solid';
import { NETWORKS, ROWS, Settings, type Appearance } from './settings-model.solid.ts';
import sheet from './settings-detail.native.css';
export const ABOUT: readonly [string, string][] = [
  ['Name', 'Alex’s iPhone'],
  ['iOS Version', '26.5'],
  ['Model Name', 'iPhone 17 Pro'],
  ['Model Number', 'MG8K4B/A'],
  ['Serial Number', 'F4K9QX7LMN'],
  ['Capacity', '256 GB'],
  ['Available', '131.4 GB'],
];
export const APPEARANCES: readonly { id: Appearance; name: string }[] = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];
export function SettingsDetail() {
  const owner = getOwner();
  const route = useRoute();
  const section = () => String(route.params['section'] ?? '');
  const settings = useService(Settings),
    brightness = useService(Brightness);
  const title = createMemo(() => ROWS.find((row) => row.to === section())?.title ?? 'Settings');
  const others = createMemo(() =>
    NETWORKS.filter((network) => network.name !== settings.network()),
  );
  let releaseBrightness: (() => void) | undefined;
  onCleanup(() => releaseBrightness?.());
  const changeBrightness = (value: number) => {
    const previous = releaseBrightness;
    // The native listener's replaceable props effect must not own this screen claim.
    releaseBrightness = runWithOwner(owner, () => brightness.set(value));
    previous?.();
  };
  function Bars(props: { strength: number }) {
    return (
      <View class={`bars strength-${props.strength}`}>
        <View class="bar" />
        <View class="bar" />
        <View class="bar" />
      </View>
    );
  }
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <IconProvider icons={{ Check, Lock }}>
        <NativeHeader title={title()} />
        <ScrollView class="page" contentInsetAdjustmentBehavior="automatic">
          <Show when={section() === 'wifi'}>
            <View class="group top">
              <View class="row">
                <View class="body">
                  <Text class="title" accessible={false}>
                    Wi-Fi
                  </Text>
                  <Switch
                    value={settings.wifi()}
                    onValueChange={settings.setWifi}
                    accessibilityLabel="Wi-Fi"
                  />
                </View>
              </View>
              <Show when={settings.wifi() && settings.network()}>
                {(joined) => (
                  <View class="row" accessible accessibilityLabel={`${joined()}, connected`}>
                    <View class="body">
                      <Icon class="check" name="Check" size={18} color="#007aff" />
                      <Text class="title">{joined()}</Text>
                      <Icon name="Lock" size={14} color="#8e8e93" />
                      <Bars strength={3} />
                    </View>
                  </View>
                )}
              </Show>
            </View>
            <Show when={settings.wifi()}>
              <Text class="caption">Networks</Text>
              <View class="group">
                <For each={others()}>
                  {(network) => (
                    <Pressable
                      class="row"
                      accessibilityRole="button"
                      accessibilityLabel={`${network.name}${network.secured ? ', secured' : ''}, ${network.strength} bars`}
                      onPress={() => settings.setNetwork(network.name)}
                    >
                      <View class="body">
                        <Text class="title">{network.name}</Text>
                        <Show when={network.secured}>
                          <Icon name="Lock" size={14} color="#8e8e93" />
                        </Show>
                        <Bars strength={network.strength} />
                      </View>
                    </Pressable>
                  )}
                </For>
              </View>
            </Show>
          </Show>
          <Show when={section() === 'display'}>
            <Text class="caption top-caption">Appearance</Text>
            <View class="group appearance">
              <View class="modes">
                <For each={APPEARANCES}>
                  {(mode) => (
                    <Pressable
                      class="mode"
                      classList={{ chosen: settings.appearance() === mode.id }}
                      accessibilityRole="radio"
                      accessibilityLabel={mode.name}
                      accessibilityState={{ checked: settings.appearance() === mode.id }}
                      onPress={() => settings.setAppearance(mode.id)}
                    >
                      <View class={`phone ${mode.id}`}>
                        <View class="phone-bar" />
                        <View class="phone-line" />
                        <View class="phone-line short" />
                      </View>
                      <Text class="mode-name">{mode.name}</Text>
                      <View class="radio">
                        <View class="radio-dot" />
                      </View>
                    </Pressable>
                  )}
                </For>
              </View>
              <View class="row">
                <View class="body">
                  <Text class="title" accessible={false}>
                    Automatic
                  </Text>
                  <Switch
                    value={settings.appearance() === 'automatic'}
                    onValueChange={(value) => settings.setAppearance(value ? 'automatic' : 'light')}
                    accessibilityLabel="Automatic"
                  />
                </View>
              </View>
            </View>
            <Text class="caption">Brightness</Text>
            <View class="group">
              <View class="row slider-row">
                <UiHost class="slider" matchContents={{ vertical: true }}>
                  <UiSlider
                    value={brightness.level()}
                    min={0}
                    max={1}
                    onValueChanged={(event) => changeBrightness(event.nativeEvent.value)}
                  />
                </UiHost>
              </View>
            </View>
            <Text class="caption">Text</Text>
            <View class="group">
              <View class="row slider-row">
                <Text class="small-a">A</Text>
                <UiHost class="slider" matchContents={{ vertical: true }}>
                  <UiSlider
                    value={settings.textSize()}
                    min={1}
                    max={7}
                    steps={5}
                    onValueChanged={(event) => settings.setTextSize(event.nativeEvent.value)}
                  />
                </UiHost>
                <Text class="big-a">A</Text>
              </View>
              <View class="row">
                <View class="body">
                  <Text class="title" classList={{ bold: settings.bold() }} accessible={false}>
                    Bold Text
                  </Text>
                  <Switch
                    value={settings.bold()}
                    onValueChange={settings.setBold}
                    accessibilityLabel="Bold Text"
                  />
                </View>
              </View>
            </View>
            <Text
              class="preview"
              style={{ fontSize: 12 + settings.textSize() * 2 }}
              classList={{ bold: settings.bold() }}
            >
              Apps that support Dynamic Type will adjust to your preferred reading size.
            </Text>
          </Show>
          <Show when={section() === 'general'}>
            <View class="group top">
              <For each={ABOUT}>
                {(entry) => (
                  <View class="row" accessible accessibilityLabel={`${entry[0]}, ${entry[1]}`}>
                    <View class="body">
                      <Text class="title">{entry[0]}</Text>
                      <Text class="value">{entry[1]}</Text>
                    </View>
                  </View>
                )}
              </For>
            </View>
          </Show>
          <Show when={!['wifi', 'display', 'general'].includes(section())}>
            <View class="placeholder">
              <Text class="placeholder-title">{title()}</Text>
              <Text class="placeholder-hint">Nothing to set here in the canary.</Text>
            </View>
          </Show>
        </ScrollView>
      </IconProvider>
    </view>
  ));
}
