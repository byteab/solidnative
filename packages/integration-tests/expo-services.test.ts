/**
 * The last of the Expo surface that only had a React entry point.
 *
 * Each of these is the same story: the work underneath is a plain promise, and what the hook adds
 * is a *lifecycle* - open once and close, activate and release, download and say when. That is the
 * half that gets forgotten, so it is the half that is tested.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createSignal } from 'solid-js';
import { withServiceScope } from '@solid-native/device/solid';
import { assetResource, assets } from '@solid-native/expo/assets';
import { Database, type Migration, type NativeDatabase } from '@solid-native/expo/database';
import { KeepAwake } from '@solid-native/expo/keep-awake';
import { Updates } from '@solid-native/expo/updates';
import { disposeServices, owned, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

function database() {
  const log: string[] = [];
  let version = 0;
  const db: NativeDatabase & { log: string[]; opens: number } = {
    log,
    opens: 0,
    execAsync: async (source) => {
      log.push(source);
      const set = /PRAGMA user_version = (\d+)/.exec(source);
      if (set) version = Number(set[1]);
    },
    getFirstAsync: async <T>() => ({ user_version: version }) as T,
    closeAsync: async () => void log.push('close'),
    withTransactionAsync: async (task) => {
      // As SQLite does: `user_version` is transactional, so a rollback puts it back.
      const before = version;
      log.push('begin');
      try {
        await task();
      } catch (error) {
        version = before;
        log.push('rollback');
        throw error;
      }
      log.push('commit');
    },
  };
  return db;
}

const failing = (to: number): Migration => ({
  to,
  up: async () => {
    throw new Error(`migration ${to} failed`);
  },
});

const migration = (to: number): Migration => ({
  to,
  up: async (db) => void (await db.execAsync(`migrate ${to}`)),
});

describe('a database', () => {
  it('is not opened until something asks', async () => {
    // A database opened at startup is a file handle and a journal for an app that may never read
    // from it, and opening is the one call here that touches the disk.
    let opened = 0;
    const service = new Database(async () => (opened++, database()));
    assert.equal(opened, 0);

    await service.ready();
    assert.equal(opened, 1);
  });

  it('opens once however many callers arrive while it is opening', async () => {
    let opened = 0;
    const service = new Database(async () => {
      opened++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return database();
    });

    await Promise.all([service.ready(), service.ready(), service.ready()]);
    assert.equal(opened, 1, 'two connections to one file is a lock waiting to happen');
  });

  it('runs migrations in order, each in a transaction, and records where it got to', async () => {
    const db = database();
    const service = new Database(async () => db, [migration(2), migration(1)]);
    await service.ready();

    assert.deepEqual(db.log, [
      'begin',
      'migrate 1',
      'PRAGMA user_version = 1',
      'commit',
      'begin',
      'migrate 2',
      'PRAGMA user_version = 2',
      'commit',
    ]);
  });

  it('leaves the version where it was when a migration fails, so the next launch retries it', async () => {
    // The version bump is inside the migration's transaction, so a half-run migration can never
    // be recorded as done.
    const db = database();
    const service = new Database(async () => db, [migration(1), failing(2)]);
    await assert.rejects(service.ready(), /migration 2 failed/);

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    assert.equal(version?.user_version, 1, 'migration 1 committed, migration 2 rolled back');
  });

  it('does not commit a migration whose version bump fails', async () => {
    // Were the bump outside the transaction, the schema change would be committed and recorded
    // nowhere, and the next launch would run the migration a second time over its own result.
    const db = database();
    const exec = db.execAsync;
    db.execAsync = async (source) => {
      if (source === 'PRAGMA user_version = 1') throw new Error('bump failed');
      await exec(source);
    };
    await assert.rejects(new Database(async () => db, [migration(1)]).ready(), /bump failed/);
    assert.deepEqual(db.log.slice(0, 3), ['begin', 'migrate 1', 'rollback']);
  });

  it('closes the connection when a migration fails, and close() still succeeds', async () => {
    const db = database();
    const service = new Database(async () => db, [failing(1)]);
    await assert.rejects(service.ready(), /migration 1 failed/);
    assert.equal(db.log.filter((line) => line === 'close').length, 1, 'not left open');

    await service.close();
    assert.equal(db.log.filter((line) => line === 'close').length, 1, 'and not closed twice');
  });

  it('tries again on the next ready() after a failed open', async () => {
    let opened = 0;
    let broken = true;
    const flaky: Migration = {
      to: 1,
      up: async () => {
        if (broken) throw new Error('not yet');
      },
    };
    const service = new Database(async () => (opened++, database()), [flaky]);
    await assert.rejects(service.ready(), /not yet/);
    broken = false;
    await service.ready();
    assert.equal(opened, 2);
  });

  it('skips the migrations a database has already had', async () => {
    const db = database();
    await new Database(async () => db, [migration(1)]).ready();
    db.log.length = 0;

    await new Database(async () => db, [migration(1), migration(2)]).ready();
    assert.deepEqual(
      db.log.filter((line) => line.startsWith('migrate')),
      ['migrate 2'],
    );
  });

  it('reopens after it is closed', async () => {
    let opened = 0;
    const service = new Database(async () => (opened++, database()));
    await service.ready();
    await service.close();
    await service.ready();
    assert.equal(opened, 2);
  });
});

describe('updates', () => {
  const platform = (available: boolean, isNew = true) => ({
    enabled: true,
    reloaded: false,
    check: async () => ({ isAvailable: available }),
    fetch: async () => ({ isNew }),
    reload: async function (this: { reloaded: boolean }) {
      this.reloaded = true;
    },
  });

  it('checks and downloads in one call, because there is nothing to do in between', async () => {
    const updates = serviceWith(Updates, platform(true));
    assert.equal(await updates.check(), true);
    assert.equal(updates.ready(), true);
  });

  it('goes back to idle when there is nothing to fetch', async () => {
    const updates = serviceWith(Updates, platform(false));
    assert.equal(await updates.check(), false);
    assert.equal(updates.state(), 'idle');
  });

  it('does not restart the app for an update that is not ready', async () => {
    // Applying one restarts the app, which is why it is never automatic and never speculative.
    //
    // Checked first, and that is the point: without the check this only proved that a service
    // nobody had asked anything of does not reload - the idle state, not the "looked, and there
    // was nothing" state the title names.
    const native = platform(false);
    const updates = serviceWith(Updates, native);
    assert.equal(await updates.check(), false);
    await updates.apply();
    assert.equal(native.reloaded, false);
  });

  it('restarts once one is', async () => {
    const native = platform(true);
    const updates = serviceWith(Updates, native);
    await updates.check();
    await updates.apply();
    assert.equal(native.reloaded, true);
  });

  it('says it is disabled rather than checking forever in Expo Go', async () => {
    const updates = serviceWith(Updates, { ...platform(true), enabled: false });
    assert.equal(updates.enabled, false);
    assert.equal(await updates.check(), false);
    assert.equal(updates.state(), 'idle', 'no banner that can never resolve');
  });

  it('reads enabled straight off the platform when one is there to ask', () => {
    const updates = serviceWith(Updates, platform(true));
    assert.equal(updates.enabled, true);
  });

  it('is disabled with no platform at all, not just an Expo Go one', () => {
    const updates = serviceWith(Updates, null);
    assert.equal(updates.enabled, false);
  });

  it('records a failure rather than rejecting into a caller that cannot act on it', async () => {
    const updates = serviceWith(Updates, {
      enabled: true,
      check: async () => {
        throw new Error('no network');
      },
      fetch: async () => ({ isNew: false }),
      reload: async () => {},
    });

    assert.equal(await updates.check(), false);
    assert.equal(updates.state(), 'error');
    assert.match(String(updates.error()), /no network/);
  });
});

describe('assets', () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** A screen's owner and service scope, which is what an app's resources are created in. */
  const inApp = <T>(make: () => T): T => owned(() => withServiceScope([], make)).value;

  it('says when everything asked for has arrived', async () => {
    const assets = inApp(() =>
      assetResource({ load: async () => [{ uri: 'file://a.png', width: 10, height: 10 }] }, () => [
        1,
      ]),
    );

    assert.equal(assets.value(), undefined, 'nothing until the load resolves');
    assert.equal(assets.isLoading(), true);

    await settle();
    assert.equal(assets.value()?.length, 1);
    assert.equal(assets.isLoading(), false);
  });

  it('reports one that will not download without throwing at the screen', async () => {
    // A picture that will not appear is not a reason for the screen behind it to fail as well.
    const assets = inApp(() =>
      assetResource(
        {
          load: async () => {
            throw new Error('offline');
          },
        },
        () => [1],
      ),
    );

    await settle();
    assert.match(String(assets.error()), /offline/);
    assert.equal(assets.status(), 'error');
  });

  it('reloads when the modules asked for change', async () => {
    const asked: readonly (number | string)[][] = [];
    const [wanted, setWanted] = createSignal<readonly number[]>([1]);
    const assets = inApp(() =>
      assetResource(
        {
          load: async (modules: readonly (number | string)[]) => {
            (asked as (number | string)[][]).push([...modules]);
            return modules.map((m) => ({ uri: `file://${String(m)}.png`, width: 1, height: 1 }));
          },
        },
        () => wanted(),
      ),
    );

    await settle();
    assert.equal(assets.value()?.[0]?.uri, 'file://1.png');

    setWanted([2]);
    await settle();
    assert.equal(assets.value()?.[0]?.uri, 'file://2.png');
    assert.deepEqual(asked, [[1], [2]], 'the load re-ran, rather than holding the first answer');
  });

  it('does nothing but resolve empty where expo-asset is not installed', async () => {
    const assets = inApp(() => assetResource(null, () => [1]));

    await settle();
    assert.deepEqual(assets.value(), []);
    assert.equal(assets.error(), undefined);
  });

  it('reaches expo-asset itself, not just the fake every other test hands it', async () => {
    // Every test above provides `NativeAssets` directly; `assets()` is the function an app
    // actually calls, and what it adds over `assetResource` is finding `expo-asset` itself.
    const loaded: (readonly (number | string)[])[] = [];
    const host = globalThis as Record<string, unknown>;
    host['require'] = (id: string) => {
      if (id !== 'expo-asset') throw new Error(`Cannot find module '${id}'`);
      return {
        Asset: {
          loadAsync: async (modules: (number | string)[]) => {
            loaded.push(modules);
            return modules.map((m) => ({ uri: `file://${String(m)}.png`, width: 1, height: 1 }));
          },
        },
      };
    };

    try {
      const resource = inApp(() => assets(() => [7]));
      await settle();
      assert.deepEqual(loaded, [[7]]);
      assert.equal(resource.value()?.[0]?.uri, 'file://7.png');
    } finally {
      delete host['require'];
    }
  });
});

describe('keeping the screen on', () => {
  const platform = () => {
    const held: string[] = [];
    return {
      held,
      activate: async (tag: string) => void held.push(tag),
      // Releasing a tag native never activated is a no-op, as in expo-keep-awake: the Solid
      // service skips an activation released before it ran, then still deactivates the tag.
      deactivate: async (tag: string) => {
        const index = held.indexOf(tag);
        if (index >= 0) held.splice(index, 1);
      },
    };
  };

  it('hands back the release, which is the half that gets forgotten', async () => {
    const native = platform();
    const keepAwake = serviceWith(KeepAwake, native);

    const release = keepAwake.hold();
    await settle();
    assert.equal(keepAwake.active(), true);

    release();
    await settle();
    assert.deepEqual(native.held, []);
  });

  it('lets two screens hold it without either releasing the other', async () => {
    const keepAwake = serviceWith(KeepAwake, platform());
    const first = keepAwake.hold('video');
    keepAwake.hold('recording');

    first();
    assert.equal(keepAwake.active(), true, 'the recording is still going');
  });

  it('keeps a tag held until every hold under it is released', async () => {
    // Two screens of one kind hold the same tag: a video pushed over another video, each holding
    // the default. The native module keeps a set of tags, so the first release let both go.
    const native = platform();
    const keepAwake = serviceWith(KeepAwake, native);
    const below = keepAwake.hold();
    const above = keepAwake.hold();

    above();
    await settle();
    assert.equal(keepAwake.active(), true, 'the screen below still holds it');
    assert.ok(native.held.length > 0, 'and so does the device');

    below();
    await settle();
    assert.equal(keepAwake.active(), false);
    assert.deepEqual(native.held, []);
  });

  it('ignores a release called twice', async () => {
    const native = platform();
    const keepAwake = serviceWith(KeepAwake, native);
    const release = keepAwake.hold('a');
    keepAwake.hold('b');

    release();
    release();
    await settle();
    assert.deepEqual(native.held, ['b']);
  });
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
