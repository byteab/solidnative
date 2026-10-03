import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';

export interface DocumentPickerOptions {
  type?: string | string[];
  copyToCacheDirectory?: boolean;
  multiple?: boolean;
  base64?: boolean;
}
export interface PickedDocument {
  name: string;
  size?: number;
  uri: string;
  mimeType?: string;
  lastModified: number;
  file?: File;
  base64?: string;
}
export interface NativeDocumentPicker {
  getDocumentAsync(
    options?: DocumentPickerOptions,
  ): Promise<{ canceled: boolean; assets: PickedDocument[] | null }>;
}
export interface DocumentPicker {
  pick(options?: DocumentPickerOptions): Promise<readonly PickedDocument[]>;
}
export const DocumentPicker = sourcedService<DocumentPicker, NativeDocumentPicker | null>(
  'expo.documentPicker',
  () =>
    expoModule(
      'expo-document-picker',
      () => require('expo-document-picker') as NativeDocumentPicker,
    ),
  (native) => {
    const requests = ownedRequests();
    return {
      pick: (options) =>
        requests.run<readonly PickedDocument[]>([], async () => {
          const result = await native?.getDocumentAsync(options);
          return result?.canceled ? [] : (result?.assets ?? []);
        }),
    };
  },
);
