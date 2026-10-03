/**
 * `DocumentPicker`, over a fake of `expo-document-picker` that records every call.
 *
 * The options are the module's own, passed through unchanged; a cancelled picker answers with no
 * files rather than a result to unwrap.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  DocumentPicker,
  type NativeDocumentPicker,
  type PickedDocument,
} from '@solidnative/expo/document-picker';
import { disposeServices, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

const file: PickedDocument = {
  uri: 'file:///cache/report.pdf',
  name: 'report.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  lastModified: 0,
};

function platform(result: { canceled: boolean; assets: PickedDocument[] | null }) {
  const calls: unknown[][] = [];
  const native = {
    getDocumentAsync: async (...args: unknown[]) => (
      calls.push(['getDocumentAsync', ...args]),
      result
    ),
  } as unknown as NativeDocumentPicker;
  return Object.assign(native, { calls });
}

const serviceOn = (native: NativeDocumentPicker | null) => serviceWith(DocumentPicker, native);

describe('document picker', () => {
  it('reaches getDocumentAsync with its options, and hands back the files picked', async () => {
    const native = platform({ canceled: false, assets: [file] });
    const picked = await serviceOn(native).pick({ type: 'application/pdf', multiple: true });
    assert.deepEqual(picked, [file]);
    assert.deepEqual(native.calls, [
      ['getDocumentAsync', { type: 'application/pdf', multiple: true }],
    ]);
  });

  it('answers no files when the picker is cancelled', async () => {
    assert.deepEqual(await serviceOn(platform({ canceled: true, assets: null })).pick(), []);
  });

  it('is inert rather than broken with no module installed', async () => {
    assert.deepEqual(await serviceOn(null).pick(), []);
  });
});
