/**
 * The three remaining React Native APIs: animating a layout change, Android's runtime
 * permissions, and the developer menu.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRoot } from 'solid-js';
import {
  DevMenu,
  LayoutAnimation,
  androidPermissionOf,
  useService,
  type NativeLayoutAnimation,
} from '@solidnative/device';
import { Permission } from '@solidnative/expo';
import { serviceWith } from './ui-services.ts';

describe('animating a layout change', () => {
  function platform(callsBack: boolean) {
    const state = {
      configured: null as object | null,
      order: [] as string[],
      configureNext(config: object, onDone?: () => void) {
        state.configured = config;
        state.order.push('configure');
        if (callsBack) queueMicrotask(() => onDone?.());
      },
    };
    return state as NativeLayoutAnimation & typeof state;
  }

  it('configures the animation before making the change, because the two must be adjacent', async () => {
    // A `configureNext` with nothing after it animates whatever commit happens next, which may be
    // a different screen entirely. Taking the change is what makes that impossible.
    const native = platform(true);
    const layout = serviceWith(LayoutAnimation.SOURCE, native, () => useService(LayoutAnimation));

    await layout.animate(() => native.order.push('change'));
    assert.deepEqual(native.order, ['configure', 'change']);
  });

  it('animates nothing on appearing or leaving when told none', async () => {
    const native = platform(true);
    await serviceWith(LayoutAnimation.SOURCE, native, () => useService(LayoutAnimation)).animate(
      () => {},
      { duration: 200, appear: 'none', leave: 'none' },
    );
    assert.deepEqual(native.configured, { duration: 200, update: { type: 'easeInEaseOut' } });
  });

  it('tells a view what to animate when it appears, which is the usual reason one does nothing', async () => {
    // A view appearing has no previous size to animate from, so `create` needs a property as well
    // as a type. Leaving it out is the most common way one of these silently does nothing.
    const native = platform(true);
    await serviceWith(LayoutAnimation.SOURCE, native, () => useService(LayoutAnimation)).animate(
      () => {},
      { duration: 200, appear: 'scaleXY' },
    );

    assert.deepEqual(native.configured, {
      duration: 200,
      update: { type: 'easeInEaseOut' },
      create: { type: 'easeInEaseOut', property: 'scaleXY' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
  });

  it('gives a spring its damping, which native needs and will not default', async () => {
    const native = platform(true);
    await serviceWith(LayoutAnimation.SOURCE, native, () => useService(LayoutAnimation)).animate(
      () => {},
      { easing: 'spring' },
    );
    assert.equal(
      (native.configured as { update: { springDamping?: number } }).update.springDamping,
      0.7,
    );
  });

  it('does not wait forever on a platform that never reports the end', async () => {
    // Android does not call the completion. A promise that waited on it would never resolve.
    const native = platform(false);
    await serviceWith(LayoutAnimation.SOURCE, native, () => useService(LayoutAnimation)).animate(
      () => {},
      { duration: 1 },
    );
  });

  it('still makes the change with no platform behind it', async () => {
    let changed = false;
    await serviceWith(LayoutAnimation.SOURCE, null, () => useService(LayoutAnimation)).animate(
      () => (changed = true),
    );
    assert.equal(changed, true);
  });
});

describe('an Android runtime permission', () => {
  const platform = (granted: boolean, result = 'granted') => ({
    asked: 0,
    check: async () => granted,
    request: async function (this: { asked: number }) {
      this.asked++;
      return result;
    },
  });

  it('reads as undetermined when it has not been granted, not as denied', async () => {
    // `check` cannot tell "refused" from "not yet asked", and only the second is worth a dialog.
    const native = platform(false);
    const permission = createRoot(() => new Permission(...asPair(native, 'CAMERA')));

    await permission.check();
    assert.equal(permission.status(), 'undetermined');
  });

  it('asks, and remembers a grant', async () => {
    const permission = createRoot(
      () => new Permission(...asPair(platform(false, 'granted'), 'CAMERA')),
    );
    assert.equal(await permission.ensure(), true);
  });

  it('knows when Android has closed the door', async () => {
    // `never_ask_again` is Android saying the dialog is over. Anything else is a no the user can
    // still change their mind about.
    const permission = createRoot(
      () => new Permission(...asPair(platform(false, 'never_ask_again'), 'CAMERA')),
    );
    await permission.request();
    assert.equal(permission.blocked(), true);
  });

  it('is granted on a platform that has no such thing', async () => {
    const permission = createRoot(() => new Permission(...asPair(null, 'CAMERA')));
    assert.equal(await permission.ensure(), true);
  });
});

/** `Permission` takes the pair as an api object; this is only to keep the tests readable. */
function asPair(native: Parameters<typeof androidPermissionOf>[0], permission: string) {
  const [get, request] = androidPermissionOf(native, permission);
  return [{ get, request }] as const;
}

describe('the developer menu', () => {
  const platform = () => {
    const items: string[] = [];
    return { items, addMenuItem: (title: string) => void items.push(title), reload: () => {} };
  };

  it('adds an item in development', () => {
    const native = platform();
    serviceWith(DevMenu.SOURCE, { menu: native, development: true }, () => useService(DevMenu)).add(
      'Clear cache',
      () => {},
    );
    assert.deepEqual(native.items, ['Clear cache']);
  });

  it('adds nothing in a release build', () => {
    const native = platform();
    const menu = serviceWith(DevMenu.SOURCE, { menu: native, development: false }, () =>
      useService(DevMenu),
    );
    menu.add('Clear cache', () => {});

    assert.equal(menu.available, false);
    assert.deepEqual(native.items, []);
  });

  it('registers the same title again after a hot reload, rather than dropping the new handler', () => {
    // DevSettings.addMenuItem already keys on title and swaps the handler in without adding a
    // second native entry, so a repeated title from a hot reload must still reach it - the fresh
    // handler is how a stale one, closing over a disposed component, stops being what fires.
    const native = platform();
    const menu = serviceWith(DevMenu.SOURCE, { menu: native, development: true }, () =>
      useService(DevMenu),
    );
    menu.add('Clear cache', () => {});
    menu.add('Clear cache', () => {});

    assert.deepEqual(native.items, ['Clear cache', 'Clear cache']);
  });
});
