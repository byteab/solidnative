import { createMemo, createSignal } from 'solid-js';
import { ColorScheme, createServiceToken, useService } from '@solid-native/device/solid';

export type Appearance = 'light' | 'dark' | 'automatic';

/** One row of the list: where it goes, or the switch it is. */
export interface SettingRow {
  readonly id: string;
  readonly title: string;
  /** A lucide-static icon name, drawn white on the tile. */
  readonly icon: string;
  /** The tile's colour, bound as a CSS variable its gradient derives from. */
  readonly tint: string;
  /** A detail page, by its path under settings, or a switch by the state it flips. */
  readonly to?: string;
  readonly toggle?: 'airplane';
  /** Words beyond the title a search finds it by. */
  readonly keywords?: string;
}

export const GROUPS: readonly (readonly SettingRow[])[] = [
  [
    {
      id: 'airplane',
      title: 'Airplane Mode',
      icon: 'Plane',
      tint: '#ff9500',
      toggle: 'airplane',
    },
    {
      id: 'wifi',
      title: 'Wi-Fi',
      icon: 'Wifi',
      tint: '#007aff',
      to: 'wifi',
      keywords: 'network internet',
    },
    {
      id: 'bluetooth',
      title: 'Bluetooth',
      icon: 'Bluetooth',
      tint: '#007aff',
      to: 'bluetooth',
    },
    { id: 'battery', title: 'Battery', icon: 'BatteryFull', tint: '#34c759', to: 'battery' },
  ],
  [
    {
      id: 'notifications',
      title: 'Notifications',
      icon: 'Bell',
      tint: '#ff3b30',
      to: 'notifications',
    },
    {
      id: 'sounds',
      title: 'Sounds & Haptics',
      icon: 'Volume2',
      tint: '#ff2d55',
      to: 'sounds',
    },
    {
      id: 'focus',
      title: 'Focus',
      icon: 'Moon',
      tint: '#5856d6',
      to: 'focus',
      keywords: 'do not disturb',
    },
  ],
  [
    {
      id: 'general',
      title: 'General',
      icon: 'Settings',
      tint: '#8e8e93',
      to: 'general',
      keywords: 'about version',
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      icon: 'Accessibility',
      tint: '#0a84ff',
      to: 'accessibility',
    },
    {
      id: 'display',
      title: 'Display & Brightness',
      icon: 'Sun',
      tint: '#0a84ff',
      to: 'display',
      keywords: 'dark mode appearance text size bold',
    },
  ],
  [
    {
      id: 'privacy',
      title: 'Privacy & Security',
      icon: 'Hand',
      tint: '#0a84ff',
      to: 'privacy',
    },
    {
      id: 'passcode',
      title: 'Face ID & Passcode',
      icon: 'Lock',
      tint: '#34c759',
      to: 'passcode',
    },
  ],
];

export const ROWS = GROUPS.flat();

export interface Network {
  readonly name: string;
  readonly strength: 1 | 2 | 3;
  readonly secured: boolean;
}

export const NETWORKS: readonly Network[] = [
  { name: 'Morgan Home', strength: 3, secured: true },
  { name: 'BT-Hub-7F2A', strength: 2, secured: true },
  { name: 'Cafe Nero Guest', strength: 2, secured: false },
  { name: 'SKY9C1D0', strength: 1, secured: true },
];

/** The rows a search finds: every word of it in the title or the keywords. */
export function search(query: string): SettingRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return ROWS.filter((row) => {
    const text = `${row.title} ${row.keywords ?? ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export function createSettings() {
  const scheme = useService(ColorScheme);
  const [airplane, setAirplane] = createSignal(false),
    [wifi, setWifi] = createSignal(true);
  const [network, setNetwork] = createSignal<string | null>('Morgan Home');
  const [bluetooth, setBluetooth] = createSignal(true),
    [appearance, updateAppearance] = createSignal<Appearance>('automatic');
  const [textSize, setTextSize] = createSignal(3),
    [bold, setBold] = createSignal(false);
  const [previews, setPreviews] = createSignal<'always' | 'unlocked' | 'never'>('unlocked');
  const values = createMemo<Record<string, string>>(() => ({
    wifi: airplane() || !wifi() ? 'Off' : (network() ?? 'Not Connected'),
    bluetooth: bluetooth() ? 'On' : 'Off',
    display:
      appearance() === 'automatic' ? 'Automatic' : appearance() === 'dark' ? 'Dark' : 'Light',
  }));
  const setAppearance = (value: Appearance) => {
    updateAppearance(value);
    scheme.set(value === 'automatic' ? null : value);
  };
  return {
    airplane,
    setAirplane,
    wifi,
    setWifi,
    network,
    setNetwork,
    bluetooth,
    setBluetooth,
    appearance,
    setAppearance,
    textSize,
    setTextSize,
    bold,
    setBold,
    previews,
    setPreviews,
    values,
  };
}
export type Settings = ReturnType<typeof createSettings>;
export const Settings = createServiceToken<Settings>('canary.settings', createSettings);
