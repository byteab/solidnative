/**
 * `ImageEditor`, over a fake of `expo-image-manipulator` that records every call.
 *
 * `edit()` is the module's own contextual API run start to finish: every action applied to one
 * context in order, the result rendered and saved, and both native objects released, since
 * nothing else holds them and they are native memory.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  FlipType,
  ImageEditor,
  SaveFormat,
  type NativeImageEditor,
} from '@solid-native/expo/image-editor';
import { disposeServices, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

function platform() {
  const calls: unknown[][] = [];
  const saved = { uri: 'file:///cache/out.png', width: 100, height: 50 };
  const image = {
    saveAsync: async (options: unknown) => (calls.push(['saveAsync', options]), saved),
    release: () => void calls.push(['image.release']),
  };
  const context: Record<string, unknown> = {};
  for (const step of ['resize', 'rotate', 'flip', 'crop', 'extent', 'reset']) {
    context[step] = (arg: unknown) => (calls.push([step, arg]), context);
  }
  Object.assign(context, {
    renderAsync: async () => (calls.push(['renderAsync']), image),
    release: () => void calls.push(['context.release']),
  });
  const native = {
    ImageManipulator: {
      manipulate: (source: unknown) => (calls.push(['manipulate', source]), context),
    },
  } as unknown as NativeImageEditor;
  return Object.assign(native, { calls, saved, context });
}

const serviceOn = (native: NativeImageEditor | null) => serviceWith(ImageEditor, native);

describe('image editor', () => {
  it('applies every action in order, saves the result, and releases what it made', async () => {
    const native = platform();
    const result = await serviceOn(native).edit(
      'file:///photo.jpg',
      [
        { resize: { width: 100 } },
        { rotate: 90 },
        { flip: FlipType.Horizontal },
        { crop: { originX: 0, originY: 0, width: 10, height: 10 } },
        { extent: { width: 20, height: 20, backgroundColor: '#fff' } },
      ],
      { format: SaveFormat.PNG, compress: 0.5 },
    );
    assert.equal(result, native.saved);
    assert.deepEqual(native.calls, [
      ['manipulate', 'file:///photo.jpg'],
      ['resize', { width: 100 }],
      ['rotate', 90],
      ['flip', 'horizontal'],
      ['crop', { originX: 0, originY: 0, width: 10, height: 10 }],
      ['extent', { width: 20, height: 20, backgroundColor: '#fff' }],
      ['renderAsync'],
      ['saveAsync', { format: 'png', compress: 0.5 }],
      ['context.release'],
      ['image.release'],
    ]);
  });

  it('saves as a JPEG unless asked otherwise, as the module s own manipulateAsync does', async () => {
    const native = platform();
    await serviceOn(native).edit('file:///photo.jpg');
    assert.deepEqual(
      native.calls.find(([name]) => name === 'saveAsync'),
      ['saveAsync', { format: 'jpeg' }],
    );
  });

  it('skips extent where the context has none, as the module does off the web', async () => {
    const native = platform();
    delete native.context['extent'];
    await serviceOn(native).edit('file:///photo.jpg', [
      { extent: { width: 20, height: 20 } },
      { rotate: 90 },
    ]);
    assert.deepEqual(native.calls.slice(0, 2), [
      ['manipulate', 'file:///photo.jpg'],
      ['rotate', 90],
    ]);
  });

  it('releases the context even when rendering fails', async () => {
    const native = platform();
    native.context['renderAsync'] = async () => {
      throw new Error('decode failed');
    };
    await assert.rejects(serviceOn(native).edit('file:///broken.jpg'), /decode failed/);
    assert.ok(native.calls.some(([name]) => name === 'context.release'));
  });

  it('hands over the module s context for a caller that chains its own steps', () => {
    const native = platform();
    assert.equal(serviceOn(native).manipulate('file:///photo.jpg'), native.context);
    assert.deepEqual(native.calls, [['manipulate', 'file:///photo.jpg']]);
  });

  it('is inert rather than broken with no module installed', async () => {
    const editor = serviceOn(null);
    assert.equal(await editor.edit('file:///photo.jpg', [{ rotate: 90 }]), null);
    assert.equal(editor.manipulate('file:///photo.jpg'), null);
  });
});

describe('save formats and flips', () => {
  it('are the module s own enums, so an edit can be written without loading the module', () => {
    // The module ships its enums as TypeScript source for Metro, so the declarations are read.
    const require = createRequire(import.meta.url);
    const types = readFileSync(
      require.resolve('expo-image-manipulator/build/ImageManipulator.types.d.ts'),
      'utf8',
    );
    const read = (name: string) => {
      const body = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(types)?.[1] ?? '';
      return Object.fromEntries(
        [...body.matchAll(/(\w+) = "(\w+)"/g)].map(([, key, value]) => [key, value]),
      );
    };
    assert.ok(Object.keys(read('SaveFormat')).length > 0, 'found the enum');
    assert.deepEqual({ ...SaveFormat }, read('SaveFormat'));
    assert.deepEqual({ ...FlipType }, read('FlipType'));
  });
});
