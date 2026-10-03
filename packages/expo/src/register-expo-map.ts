import { registerExpoView } from './register-expo-view.ts';

/** Register the platform's direct Fabric map view before the first map is mounted. */
export function registerExpoMap(platform: 'ios' | 'android'): void {
  registerExpoView('expo-map', platform === 'ios' ? 'ExpoAppleMaps' : 'ExpoGoogleMaps');
}
