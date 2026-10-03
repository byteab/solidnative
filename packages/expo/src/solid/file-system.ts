import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService } from './owned.ts';

/** A structural subset of Expo File; returned native files keep their full native API. */
export interface NativeFile {
  readonly uri: string;
  readonly exists: boolean;
  readonly size: number;
  create(options?: { overwrite?: boolean; intermediates?: boolean }): void;
  write(content: string | Uint8Array): void;
  text(): Promise<string>;
  textSync(): string;
  bytes(): Promise<Uint8Array>;
  delete(): void;
}
export type NativeDirectory = object;
export interface NativeFiles {
  readonly cacheDirectory: NativeDirectory;
  readonly documentDirectory: NativeDirectory;
  file(directory: NativeDirectory, name: string): NativeFile;
}
export interface FileSystem {
  cache(name: string): NativeFile;
  document(name: string): NativeFile;
  write(file: NativeFile, content: string | Uint8Array): void;
}

export const FileSystem = sourcedService<FileSystem, NativeFiles | null>(
  'expo.fileSystem',
  () => {
    const expo = expoModule(
      'expo-file-system',
      () => require('expo-file-system') as typeof import('expo-file-system'),
    );
    if (!expo) return null;
    return {
      get cacheDirectory() {
        return expo.Paths.cache;
      },
      get documentDirectory() {
        return expo.Paths.document;
      },
      file: (directory, name) =>
        new expo.File(directory as InstanceType<typeof expo.Directory>, name),
    };
  },
  (native) => {
    const requests = ownedRequests();
    const live = () => {
      if (!requests.active()) throw new Error('FileSystem service has been disposed.');
      if (!native)
        throw new Error('FileSystem needs expo-file-system: npx expo install expo-file-system');
      return native;
    };
    const locate = (directory: 'cacheDirectory' | 'documentDirectory', name: string) => {
      const source = live();
      const parent = source[directory];
      live();
      return source.file(parent, name);
    };
    return {
      cache: (name) => locate('cacheDirectory', name),
      document: (name) => locate('documentDirectory', name),
      write: (file, content) => {
        live();
        const exists = file.exists;
        live();
        if (!exists) file.create({ intermediates: true });
        live();
        file.write(content);
      },
    };
  },
);
