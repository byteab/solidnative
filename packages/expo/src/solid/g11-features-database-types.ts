import type { SQLiteRunResult } from './database.ts';
/** Neutral structural declarations for Expo SQLite native handles. */

export type SQLiteBindValue = string | number | null | boolean | SQLiteBindBlobValue;
export type SQLiteBindParams = Record<string, SQLiteBindValue> | SQLiteBindValue[];
export type SQLiteVariadicBindParams = SQLiteBindValue[];
export type SQLiteBindBlobValue = Uint8Array | ArrayBuffer;
export type SQLiteBindPrimitiveParams = Record<
  string,
  Exclude<SQLiteBindValue, SQLiteBindBlobValue>
>;
export type SQLiteBindBlobParams = Record<string, SQLiteBindBlobValue>;
export type SQLiteColumnNames = string[];
export type SQLiteColumnValues = unknown[];
export type SQLiteAnyDatabase = unknown;
export interface NativeSQLiteStatement {
  runAsync(
    database: SQLiteAnyDatabase,
    bindParams: SQLiteBindPrimitiveParams,
    bindBlobParams: SQLiteBindBlobParams,
    shouldPassAsArray: boolean,
  ): Promise<
    SQLiteRunResult & {
      firstRowValues: SQLiteColumnValues;
    }
  >;
  stepAsync(database: SQLiteAnyDatabase): Promise<SQLiteColumnValues | null | undefined>;
  getAllAsync(database: SQLiteAnyDatabase): Promise<SQLiteColumnValues[]>;
  resetAsync(database: SQLiteAnyDatabase): Promise<void>;
  getColumnNamesAsync(): Promise<SQLiteColumnNames>;
  finalizeAsync(database: SQLiteAnyDatabase): Promise<void>;
  runSync(
    database: SQLiteAnyDatabase,
    bindParams: SQLiteBindPrimitiveParams,
    bindBlobParams: SQLiteBindBlobParams,
    shouldPassAsArray: boolean,
  ): SQLiteRunResult & {
    firstRowValues: SQLiteColumnValues;
  };
  stepSync(database: SQLiteAnyDatabase): SQLiteColumnValues | null | undefined;
  getAllSync(database: SQLiteAnyDatabase): SQLiteColumnValues[];
  resetSync(database: SQLiteAnyDatabase): void;
  getColumnNamesSync(): string[];
  finalizeSync(database: SQLiteAnyDatabase): void;
}
export type Changeset = Uint8Array;
export type NativeChangeset = ArrayBuffer;

export interface NativeSQLiteSession {
  attachAsync(database: SQLiteAnyDatabase, table: string | null): Promise<void>;
  enableAsync(database: SQLiteAnyDatabase, enabled: boolean): Promise<void>;
  closeAsync(database: SQLiteAnyDatabase): Promise<void>;
  createChangesetAsync(database: SQLiteAnyDatabase): Promise<NativeChangeset>;
  createInvertedChangesetAsync(database: SQLiteAnyDatabase): Promise<NativeChangeset>;
  applyChangesetAsync(
    database: SQLiteAnyDatabase,
    changeset: Changeset | NativeChangeset,
  ): Promise<void>;
  invertChangesetAsync(
    database: SQLiteAnyDatabase,
    changeset: Changeset | NativeChangeset,
  ): Promise<NativeChangeset>;
  attachSync(database: SQLiteAnyDatabase, table: string | null): void;
  enableSync(database: SQLiteAnyDatabase, enabled: boolean): void;
  closeSync(database: SQLiteAnyDatabase): void;
  createChangesetSync(database: SQLiteAnyDatabase): NativeChangeset;
  createInvertedChangesetSync(database: SQLiteAnyDatabase): NativeChangeset;
  applyChangesetSync(database: SQLiteAnyDatabase, changeset: Changeset | NativeChangeset): void;
  invertChangesetSync(
    database: SQLiteAnyDatabase,
    changeset: Changeset | NativeChangeset,
  ): NativeChangeset;
}
export interface NativeSQLiteDatabase {
  initAsync(): Promise<void>;
  isInTransactionAsync(): Promise<boolean>;
  closeAsync(): Promise<void>;
  execAsync(source: string): Promise<void>;
  serializeAsync(databaseName: string): Promise<Uint8Array>;
  prepareAsync(
    nativeStatement: NativeSQLiteStatement,
    source: string,
  ): Promise<NativeSQLiteStatement>;
  createSessionAsync(
    nativeSession: NativeSQLiteSession,
    dbName: string,
  ): Promise<NativeSQLiteSession>;
  loadExtensionAsync(libPath: string, entryPoint?: string): Promise<void>;
  initSync(): void;
  isInTransactionSync(): boolean;
  closeSync(): void;
  execSync(source: string): void;
  serializeSync(databaseName: string): Uint8Array;
  prepareSync(nativeStatement: NativeSQLiteStatement, source: string): NativeSQLiteStatement;
  createSessionSync(nativeSession: NativeSQLiteSession, dbName: string): NativeSQLiteSession;
  loadExtensionSync(libPath: string, entryPoint?: string): void;
  syncLibSQL(): Promise<void>;
}
export interface SQLiteOpenOptions {
  enableChangeListener?: boolean;
  useNewConnection?: boolean;
  finalizeUnusedStatementsBeforeClosing?: boolean;
  libSQLOptions?: {
    url: string;
    authToken: string;
    remoteOnly?: boolean;
  };
}
