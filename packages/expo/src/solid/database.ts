import type { NativeSQLiteDatabase, SQLiteOpenOptions } from './g11-features-database-types.ts';
export type * from './g11-features-database-types.ts';
import { getOwner, onCleanup } from 'solid-js';
import { createServiceToken, useService } from '@solidnative/device/solid';
import { expoModule } from '../native.ts';
import { silence } from './owned.ts';

export interface NativeDatabase {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  closeAsync(): Promise<void>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
export interface SQLiteRunResult {
  lastInsertRowId: number;
  changes: number;
}
export interface SQLiteResult<T> extends AsyncIterableIterator<T> {
  readonly lastInsertRowId: number;
  readonly changes: number;
  getFirstAsync(): Promise<T | null>;
  getAllAsync(): Promise<T[]>;
  resetAsync(): Promise<void>;
}
export interface SQLiteSyncResult<T> extends IterableIterator<T> {
  readonly lastInsertRowId: number;
  readonly changes: number;
  getFirstSync(): T | null;
  getAllSync(): T[];
  resetSync(): void;
}
export interface SQLiteStatement {
  executeAsync<T = unknown>(...params: unknown[]): Promise<SQLiteResult<T>>;
  executeSync<T = unknown>(...params: unknown[]): SQLiteSyncResult<T>;
  executeForRawResultAsync<T extends object>(
    ...params: unknown[]
  ): Promise<SQLiteResult<T[keyof T][]>>;
  executeForRawResultSync<T extends object>(...params: unknown[]): SQLiteSyncResult<T[keyof T][]>;
  getColumnNamesAsync(): Promise<string[]>;
  getColumnNamesSync(): string[];
  finalizeAsync(): Promise<void>;
  finalizeSync(): void;
}
export interface SQLiteSession {
  attachAsync(table: string | null): Promise<void>;
  attachSync(table: string | null): void;
  enableAsync(enabled: boolean): Promise<void>;
  enableSync(enabled: boolean): void;
  createChangesetAsync(): Promise<Uint8Array>;
  createChangesetSync(): Uint8Array;
  createInvertedChangesetAsync(): Promise<Uint8Array>;
  createInvertedChangesetSync(): Uint8Array;
  applyChangesetAsync(changeset: Uint8Array): Promise<void>;
  applyChangesetSync(changeset: Uint8Array): void;
  invertChangesetAsync(changeset: Uint8Array): Promise<Uint8Array>;
  invertChangesetSync(changeset: Uint8Array): Uint8Array;
  closeAsync(): Promise<void>;
  closeSync(): void;
}
export type SQLiteTaggedQueryResult<T> = [unknown] extends [T] ? unknown[] | SQLiteRunResult : T[];
export interface SQLiteTaggedQuery<T> extends PromiseLike<SQLiteTaggedQueryResult<T>> {
  values(): Promise<unknown[][]>;
  first(): Promise<T | null>;
  each(): AsyncIterableIterator<T>;
  allSync(): SQLiteTaggedQueryResult<T>;
  valuesSync(): unknown[][];
  firstSync(): T | null;
  eachSync(): IterableIterator<T>;
}
/** Neutral native query surface. The returned object is Expo's unchanged database. */
export interface SQLiteDatabase extends NativeDatabase {
  readonly databasePath: string;
  readonly options: SQLiteOpenOptions;
  readonly nativeDatabase: NativeSQLiteDatabase;
  isInTransactionAsync(): Promise<boolean>;
  isInTransactionSync(): boolean;
  serializeAsync(databaseName?: string): Promise<Uint8Array>;
  serializeSync(databaseName?: string): Uint8Array;
  prepareAsync(source: string): Promise<SQLiteStatement>;
  prepareSync(source: string): SQLiteStatement;
  createSessionAsync(dbName?: string): Promise<SQLiteSession>;
  createSessionSync(dbName?: string): SQLiteSession;
  loadExtensionAsync(path: string, entry?: string): Promise<void>;
  loadExtensionSync(path: string, entry?: string): void;
  withExclusiveTransactionAsync(
    task: (transaction: SQLiteDatabase) => Promise<void>,
  ): Promise<void>;
  withTransactionSync(task: () => void): void;
  execSync(source: string): void;
  closeSync(): void;
  runAsync(source: string, ...params: unknown[]): Promise<SQLiteRunResult>;
  runSync(source: string, ...params: unknown[]): SQLiteRunResult;
  getFirstSync<T>(source: string, ...params: unknown[]): T | null;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  getAllSync<T>(source: string, ...params: unknown[]): T[];
  getEachAsync<T>(source: string, ...params: unknown[]): AsyncIterableIterator<T>;
  getEachSync<T>(source: string, ...params: unknown[]): IterableIterator<T>;
  sql<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): SQLiteTaggedQuery<T>;
  syncLibSQL(): Promise<void>;
}
export interface Migration {
  readonly to: number;
  readonly up: (database: NativeDatabase) => Promise<void>;
}
export interface DatabaseSource {
  open(name: string): Promise<SQLiteDatabase>;
}
interface Opening<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
  closed: boolean;
  database?: T;
  closing?: Promise<void>;
}
export class Database<T extends NativeDatabase> {
  static readonly SOURCE = createServiceToken<DatabaseSource>('expo.database.source', () => ({
    open: async (name) => {
      const expo = expoModule(
        'expo-sqlite',
        () => require('expo-sqlite') as typeof import('expo-sqlite'),
        ['ios', 'android', 'web'],
      );
      if (!expo) throw new Error('expo-sqlite is not installed');
      return expo.openDatabaseAsync(name) as Promise<SQLiteDatabase>;
    },
  }));
  private readonly open: () => Promise<T>;
  private readonly migrations: readonly Migration[];
  private opening: Opening<T> | null = null;
  private active = true;
  constructor(open: () => Promise<T>, migrations: readonly Migration[] = []) {
    this.open = open;
    this.migrations = [...migrations].sort((a, b) => a.to - b.to);
    if (getOwner()) onCleanup(() => this.dispose());
  }
  ready(): Promise<T> {
    if (!this.active) return Promise.reject(new Error('Database has been disposed.'));
    if (this.opening) return this.opening.promise;
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const operation: Opening<T> = { promise, resolve, reject, closed: false };
    this.opening = operation;
    void promise.catch(() => {
      if (this.opening === operation) this.opening = null;
    });
    void this.start(operation);
    return promise;
  }
  async close(): Promise<void> {
    const operation = this.opening;
    this.opening = null;
    if (!operation) return;
    operation.closed = true;
    await operation.promise.catch(() => {});
    await this.release(operation);
  }
  dispose(): void {
    if (!this.active) return;
    this.active = false;
    silence(() => this.close());
  }
  private release(operation: Opening<T>): Promise<void> {
    if (!operation.database) return Promise.resolve();
    if (!operation.closing) {
      // Publish the promise before native close, which may synchronously reopen the wrapper.
      operation.closing = Promise.resolve().then(() => operation.database!.closeAsync());
    }
    return operation.closing;
  }
  private check(operation: Opening<T>): void {
    if (operation.closed || !this.active) throw new Error('Database opening was cancelled.');
  }
  private async start(operation: Opening<T>): Promise<void> {
    try {
      operation.database = await this.open();
      this.check(operation);
      await this.migrate(operation);
      this.check(operation);
      operation.resolve(operation.database);
    } catch (error) {
      await this.release(operation).catch(() => {});
      operation.reject(error);
    }
  }
  private async migrate(operation: Opening<T>): Promise<void> {
    if (!this.migrations.length) return;
    const db = operation.database!;
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    this.check(operation);
    let version = row?.user_version ?? 0;
    for (const migration of this.migrations) {
      if (migration.to <= version) continue;
      this.check(operation);
      await db.withTransactionAsync(async () => {
        this.check(operation);
        await migration.up(db);
        this.check(operation);
        await db.execAsync(`PRAGMA user_version = ${migration.to}`);
      });
      this.check(operation);
      version = migration.to;
    }
  }
}
export function database(
  name: string,
  migrations: readonly Migration[] = [],
): Database<SQLiteDatabase> {
  const source = getOwner() ? useService(Database.SOURCE) : undefined;
  return new Database(() => (source ?? Database.SOURCE.create()).open(name), migrations);
}
