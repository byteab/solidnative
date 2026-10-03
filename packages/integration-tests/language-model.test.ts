/**
 * The on-device language model, over a fake `expo-local-llm`.
 *
 * What is pinned is what the service adds over the module: the availability as a signal that
 * follows the platform, a call refused with the platform's reason rather than an opaque native
 * error, each call in a session of its own that is released afterwards, and a stream that a
 * template can bind - the text so far, whether it finished, and a way to stop it.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  LanguageModel,
  LanguageModelUnavailableError,
  type LanguageModelSchema,
  type NativeLanguageModel,
  type NativeLanguageSession,
} from '@solid-native/expo/language-model';
import { disposeServices, serviceWith } from './expo-service.ts';

afterEach(disposeServices);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A model that answers `generate` at once, and streams only when the test says so. */
function fakeModel(availability = 'available') {
  const log: unknown[] = [];
  let changeAvailability: ((value: string) => void) | null = null;
  let reportProgress: ((value: number) => void) | null = null;
  let current = availability;
  const streams: {
    onText: (text: string) => void;
    finish: (text: string) => void;
    fail: (error: Error) => void;
    last: string;
  }[] = [];

  const native: NativeLanguageModel = {
    availability: () => current,
    onAvailabilityChange: (listener) => {
      changeAvailability = listener;
      return { remove: () => {} };
    },
    onDownloadProgress: (listener) => {
      reportProgress = listener;
      return { remove: () => {} };
    },
    download: async () => void log.push('download'),
    session: (config) => {
      const id = log.filter((entry) => Array.isArray(entry) && entry[0] === 'session').length;
      log.push(['session', config]);
      const session: NativeLanguageSession = {
        respond: async (prompt) => {
          log.push(['respond', id, prompt]);
          return config.responseFormat === 'json' ? '{"mood":"calm"}' : `An answer to ${prompt}`;
        },
        stream: (prompt, onText) => {
          log.push(['stream', id, prompt]);
          return new Promise((resolve, reject) => {
            const stream = {
              last: '',
              onText: (text: string) => ((stream.last = text), onText(text)),
              finish: resolve,
              fail: reject,
            };
            streams.push(stream);
          });
        },
        cancel: async () => {
          log.push(['cancel', id]);
          const stream = streams[id];
          stream?.finish(stream.last);
        },
        release: () => log.push(['release', id]),
      };
      return session;
    },
  };

  return {
    log,
    streams,
    native,
    setAvailability(value: string) {
      current = value;
    },
    emitAvailability(value: string) {
      current = value;
      changeAvailability?.(value);
    },
    emitProgress: (value: number) => reportProgress?.(value),
    service: () => serviceWith(LanguageModel, native),
  };
}

describe('the language model availability', () => {
  it('reads the availability once, straight away, because the platform answers synchronously', () => {
    const model = fakeModel('available').service();
    assert.equal(model.availability(), 'available');
    assert.equal(model.available(), true);
  });

  it("keeps the platform's reason when the model is unavailable", () => {
    for (const reason of [
      'notEligible',
      'notEnabled',
      'notReady',
      'downloadRequired',
      'downloading',
    ] as const) {
      const model = fakeModel(reason).service();
      assert.equal(model.availability(), reason);
      assert.equal(model.available(), false);
    }
  });

  it('reports a reason the module does not have as unknown rather than passing it through', () => {
    assert.equal(fakeModel('somethingNew').service().availability(), 'unknown');
  });

  it('follows the platform when it says the availability changed', () => {
    const fake = fakeModel('notEnabled');
    const model = fake.service();
    fake.emitAvailability('available');
    assert.equal(model.availability(), 'available');
  });

  it('re-reads the availability when asked, for a change the platform does not announce', () => {
    const fake = fakeModel('notReady');
    const model = fake.service();
    fake.setAvailability('available');
    assert.equal(model.availability(), 'notReady', 'nothing announced it');
    assert.equal(model.refresh(), 'available');
    assert.equal(model.availability(), 'available');
  });

  it('downloads the model, and reports progress while it does', async () => {
    const fake = fakeModel('downloadRequired');
    const model = fake.service();
    assert.equal(model.downloadProgress(), null);
    await model.download();
    fake.emitProgress(0.25);
    assert.equal(model.downloadProgress(), 0.25);
    assert.deepEqual(fake.log, ['download']);
  });
});

describe('generating an answer', () => {
  it('resolves to the text, in a session of its own that is released afterwards', async () => {
    const fake = fakeModel();
    const answer = await fake.service().generate('the tides', {
      instructions: 'Answer in one sentence.',
      temperature: 0.2,
      maxTokens: 64,
    });
    assert.equal(answer, 'An answer to the tides');
    assert.deepEqual(fake.log, [
      [
        'session',
        { instructions: 'Answer in one sentence.', options: { temperature: 0.2, maxTokens: 64 } },
      ],
      ['respond', 0, 'the tides'],
      ['release', 0],
    ]);
  });

  it('parses a structured answer, constrained by the schema', async () => {
    const fake = fakeModel();
    const schema: LanguageModelSchema = { mood: { type: 'string', enum: ['calm', 'stormy'] } };
    const answer = await fake.service().generateObject<{ mood: string }>('the sea', schema);
    assert.deepEqual(answer, { mood: 'calm' });
    assert.deepEqual(fake.log[0], ['session', { responseFormat: 'json', schema }]);
  });

  it("refuses with the platform's reason when the model is unavailable, without a session", async () => {
    const fake = fakeModel('notEnabled');
    await assert.rejects(fake.service().generate('hello'), (error: unknown) => {
      assert.ok(error instanceof LanguageModelUnavailableError);
      assert.equal(error.reason, 'notEnabled');
      return true;
    });
    assert.deepEqual(fake.log, []);
  });

  it('passes a native failure through, and still releases the session', async () => {
    const fake = fakeModel();
    const native = fake.native.session;
    fake.native.session = (config) => ({
      ...native(config),
      respond: async () => {
        throw new Error('Guardrail violation');
      },
    });
    await assert.rejects(fake.service().generate('hello'), /Guardrail violation/);
    assert.deepEqual(fake.log.at(-1), ['release', 0]);
  });
});

describe('streaming an answer', () => {
  it('fills the text signal in the order the model produces it, then says it is done', async () => {
    const fake = fakeModel();
    const stream = fake.service().stream('the tides', { instructions: 'Be brief.' });
    assert.equal(stream.status(), 'streaming');
    assert.equal(stream.text(), '');

    const seen: string[] = [];
    for (const text of ['The', 'The moon', 'The moon pulls']) {
      fake.streams[0]!.onText(text);
      seen.push(stream.text());
    }
    assert.deepEqual(seen, ['The', 'The moon', 'The moon pulls']);

    fake.streams[0]!.finish('The moon pulls the sea.');
    assert.equal(await stream.result, 'The moon pulls the sea.');
    assert.equal(stream.text(), 'The moon pulls the sea.');
    assert.equal(stream.status(), 'done');
    assert.equal(stream.error(), null);
    assert.deepEqual(fake.log, [
      ['session', { instructions: 'Be brief.' }],
      ['stream', 0, 'the tides'],
      ['release', 0],
    ]);
  });

  it('stops when cancelled, keeping the text produced so far', async () => {
    const fake = fakeModel();
    const stream = fake.service().stream('the tides');
    fake.streams[0]!.onText('The moon');
    stream.cancel();
    assert.equal(await stream.result, 'The moon');
    assert.equal(stream.status(), 'cancelled');
    assert.equal(stream.text(), 'The moon');
    assert.deepEqual(fake.log.slice(2), [
      ['cancel', 0],
      ['release', 0],
    ]);
  });

  it('does nothing when cancelled after it has finished', async () => {
    const fake = fakeModel();
    const stream = fake.service().stream('the tides');
    fake.streams[0]!.finish('Done.');
    await stream.result;
    stream.cancel();
    assert.equal(stream.status(), 'done');
    assert.equal(
      fake.log.filter((entry) => Array.isArray(entry) && entry[0] === 'cancel').length,
      0,
    );
  });

  it('cancels the stream before it when a new one starts, because the module runs one at a time', async () => {
    const fake = fakeModel();
    const model = fake.service();
    const first = model.stream('one');
    const second = model.stream('two');
    await first.result;
    assert.equal(first.status(), 'cancelled');
    assert.equal(second.status(), 'streaming');
    assert.deepEqual(fake.log, [
      ['session', {}],
      ['stream', 0, 'one'],
      ['cancel', 0],
      // The Solid service releases the cancelled session before opening the next one.
      ['release', 0],
      ['session', {}],
      ['stream', 1, 'two'],
    ]);
  });

  it('reports a failed stream as an error the template can show, and releases the session', async () => {
    const fake = fakeModel();
    const stream = fake.service().stream('the tides');
    fake.streams[0]!.onText('The');
    fake.streams[0]!.fail(new Error('Context window exceeded'));
    await assert.rejects(stream.result, /Context window exceeded/);
    assert.equal(stream.status(), 'failed');
    assert.equal(stream.error(), 'Context window exceeded');
    assert.equal(stream.text(), 'The', 'what arrived before the failure is kept');
    assert.deepEqual(fake.log.at(-1), ['release', 0]);
  });

  it('does not leave an unhandled rejection when nobody awaits the result', async () => {
    const fake = fakeModel();
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', record);
    try {
      fake.service().stream('the tides');
      fake.streams[0]!.fail(new Error('boom'));
      await settle();
      await settle();
    } finally {
      process.off('unhandledRejection', record);
    }
    assert.deepEqual(unhandled, []);
  });

  it("fails at once with the platform's reason when the model is unavailable", async () => {
    const fake = fakeModel('notEligible');
    const stream = fake.service().stream('the tides');
    assert.equal(stream.status(), 'failed');
    assert.equal(stream.error(), 'The on-device language model is unavailable: notEligible');
    await assert.rejects(stream.result, LanguageModelUnavailableError);
    assert.deepEqual(fake.log, []);
  });
});

describe('the language model without the module', () => {
  const model = () => serviceWith(LanguageModel, null);

  it('says so, as a reason of its own', () => {
    assert.equal(model().availability(), 'notInstalled');
    assert.equal(model().available(), false);
    assert.equal(model().refresh(), 'notInstalled');
  });

  it('refuses to generate rather than answering with nothing', async () => {
    await assert.rejects(model().generate('hello'), (error: unknown) => {
      assert.ok(error instanceof LanguageModelUnavailableError);
      assert.equal(error.reason, 'notInstalled');
      return true;
    });
  });

  it('streams nothing, and says why', async () => {
    const stream = model().stream('hello');
    assert.equal(stream.status(), 'failed');
    assert.equal(stream.text(), '');
    await assert.rejects(stream.result, LanguageModelUnavailableError);
    stream.cancel();
  });

  it('downloads nothing', async () => {
    await model().download();
    assert.equal(model().downloadProgress(), null);
  });
});
