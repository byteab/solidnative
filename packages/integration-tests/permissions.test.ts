/**
 * Permissions, which every Expo module spells the same way and offers only as a React hook.
 *
 * `useCameraPermissions()`, `useForegroundPermissions()`, `useMediaLibraryPermissions()` - each is
 * the same pair of functions with a hook around it, so what is needed here is not one facade per
 * module but one facade that takes the pair. The module stays the app's dependency; this only
 * turns its answers into signals and remembers the last one.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Permission, type PermissionApi, type PermissionResponse } from '@solidnative/expo';
import { disposeServices, owned } from './expo-service.ts';

afterEach(disposeServices);

const granted: PermissionResponse = { status: 'granted', granted: true, canAskAgain: false };
const undetermined: PermissionResponse = {
  status: 'undetermined',
  granted: false,
  canAskAgain: true,
};
const denied: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };

function api(answers: PermissionResponse[]): PermissionApi & { asked: number } {
  let index = 0;
  const state = {
    asked: 0,
    get: async () => answers[Math.min(index, answers.length - 1)]!,
    request: async () => {
      state.asked++;
      return answers[Math.min(++index, answers.length - 1)]!;
    },
  };
  return state;
}

describe('a permission', () => {
  it('knows nothing until it is asked, which is not the same as denied', async () => {
    // The distinction the status carries and a boolean cannot: a permission nobody has asked
    // about is not a permission the user refused, and only one of those is worth a dialog.
    const permission = owned(() => new Permission(api([undetermined]))).value;
    assert.equal(permission.status(), 'unknown');
    assert.equal(permission.granted(), false);

    await permission.check();
    assert.equal(permission.status(), 'undetermined');
  });

  it('asks the user, and remembers what they said', async () => {
    const permission = owned(() => new Permission(api([undetermined, granted]))).value;

    assert.equal(await permission.request(), true);
    assert.equal(permission.granted(), true);
    assert.equal(permission.status(), 'granted');
  });

  it('does not ask twice when it already has an answer', async () => {
    const native = api([granted]);
    const permission = owned(() => new Permission(native)).value;

    await permission.check();
    assert.equal(await permission.ensure(), true, 'already granted');
    assert.equal(native.asked, 0, 'no dialog for something already allowed');
  });

  it('does not ask when the platform says it may not', async () => {
    // Denied for good: iOS shows no dialog for a second attempt, so a request here would be a
    // promise that resolves to the same no while looking like the user was consulted.
    const native = api([denied]);
    const permission = owned(() => new Permission(native)).value;

    await permission.check();
    assert.equal(await permission.ensure(), false);
    assert.equal(native.asked, 0);
    assert.equal(permission.blocked(), true, 'the app should send them to Settings instead');
  });

  it('asks once when nothing is known yet', async () => {
    const native = api([undetermined, granted]);
    const permission = owned(() => new Permission(native)).value;

    assert.equal(await permission.ensure(), true);
    assert.equal(native.asked, 1);
  });

  it('checks before asking, so an already-granted permission shows no dialog', async () => {
    // Without the check first this is a dialog for something the user allowed months ago.
    const native = api([granted]);
    const permission = owned(() => new Permission(native)).value;

    assert.equal(await permission.ensure(), true);
    assert.equal(native.asked, 0);
  });
});
