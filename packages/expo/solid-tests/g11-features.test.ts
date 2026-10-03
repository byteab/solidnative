import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createRoot, createComputed, untrack } from 'solid-js';
import { provideService, useService, withServiceScope } from '@solid-native/device/solid';
import { Database, database, type NativeDatabase } from '../src/solid/database.ts';
import {
  watchPlayer,
  videoPlayer,
  audioPlayer,
  type NativePlayer,
  type NativeVideoPlayer,
  type NativeAudioPlayer,
} from '../src/solid/player.ts';
import {
  LanguageModel,
  LanguageModelUnavailableError,
  type NativeLanguageModel,
  type NativeLanguageSession,
} from '../src/solid/language-model.ts';
const disposers: (() => void)[] = [];
afterEach(() => {
  for (const stop of disposers.splice(0)) stop();
});
function owned<T>(make: (stop: () => void) => T) {
  let stop!: () => void;
  const value = createRoot((dispose) => {
    stop = dispose;
    disposers.push(stop);
    return make(stop);
  });
  return { value, stop };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
function db() {
  const calls: string[] = [];
  const value: NativeDatabase = {
    execAsync: async (sql) => {
      calls.push(sql);
    },
    getFirstAsync: async <T>() => ({ user_version: 1 }) as T,
    withTransactionAsync: async (action) => {
      calls.push('begin');
      await action();
      calls.push('commit');
    },
    closeAsync: async () => {
      calls.push('close');
    },
  };
  return { value, calls };
}

test('Database preserves migration order, transactions and lazy singleton ready; close reopens', async () => {
  const first = db();
  let opens = 0;
  const store = new Database(async () => {
    opens++;
    return first.value;
  }, [
    {
      to: 3,
      up: async () => {
        first.calls.push('three');
      },
    },
    {
      to: 1,
      up: async () => {
        first.calls.push('skip');
      },
    },
    {
      to: 2,
      up: async () => {
        first.calls.push('two');
      },
    },
  ]);
  assert.equal(opens, 0);
  const a = store.ready();
  assert.equal(store.ready(), a);
  await a;
  assert.deepEqual(first.calls, [
    'begin',
    'two',
    'PRAGMA user_version = 2',
    'commit',
    'begin',
    'three',
    'PRAGMA user_version = 3',
    'commit',
  ]);
  await store.close();
  assert.equal(opens, 1);
  await store.ready();
  assert.equal(opens, 2);
  await store.close();
});
test('Database close/reopen never hands canceled connection to old callers and closes each handle once', async () => {
  const old = deferred<NativeDatabase>();
  const first = db(),
    second = db();
  let opens = 0;
  const store = new Database(() => (++opens === 1 ? old.promise : Promise.resolve(second.value)));
  const a = store.ready();
  const rejected = assert.rejects(a, /cancelled/);
  const closing = store.close();
  const b = store.ready();
  assert.equal(await b, second.value);
  old.resolve(first.value);
  await closing;
  await rejected;
  assert.deepEqual(first.calls, ['close']);
  assert.equal(await store.ready(), second.value);
  await store.close();
  assert.deepEqual(second.calls, ['close']);
});
test('Database owner disposal cancels opening and source helper stays lazy', async () => {
  const opened = deferred<NativeDatabase>();
  const native = db();
  let opens = 0;
  const owner = owned(
    () =>
      new Database(() => {
        opens++;
        return opened.promise;
      }),
  );
  const ready = owner.value.ready();
  const failed = assert.rejects(ready, /cancelled/);
  owner.stop();
  opened.resolve(native.value);
  await failed;
  assert.deepEqual(native.calls, ['close']);
  assert.equal(opens, 1);
  await assert.rejects(owner.value.ready(), /disposed/);
  const scoped = owned(() =>
    withServiceScope(
      [
        provideService(Database.SOURCE, () => ({
          open: async () => {
            opens++;
            return native.value as never;
          },
        })),
      ],
      () => database('notes'),
    ),
  );
  assert.equal(opens, 1);
  await scoped.value.ready();
  assert.equal(opens, 2);
  await scoped.value.close();
});
function playerSource() {
  const callbacks = new Map<string, (payload: never) => void>();
  const removed: string[] = [];
  let released = 0;
  const native: NativePlayer = {
    addListener: (name, callback) => {
      callbacks.set(name, callback);
      return {
        remove: () => {
          removed.push(name);
        },
      };
    },
    release: () => {
      released++;
    },
  };
  return {
    native,
    callbacks,
    removed,
    released: () => released,
    emit: (name: string, value: unknown) => callbacks.get(name)?.(value as never),
  };
}
test('video watcher preserves eight state events, seconds interval and owned cleanup', () => {
  const source = playerSource();
  const owner = owned(() => watchPlayer(source.native, { timeUpdate: 0.5 }));
  assert.equal(source.native.timeUpdateEventInterval, 0.5);
  source.emit('sourceChange', {});
  assert.equal(owner.value.state().status, 'loading');
  source.emit('sourceLoad', { duration: 40 });
  source.emit('statusChange', { status: 'readyToPlay' });
  source.emit('timeUpdate', { currentTime: 4 });
  source.emit('mutedChange', { muted: true });
  source.emit('volumeChange', { volume: 0.3 });
  source.emit('playToEnd', {});
  source.emit('playingChange', { isPlaying: true });
  assert.deepEqual(owner.value.state(), {
    playing: true,
    status: 'readyToPlay',
    duration: 40,
    currentTime: 4,
    muted: true,
    volume: 0.3,
    ended: false,
  });
  owner.stop();
  owner.value.stop();
  assert.equal(source.removed.length, 8);
  assert.equal(source.released(), 1);
  source.emit('timeUpdate', { currentTime: 88 });
  assert.equal(owner.value.state().currentTime, 4);
});
test('player factories retain native identity and audio uses milliseconds/status volume', () => {
  const video = playerSource(),
    audio = playerSource();
  const calls: unknown[] = [];
  (audio.native as { volume: number }).volume = 0.4;
  const owner = owned(() =>
    withServiceScope(
      [
        provideService(videoPlayer.SOURCE, () => ({
          create: (source) => {
            calls.push(source);
            return video.native as NativeVideoPlayer;
          },
        })),
        provideService(audioPlayer.SOURCE, () => ({
          create: (source, options) => {
            calls.push([source, options]);
            return audio.native as NativeAudioPlayer;
          },
        })),
      ],
      () => ({
        video: videoPlayer('movie', { timeUpdate: 1 }),
        audio: audioPlayer(7, { timeUpdate: 0.25 }),
      }),
    ),
  );
  assert.equal(owner.value.video.native, video.native);
  assert.equal(owner.value.audio.native, audio.native);
  assert.deepEqual(calls, ['movie', [7, { updateInterval: 250 }]]);
  audio.emit('playbackStatusUpdate', {
    playing: true,
    mute: false,
    duration: 10,
    currentTime: 2,
    isLoaded: true,
    didJustFinish: false,
    error: null,
  });
  assert.equal(owner.value.audio.state().volume, 0.4);
  assert.equal(owner.value.audio.state().status, 'readyToPlay');
  owner.stop();
  assert.equal(video.released(), 1);
  assert.equal(audio.released(), 1);
});
test('player acquisition disposal removes returned subscriptions without later interval writes', () => {
  let released = 0,
    removed = 0,
    intervals = 0;
  const owner = owned((stop) =>
    watchPlayer(
      {
        addListener: () => {
          stop();
          return {
            remove: () => {
              removed++;
            },
          };
        },
        release: () => {
          released++;
        },
        set timeUpdateEventInterval(_value: number) {
          intervals++;
        },
      },
      { timeUpdate: 1 },
    ),
  );
  assert.equal(removed, 1);
  assert.equal(released, 1);
  assert.equal(intervals, 0);
  owner.value.stop();
});
function model(native: NativeLanguageModel | null) {
  return owned(() =>
    withServiceScope([provideService(LanguageModel.SOURCE, () => native)], () =>
      useService(LanguageModel),
    ),
  );
}
function llm() {
  const sessions: {
    native: NativeLanguageSession;
    text?: (text: string) => void;
    answer: ReturnType<typeof deferred<string>>;
    cancelled: number;
    released: number;
  }[] = [];
  const removed: string[] = [];
  const configs: unknown[] = [];
  let availability: (value: string) => void = () => {};
  const native: NativeLanguageModel = {
    availability: () => 'available',
    onAvailabilityChange: (listener) => {
      availability = listener;
      return {
        remove: () => {
          removed.push('availability');
        },
      };
    },
    onDownloadProgress: () => ({
      remove: () => {
        removed.push('progress');
      },
    }),
    download: async () => {},
    session: (config) => {
      configs.push(config);
      const record = {
        answer: deferred<string>(),
        cancelled: 0,
        released: 0,
      } as (typeof sessions)[number];
      record.native = {
        respond: () => record.answer.promise,
        stream: (_prompt, callback) => {
          record.text = callback;
          return record.answer.promise;
        },
        cancel: async () => {
          record.cancelled++;
        },
        release: () => {
          record.released++;
        },
      };
      sessions.push(record);
      return record.native;
    },
  };
  return { native, sessions, configs, removed, change: (value: string) => availability(value) };
}
test('LanguageModel retains options/schema/errors and closes one-shot sessions on owner cancellation', async () => {
  const fake = llm(),
    owner = model(fake.native);
  assert.equal(owner.value.available(), true);
  const response = owner.value.generateObject<{ ok: boolean }>(
    'prompt',
    { ok: { type: 'boolean' } },
    { instructions: 'brief', temperature: 0.2 },
  );
  fake.sessions[0]!.answer.resolve('{"ok":true}');
  assert.deepEqual(await response, { ok: true });
  assert.equal(fake.sessions[0]!.released, 1);
  assert.deepEqual(fake.configs[0], {
    instructions: 'brief',
    options: { temperature: 0.2 },
    responseFormat: 'json',
    schema: { ok: { type: 'boolean' } },
  });
  const pending = owner.value.generate('later');
  const failed = assert.rejects(pending, /cancelled/);
  owner.stop();
  await failed;
  assert.equal(fake.sessions[1]!.released, 1);
  fake.sessions[1]!.answer.reject(Error('late'));
  await settle();
  assert.deepEqual(fake.removed, ['availability', 'progress']);
  const absent = model(null);
  await assert.rejects(absent.value.generate('x'), LanguageModelUnavailableError);
  const stream = absent.value.stream('x');
  assert.equal(stream.status(), 'failed');
  await assert.rejects(stream.result, LanguageModelUnavailableError);
});
test('LanguageModel stream cancellation keeps partial text and ignores late text/result/failure', async () => {
  const fake = llm(),
    owner = model(fake.native);
  const stream = owner.value.stream('hello');
  fake.sessions[0]!.text!('part');
  stream.cancel();
  assert.equal(await stream.result, 'part');
  assert.equal(stream.status(), 'cancelled');
  assert.equal(fake.sessions[0]!.cancelled, 1);
  assert.equal(fake.sessions[0]!.released, 1);
  fake.sessions[0]!.text!('stale');
  fake.sessions[0]!.answer.resolve('stale-final');
  await settle();
  assert.equal(stream.text(), 'part');
  stream.cancel();
  assert.equal(fake.sessions[0]!.released, 1);
  const next = owner.value.stream('done');
  fake.sessions[1]!.answer.resolve('final');
  assert.equal(await next.result, 'final');
  assert.equal(next.status(), 'done');
  assert.equal(fake.sessions[1]!.released, 1);
});
test('LanguageModel availability event beats initial snapshot; partial subscription failure rolls back', () => {
  const fake = llm();
  fake.native.onAvailabilityChange = (listener) => {
    listener('notReady');
    return { remove: () => fake.removed.push('availability') };
  };
  const owner = model(fake.native);
  assert.equal(owner.value.availability(), 'notReady');
  owner.stop();
  const broken = llm();
  broken.native.onDownloadProgress = () => {
    throw Error('subscription');
  };
  assert.throws(() => model(broken.native), /subscription/);
  assert.deepEqual(broken.removed, ['availability']);
});
test('LanguageModel status publication disposal cannot return stale success', async () => {
  const fake = llm(),
    owner = model(fake.native);
  const stream = owner.value.stream('hello');
  owned(() =>
    createComputed(() => {
      if (stream.status() === 'done') untrack(owner.stop);
    }),
  );
  fake.sessions[0]!.answer.resolve('final');
  await stream.result;
  assert.equal(stream.status(), 'cancelled');
  assert.equal(fake.sessions[0]!.released, 1);
});
