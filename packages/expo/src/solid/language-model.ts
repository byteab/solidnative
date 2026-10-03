import { createSignal, getOwner, onCleanup, untrack, type Accessor } from 'solid-js';
import { expoModule } from '../native.ts';
import { ownedRequests, sourcedService, silence } from './owned.ts';

export type LanguageModelAvailability =
  | 'available'
  | 'notEligible'
  | 'notEnabled'
  | 'notReady'
  | 'downloadRequired'
  | 'downloading'
  | 'unknown'
  | 'notInstalled';

const REPORTED = new Set<string>([
  'available',
  'notEligible',
  'notEnabled',
  'notReady',
  'downloadRequired',
  'downloading',
  'unknown',
]);

export interface GenerateOptions {
  /** System instructions: who the model is and how it answers. Kept apart from the prompt. */
  readonly instructions?: string;
  readonly temperature?: number;
  /** Capped at 256 on Android. */
  readonly maxTokens?: number;
  readonly topK?: number;
}

/** A structured answer's shape: `expo-local-llm`'s own schema, a field per property. */
export type LanguageModelSchemaField =
  | { type: 'string'; description?: string; enum?: string[] }
  | { type: 'number' | 'integer' | 'boolean'; description?: string }
  | { type: 'array'; description?: string; items: LanguageModelSchemaField }
  | { type: 'object'; description?: string; properties: LanguageModelSchema };
export type LanguageModelSchema = Record<string, LanguageModelSchemaField>;

export interface LanguageModelSessionConfig {
  instructions?: string;
  options?: { temperature?: number; maxTokens?: number; topK?: number };
  responseFormat?: 'text' | 'json';
  schema?: LanguageModelSchema;
}
type SessionConfig = LanguageModelSessionConfig;

/** The slice of an `expo-local-llm` session this needs, with its token event unwrapped. */
export interface NativeLanguageSession {
  respond(prompt: string): Promise<string>;
  /** Resolves with the whole text, or the text so far when cancelled; rejects on failure. */
  stream(prompt: string, onText: (textSoFar: string) => void): Promise<string>;
  cancel(): Promise<void>;
  release(): void;
}

/** The slice of `expo-local-llm` this needs. */
export interface NativeLanguageModel {
  availability(): string;
  onAvailabilityChange(listener: (availability: string) => void): { remove(): void };
  onDownloadProgress(listener: (progress: number) => void): { remove(): void };
  download(): Promise<void>;
  session(config: SessionConfig): NativeLanguageSession;
}

/** Why a call was refused before it reached the model. */
export class LanguageModelUnavailableError extends Error {
  readonly reason: Exclude<LanguageModelAvailability, 'available'>;

  constructor(reason: Exclude<LanguageModelAvailability, 'available'>) {
    super(`The on-device language model is unavailable: ${reason}`);
    this.name = 'LanguageModelUnavailableError';
    this.reason = reason;
  }
}

export type LanguageModelStreamStatus = 'streaming' | 'done' | 'cancelled' | 'failed';

/** One streamed answer, as signals a template binds. */
export interface LanguageModelStream {
  /** The text so far; the whole answer once `status` is `done`. */
  readonly text: Accessor<string>;
  readonly status: Accessor<LanguageModelStreamStatus>;
  /** The failure's message while `status` is `failed`, otherwise null. */
  readonly error: Accessor<string | null>;
  /** The final text (the partial text if cancelled). Rejects if the stream fails. */
  readonly result: Promise<string>;
  /** Stop generating. The text so far is kept. Does nothing once the stream has ended. */
  cancel(): void;
}

export interface LanguageModel {
  readonly availability: Accessor<LanguageModelAvailability>;
  readonly available: Accessor<boolean>;
  readonly downloadProgress: Accessor<number | null>;
  refresh(): LanguageModelAvailability;
  download(): Promise<void>;
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  generateObject<T = unknown>(
    prompt: string,
    schema: LanguageModelSchema,
    options?: GenerateOptions,
  ): Promise<T>;
  stream(prompt: string, options?: GenerateOptions): LanguageModelStream;
}
export const LanguageModel = sourcedService<LanguageModel, NativeLanguageModel | null>(
  'expo.languageModel',
  () => {
    const llm = expoModule(
      'expo-local-llm',
      () => {
        const loaded = require('expo-local-llm') as typeof import('expo-local-llm');
        return loaded.ExpoLocalLlmModule ? loaded : null;
      },
      ['ios'],
    );
    const module = llm?.ExpoLocalLlmModule;
    if (!llm || !module) return null;
    return {
      availability: () => module.getAvailability(),
      onAvailabilityChange: (listener) =>
        module.addListener('availabilityChange', (event) => listener(event.availability)),
      onDownloadProgress: (listener) =>
        module.addListener('downloadProgress', (event) => listener(event.progress)),
      download: () => module.downloadModel(),
      session: (options) => {
        const session = llm.createLLMSession(options);
        return {
          respond: (prompt) => session.respond(prompt),
          stream: async (prompt, onText) => {
            const tokens = session.addListener('token', (event) => onText(event.accumulated));
            try {
              return await session.streamResponse(prompt);
            } finally {
              silence(() => tokens.remove());
            }
          },
          cancel: () => session.cancelStream(),
          release: () => session.release(),
        };
      },
    };
  },
  createLanguageModel,
);

function createLanguageModel(native: NativeLanguageModel | null): LanguageModel {
  const requests = ownedRequests();
  const [availability, setAvailability] = createSignal<LanguageModelAvailability>('notInstalled');
  const [downloadProgress, setDownloadProgress] = createSignal<number | null>(null);
  const cleanups = new Set<() => void>();
  let live = true;
  let reading = 0;
  let streaming: LanguageModelStream | undefined;
  onCleanup(() => {
    live = false;
    streaming?.cancel();
    for (const cleanup of [...cleanups]) cleanup();
    cleanups.clear();
  });
  const keep = (subscription: { remove(): void }) => {
    const remove = () => {
      cleanups.delete(remove);
      silence(() => subscription.remove());
    };
    if (live) cleanups.add(remove);
    else remove();
  };
  const refresh = () => {
    if (!live) return untrack(availability);
    const request = ++reading;
    const value = native ? known(native.availability()) : 'notInstalled';
    if (live && request === reading) setAvailability(value);
    return untrack(availability);
  };
  try {
    if (native) {
      keep(
        native.onAvailabilityChange((value) => {
          if (live) {
            reading++;
            setAvailability(known(value));
          }
        }),
      );
      if (live)
        keep(
          native.onDownloadProgress((value) => {
            if (live) setDownloadProgress(value);
          }),
        );
    }
    if (reading === 0) refresh();
  } catch (error) {
    live = false;
    for (const cleanup of [...cleanups]) cleanup();
    throw error;
  }
  const requireAvailable = () => {
    const current = refresh();
    if (current !== 'available') throw new LanguageModelUnavailableError(current);
  };
  const once = (options: SessionConfig, prompt: string) =>
    requests
      .run<string | null>(null, async (active) => {
        requireAvailable();
        if (!active() || !live) return null;
        const session = native!.session(options);
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          cleanups.delete(cancel);
          silence(() => session.release());
        };
        const cancel = () => {
          if (released) return;
          released = true;
          cleanups.delete(cancel);
          silence(() => session.cancel());
          silence(() => session.release());
        };
        if (!active() || !live) {
          cancel();
          return null;
        }
        cleanups.add(cancel);
        if (getOwner()) onCleanup(cancel);
        try {
          return await session.respond(prompt);
        } finally {
          release();
        }
      })
      .then((value) => {
        if (value === null) throw new Error('Language model request was cancelled.');
        return value;
      });
  return {
    availability,
    available: () => availability() === 'available',
    downloadProgress,
    refresh,
    download: () => requests.run(undefined, () => native?.download()),
    generate: (prompt, options = {}) => once(config(options), prompt),
    generateObject: async <T>(
      prompt: string,
      schema: LanguageModelSchema,
      options: GenerateOptions = {},
    ) =>
      JSON.parse(await once({ ...config(options), responseFormat: 'json', schema }, prompt)) as T,
    stream: (prompt, options = {}) => {
      const previous = streaming;
      let operation!: ReturnType<typeof createStream>;
      operation = createStream(() => live && streaming === operation, cleanups);
      streaming = operation;
      previous?.cancel();
      if (getOwner()) onCleanup(operation.cancel);
      if (!live || streaming !== operation) {
        operation.cancel();
        return operation;
      }
      try {
        requireAvailable();
        if (!live || streaming !== operation || operation.status() !== 'streaming') {
          operation.cancel();
          return operation;
        }
        operation.start(() => native!.session(config(options)), prompt);
      } catch (error) {
        operation.fail(error);
      }
      return operation;
    },
  };
}

function createStream(current: () => boolean, cleanups: Set<() => void>) {
  const [snapshot, publish] = createSignal<{
    text: string;
    status: LanguageModelStreamStatus;
    error: string | null;
  }>({ text: '', status: 'streaming', error: null });
  let resolve!: (text: string) => void;
  let reject!: (error: unknown) => void;
  const result = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  void result.catch(() => {});
  let done = false;
  let session: NativeLanguageSession | undefined;
  const release = () => {
    const native = session;
    session = undefined;
    cleanups.delete(cancel);
    if (native) silence(() => native.release());
  };
  const cancel = () => {
    if (done) return;
    done = true;
    const text = untrack(snapshot).text;
    const native = session;
    publish({ text, status: 'cancelled', error: null });
    resolve(text);
    if (native) silence(() => native.cancel());
    release();
  };
  const fail = (error: unknown) => {
    if (done) return;
    publish({
      ...untrack(snapshot),
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
    if (done) return;
    done = true;
    reject(error);
    release();
  };
  return {
    text: () => snapshot().text,
    status: () => snapshot().status,
    error: () => snapshot().error,
    result,
    cancel,
    fail,
    start: (acquire: () => NativeLanguageSession, prompt: string) => {
      cleanups.add(cancel);
      const acquired = acquire();
      if (done || !current()) {
        silence(() => acquired.cancel());
        silence(() => acquired.release());
        return;
      }
      session = acquired;
      try {
        void Promise.resolve(
          acquired.stream(prompt, (text) => {
            if (!done && current()) publish({ text, status: 'streaming', error: null });
          }),
        ).then((text) => {
          if (done || !current()) return;
          publish({ text, status: 'done', error: null });
          if (done || !current()) return;
          done = true;
          resolve(text);
          release();
        }, fail);
      } catch (error) {
        fail(error);
      }
    },
  };
}
function known(value: string): LanguageModelAvailability {
  return REPORTED.has(value) ? (value as LanguageModelAvailability) : 'unknown';
}
function config({ instructions, ...sampling }: GenerateOptions): SessionConfig {
  const options = Object.fromEntries(
    Object.entries(sampling).filter(([, value]) => value !== undefined),
  );
  return {
    ...(instructions === undefined ? {} : { instructions }),
    ...(Object.keys(options).length ? { options } : {}),
  };
}
