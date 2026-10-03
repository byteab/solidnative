/**
 * View names that differ by platform, however the app orders its startup.
 *
 * An app's `main.ts` reports the platform with `registerPlatformComponents(Platform.OS)`, but its
 * imports run first, and the router registers its views (`registerScreenComponents()`) as the
 * first navigation is created. A name chosen then was chosen for iOS, the default, so an Android app asked
 * Fabric for `RNSFullWindowOverlay`, which only iOS has, and crashed as it opened.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { registerPlatformComponents, viewNameOf } from '@solidnative/fabric';
import { registerScreenComponents } from '@solidnative/router';

const element = (name: string) => ({ kind: 'element' as const, name, parent: null });

describe('a view name registered before the platform is known', () => {
  it('is the Android one once Android is reported, as main.ts reports it after its imports', () => {
    registerScreenComponents();
    assert.equal(viewNameOf(element('full-window-overlay')), 'RNSFullWindowOverlay');
    registerPlatformComponents('android');
    assert.equal(viewNameOf(element('full-window-overlay')), 'RCTView');
    assert.equal(viewNameOf(element('native-tabs-outlet')), 'RNSTabsHostAndroid');
    assert.equal(viewNameOf(element('native-tab')), 'RNSTabsScreenAndroid');
  });
});
