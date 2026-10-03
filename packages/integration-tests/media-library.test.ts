/**
 * `MediaLibrary`, over a fake of `expo-media-library` that records every call.
 *
 * The module's API is its classes - `Asset`, `Album` and `Query` - so the fake is those classes,
 * each recording what reached it. Saving asks for the write-only permission first, and the change
 * listener waits to be asked for, since starting it reads the library.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  AssetField,
  MediaLibrary,
  MediaType,
  type NativeMediaLibrary,
} from '@solidnative/expo/media-library';
import { disposeServices, ownedService, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

function platform(options: { granted?: boolean } = {}) {
  const { granted = true } = options;
  const calls: unknown[][] = [];
  let changed: ((event: unknown) => void) | undefined;
  const answer = { status: granted ? 'granted' : 'denied', granted, canAskAgain: true };

  class Asset {
    readonly id: string;
    constructor(id: string) {
      this.id = id;
    }
    static async create(...args: unknown[]) {
      calls.push(['Asset.create', ...args]);
      return new Asset('created');
    }
    static async delete(...args: unknown[]) {
      calls.push(['Asset.delete', ...args]);
    }
  }
  class Album {
    readonly id: string;
    constructor(id: string) {
      this.id = id;
    }
    static async create(...args: unknown[]) {
      calls.push(['Album.create', ...args]);
      return new Album('album');
    }
    static async delete(...args: unknown[]) {
      calls.push(['Album.delete', ...args]);
    }
    static async get(title: string) {
      calls.push(['Album.get', title]);
      return title === 'Trips' ? new Album('trips') : null;
    }
    static async getAll() {
      calls.push(['Album.getAll']);
      return [new Album('trips')];
    }
  }
  class Query {
    readonly steps: unknown[][] = [];
    eq(...args: unknown[]) {
      this.steps.push(['eq', ...args]);
      return this;
    }
    limit(count: number) {
      this.steps.push(['limit', count]);
      return this;
    }
    async exe() {
      calls.push(['Query.exe', ...this.steps]);
      return [new Asset('a1')];
    }
    async exeForMetadata() {
      calls.push(['Query.exeForMetadata', ...this.steps]);
      return [{ id: 'a1' }];
    }
  }
  const native = {
    getPermissionsAsync: async (...args: unknown[]) => (
      calls.push(['getPermissionsAsync', ...args]),
      answer
    ),
    requestPermissionsAsync: async (...args: unknown[]) => (
      calls.push(['requestPermissionsAsync', ...args]),
      answer
    ),
    presentPermissionsPicker: async (...args: unknown[]) =>
      void calls.push(['presentPermissionsPicker', ...args]),
    addListener: (listener: (event: unknown) => void) => {
      calls.push(['addListener']);
      changed = listener;
      return { remove: () => void calls.push(['remove']) };
    },
    Asset,
    Album,
    Query,
  } as unknown as NativeMediaLibrary;
  return Object.assign(native, {
    calls,
    change: (event: unknown) => changed?.(event),
    called: (name: string) => calls.filter(([one]) => one === name),
  });
}

const serviceOn = (native: NativeMediaLibrary | null) => serviceWith(MediaLibrary, native);

describe('media library', () => {
  it('saves a file after asking for the write-only permission', async () => {
    const native = platform();
    const library = serviceOn(native);
    const album = (await library.album('Trips'))!;
    const saved = await library.save('file:///photo.jpg', album);
    assert.equal(saved?.id, 'created');
    assert.deepEqual(native.called('getPermissionsAsync'), [['getPermissionsAsync', true]]);
    assert.deepEqual(native.called('Asset.create'), [['Asset.create', 'file:///photo.jpg', album]]);
  });

  it('saves nothing when writing is refused', async () => {
    const native = platform({ granted: false });
    assert.equal(await serviceOn(native).save('file:///photo.jpg'), null);
    assert.deepEqual(native.called('requestPermissionsAsync'), [['requestPermissionsAsync', true]]);
    assert.deepEqual(native.called('Asset.create'), []);
  });

  it('checks and asks for full access through the module s own pair', async () => {
    const native = platform();
    const library = serviceOn(native);
    assert.equal(await library.permission.check(), true);
    assert.equal(await library.permission.request(), true);
    assert.deepEqual(native.calls, [
      ['getPermissionsAsync', false],
      ['requestPermissionsAsync', false],
    ]);
  });

  it('asks with granular permissions, and the permission follows the answer', async () => {
    const native = platform();
    const library = serviceOn(native);
    assert.equal(await library.requestPermission(false, ['photo']), true);
    assert.deepEqual(native.called('requestPermissionsAsync'), [
      ['requestPermissionsAsync', false, ['photo']],
    ]);
    assert.equal(library.permission.granted(), true);
  });

  it('runs a query built on the module s own Query', async () => {
    const native = platform();
    const library = serviceOn(native);
    const photos = await library.assets((query) =>
      query.eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).limit(20),
    );
    const everything = await library.assets();
    const metadata = await library.metadata((query) => query.limit(1));
    assert.deepEqual(
      photos.map((one) => one.id),
      ['a1'],
    );
    assert.equal(everything.length, 1);
    assert.deepEqual(metadata, [{ id: 'a1' }]);
    assert.deepEqual(native.called('Query.exe'), [
      ['Query.exe', ['eq', 'mediaType', 'image'], ['limit', 20]],
      ['Query.exe'],
    ]);
    assert.deepEqual(native.called('Query.exeForMetadata'), [
      ['Query.exeForMetadata', ['limit', 1]],
    ]);
  });

  it('reaches the module s assets and albums under their own names, with their arguments', async () => {
    const native = platform();
    const library = serviceOn(native);
    const asset = library.asset('ph://1')!;
    assert.equal(asset.id, 'ph://1');
    await library.deleteAssets([asset]);
    assert.deepEqual(
      (await library.albums()).map((one) => one.id),
      ['trips'],
    );
    assert.equal(await library.album('Nowhere'), null);
    const album = await library.createAlbum('Trips', [asset], true);
    await library.deleteAlbums([album!], true);
    await library.presentPermissionsPicker(['photo']);
    for (const [name, ...args] of [
      ['Asset.delete', [asset]],
      ['Album.getAll'],
      ['Album.get', 'Nowhere'],
      ['Album.create', 'Trips', [asset], true],
      ['Album.delete', [album], true],
      ['presentPermissionsPicker', ['photo']],
    ] as const) {
      assert.deepEqual(native.called(name), [[name, ...args]], name);
    }
  });

  it('listens for changes only once asked, and once however often it is asked', () => {
    const native = platform();
    const library = serviceOn(native);
    assert.deepEqual(native.called('addListener'), [], 'starting the listener reads the library');
    const changes = library.watch();
    assert.equal(library.watch(), changes);
    assert.equal(changes(), null);
    native.change({ hasIncrementalChanges: true, insertedAssets: ['ph://2'] });
    assert.deepEqual(changes(), { hasIncrementalChanges: true, insertedAssets: ['ph://2'] });
    assert.deepEqual(native.called('addListener'), [['addListener']]);
  });

  it('stops listening when the app is destroyed', () => {
    const native = platform();
    const service = ownedService(MediaLibrary, native);
    service.value.watch();
    service.stop();
    assert.deepEqual(native.called('remove'), [['remove']]);
  });

  it('is inert rather than broken with no module installed', async () => {
    const library = serviceOn(null);
    assert.equal(await library.permission.ensure(), false);
    assert.equal(await library.writePermission.ensure(), false);
    assert.equal(await library.requestPermission(), false);
    assert.equal(await library.save('file:///photo.jpg'), null);
    assert.deepEqual(await library.assets(), []);
    assert.deepEqual(await library.metadata(), []);
    assert.equal(library.asset('ph://1'), null);
    assert.deepEqual(await library.albums(), []);
    assert.equal(await library.album('Trips'), null);
    assert.equal(await library.createAlbum('Trips', []), null);
    await library.deleteAssets([]);
    await library.deleteAlbums([]);
    await library.presentPermissionsPicker();
    assert.equal(library.watch()(), null);
  });
});

describe('media types and asset fields', () => {
  it('are the module s own enums, so a query can be written without loading the module', () => {
    // The enums live in files Node cannot load, so their compiled lines are read as text.
    const require = createRequire(import.meta.url);
    const root = path.dirname(require.resolve('expo-media-library/package.json'));
    const read = (name: string) => {
      const source = readFileSync(path.join(root, `build/types/${name}.js`), 'utf8');
      return Object.fromEntries(
        [...source.matchAll(new RegExp(`${name}\\["(\\w+)"\\] = "(\\w+)"`, 'g'))].map(
          ([, key, value]) => [key, value],
        ),
      );
    };
    assert.ok(Object.keys(read('MediaType')).length > 0, 'found the enum');
    assert.deepEqual({ ...MediaType }, read('MediaType'));
    assert.deepEqual({ ...AssetField }, read('AssetField'));
  });
});
