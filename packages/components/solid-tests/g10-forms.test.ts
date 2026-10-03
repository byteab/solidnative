import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoot, createRenderEffect } from 'solid-js';
import { createNativeRoot } from '@solid-native/platform/solid';
import { registerPlatformComponents, type FabricNode } from '@solid-native/fabric';
import { createForm, bindFormField } from '../src/solid/forms.ts';
import {
  formRequired,
  formMinLength,
  formMaxLength,
  formPattern,
  formEmail,
} from '../src/solid/forms-rules.ts';
import type { FormError, NativeForm } from '../src/solid/forms-types.ts';
import {
  createFakeFabric,
  createClock,
  type FakeNode,
} from '../../platform/solid-tests/fake-fabric.ts';
import { formFixture } from './g10-forms-fixture.tsx';

const drain = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function usernameForm() {
  const requests: {
    name: string;
    signal: AbortSignal;
    result: ReturnType<typeof deferred<FormError | undefined>>;
  }[] = [];
  const form = createForm(
    { username: '', other: '', hidden: false },
    {
      username: {
        hidden: ({ values }) => values.hidden,
        validate: [formRequired(), formMinLength(3)],
        async: {
          debounceMs: 300,
          validate(name, { signal }) {
            const result = deferred<FormError | undefined>();
            requests.push({ name, signal, result });
            return result.promise;
          },
          onError: () => ({ kind: 'unchecked', message: 'Could not check the username' }),
        },
      },
    },
  );
  return { form, requests };
}

test('typed schema preserves required/optional lengths, email, date and cross-field visibility/disabled rules', () => {
  const form = createForm(
    {
      name: '',
      email: '',
      country: 'GB',
      state: '',
      phone: '',
      sms: false,
      password: '',
      confirm: '',
      bio: '',
      born: null as Date | null,
    },
    {
      name: { validate: [formRequired(), formMinLength(3)] },
      email: { validate: [formRequired(), formEmail()] },
      state: { validate: formRequired(), hidden: ({ values }) => values.country !== 'US' },
      sms: { disabled: ({ values }) => !values.phone.trim() },
      confirm: {
        validate: (value, { values }) =>
          value === values.password ? undefined : { kind: 'mismatch' },
      },
      bio: { validate: formMaxLength(280) },
      born: { validate: formRequired() },
    },
  );
  assert.deepEqual(form.fields.name.errors(), [{ kind: 'required' }]);
  assert.equal(form.fields.state.hidden(), true);
  assert.equal(form.fields.state.invalid(), false);
  assert.equal(form.fields.sms.disabled(), true);
  form.fields.sms.setValue(true);
  assert.equal(form.value().sms, false);
  form.fields.name.setValue('Ad');
  assert.equal(form.fields.name.errors()[0]?.kind, 'minLength');
  form.setValue((data) => ({
    ...data,
    country: 'US',
    password: 'secret',
    phone: '123',
    born: new Date(1990, 0, 1),
  }));
  assert.equal(form.fields.state.hidden(), false);
  assert.equal(form.fields.state.invalid(), true);
  assert.equal(form.fields.confirm.errors()[0]?.kind, 'mismatch');
  assert.equal(form.fields.born.invalid(), false);
  form.fields.sms.setValue(true);
  assert.equal(form.value().sms, true);
  form.fields.bio.setValue('x'.repeat(281));
  assert.equal(form.fields.bio.errors()[0]?.kind, 'maxLength');
  assert.equal(formPattern(/^[a-z]+$/g)('abc', { values: undefined }), undefined);
  assert.equal(formPattern(/^[a-z]+$/g)('abc', { values: undefined }), undefined);
  form.dispose();
});

test('username validates after debounce only when sync-valid, cancels stale requests, and leaves unrelated edits alone', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { form, requests } = usernameForm();
  form.fields.username.setValue('a');
  t.mock.timers.tick(400);
  assert.equal(requests.length, 0);
  form.fields.username.setValue('ada');
  t.mock.timers.tick(200);
  form.fields.username.setValue('adam');
  t.mock.timers.tick(299);
  assert.equal(requests.length, 0);
  t.mock.timers.tick(1);
  assert.equal(requests.length, 1);
  form.fields.other.setValue('unrelated');
  t.mock.timers.tick(1000);
  assert.equal(requests.length, 1);
  form.fields.username.setValue('grace');
  assert.equal(requests[0]!.signal.aborted, true);
  requests[0]!.result.resolve({ kind: 'taken' });
  await drain();
  assert.equal(form.fields.username.errors().length, 0);
  t.mock.timers.tick(300);
  requests[1]!.result.resolve({ kind: 'taken', message: 'That username is taken' });
  await drain();
  assert.equal(form.fields.username.pending(), false);
  assert.equal(form.fields.username.errors()[0]?.message, 'That username is taken');
  form.fields.username.setValue('free');
  t.mock.timers.tick(300);
  requests[2]!.result.reject(new Error('offline'));
  await drain();
  assert.equal(form.fields.username.errors()[0]?.kind, 'unchecked');
  form.dispose();
});

test('hidden fields abort work and stop participating; showing them starts a fresh check', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { form, requests } = usernameForm();
  form.fields.username.setValue('ada');
  t.mock.timers.tick(300);
  form.fields.hidden.setValue(true);
  assert.equal(requests[0]!.signal.aborted, true);
  assert.equal(form.pending(), false);
  assert.equal(form.invalid(), false);
  requests[0]!.result.resolve({ kind: 'late' });
  await drain();
  form.fields.hidden.setValue(false);
  t.mock.timers.tick(300);
  assert.equal(requests.length, 2);
  form.dispose();
  assert.equal(requests[1]!.signal.aborted, true);
});

test('dynamic dependant fields keep identity, errors, touched and focus across edits, removal and reorder', () => {
  const form = createForm(
    {
      dependants: [
        { name: '', born: null as Date | null },
        { name: 'Bea', born: null as Date | null },
      ],
    },
    {
      dependants: {
        each: { name: { validate: formRequired() }, born: { validate: formRequired() } },
      },
    },
  );
  const [alan, bea] = form.fields.dependants.items();
  alan!.name.setValue('Alan');
  bea!.name.markTouched();
  let focused = 0;
  bea!.name.registerControl({
    focus: () => {
      focused++;
    },
  });
  assert.equal(form.fields.dependants.items()[0], alan);
  bea!.name.setValue('Beatrice');
  form.fields.dependants.setValue((rows) => [...rows].reverse());
  assert.equal(form.fields.dependants.items()[0], bea);
  form.fields.dependants.setValue((rows) => rows.slice(0, 1));
  assert.equal(form.fields.dependants.items()[0], bea);
  assert.equal(bea!.name.touched(), true);
  assert.equal(bea!.name.value(), 'Beatrice');
  assert.equal(bea!.born.invalid(), true);
  assert.equal(bea!.name.focusBoundControl(), true);
  assert.equal(focused, 1);
  alan!.name.setValue('removed');
  assert.equal(form.value().dependants[0]?.name, 'Beatrice');
  form.dispose();
});

test('explicit array keys retain fields on server replacement and reject duplicates before publishing', () => {
  const form = createForm(
    { rows: [{ id: 1, name: '' }] },
    { rows: { key: (row) => row.id, each: { name: { validate: formRequired() } } } },
  );
  const row = form.fields.rows.items()[0]!;
  row.name.markTouched();
  form.setValue({ rows: [{ id: 1, name: 'server' }] });
  assert.equal(form.fields.rows.items()[0], row);
  assert.equal(row.name.value(), 'server');
  assert.equal(row.name.touched(), true);
  assert.throws(
    () =>
      form.setValue({
        rows: [
          { id: 1, name: 'one' },
          { id: 1, name: 'two' },
        ],
      }),
    /Duplicate form array key/,
  );
  assert.equal(form.value().rows[0]?.name, 'server');
  form.dispose();
});

test('submit waits for validation then sends once, touching/focusing invalid fields in model display order', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { form, requests } = usernameForm();
  const calls: string[] = [];
  form.fields.username.registerControl({
    focus: () => {
      calls.push('focus');
    },
  });
  assert.equal(
    await form.submit(() => {
      calls.push('send');
    }),
    false,
  );
  assert.deepEqual(calls, ['focus']);
  assert.equal(form.fields.username.touched(), true);
  form.fields.username.setValue('available');
  const submitted = form.submit((value) => {
    calls.push(value.username);
  });
  assert.equal(form.submitting(), true);
  assert.equal(
    await form.submit(() => {
      calls.push('duplicate');
    }),
    false,
  );
  t.mock.timers.tick(300);
  requests[0]!.result.resolve(undefined);
  assert.equal(await submitted, true);
  assert.deepEqual(calls, ['focus', 'available']);
  assert.equal(form.submitting(), false);
  form.dispose();
});

test('edits cancel submit waiting on validation or handler, including never-settling promises', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { form } = usernameForm();
  form.fields.username.setValue('pending');
  let sends = 0;
  const validation = form.submit(() => {
    sends++;
  });
  form.fields.other.setValue('cancel');
  assert.equal(await validation, false);
  assert.equal(sends, 0);
  form.dispose();
  const ready = createForm({ name: 'ready' });
  let signal!: AbortSignal;
  const blocked = ready.submit((_value, context) => {
    signal = context.signal;
    return new Promise(() => {});
  });
  await drain();
  ready.fields.name.setValue('new');
  assert.equal(await blocked, false);
  assert.equal(signal.aborted, true);
  const disposed = ready.submit(() => new Promise(() => {}));
  await drain();
  ready.dispose();
  assert.equal(await disposed, false);
});

test('owner disposal cancels debounces, active requests, submit callbacks and future writes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let dispose!: () => void;
  const { form, requests } = createRoot((cleanup) => {
    dispose = cleanup;
    return usernameForm();
  });
  form.fields.username.setValue('ready');
  const attempt = form.submit(() => {
    throw new Error('late send');
  });
  dispose();
  t.mock.timers.tick(1000);
  assert.equal(await attempt, false);
  assert.equal(requests.length, 0);
  form.fields.username.setValue('ignored');
  assert.equal(form.value().username, 'ready');
});

test('newer edits in abort listeners and updater callbacks win across form, array and leaf writes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { form, requests } = usernameForm();
  form.fields.username.setValue('first');
  t.mock.timers.tick(300);
  requests[0]!.signal.addEventListener('abort', () => form.fields.username.setValue('newest'));
  form.fields.username.setValue('outer');
  assert.equal(form.value().username, 'newest');
  form.fields.username.setValue(() => {
    form.fields.username.setValue('inner');
    return 'stale';
  });
  assert.equal(form.value().username, 'inner');
  form.setValue((data) => {
    form.fields.username.setValue('root-inner');
    return { ...data, username: 'root-stale' };
  });
  assert.equal(form.value().username, 'root-inner');
  form.dispose();
  const array = createForm({ rows: ['a'] });
  array.fields.rows.setValue(() => {
    array.fields.rows.setValue(['new']);
    return ['old'];
  });
  assert.deepEqual(array.value().rows, ['new']);
  array.dispose();
  await drain();
});

test('reactive touched/submitting publications may dispose or edit without a later send/focus', async () => {
  const calls: string[] = [];
  let form!: NativeForm<{ name: string }>;
  const dispose = createRoot((cleanup) => {
    form = createForm({ name: '' }, { name: { validate: formRequired() } });
    form.fields.name.registerControl({
      focus: () => {
        calls.push('focus');
      },
    });
    createRenderEffect(() => {
      if (form.fields.name.touched()) cleanup();
    });
    return cleanup;
  });
  assert.equal(
    await form.submit(() => {
      calls.push('send');
    }),
    false,
  );
  assert.deepEqual(calls, [] as string[]);
  dispose();
  const second = createRoot((cleanup) => {
    const ready = createForm({ name: 'ready' });
    createRenderEffect(() => {
      if (ready.submitting()) cleanup();
    });
    return ready;
  });
  assert.equal(
    await second.submit(() => {
      calls.push('late');
    }),
    false,
  );
  assert.deepEqual(calls, []);
});

test('control binding releases disposed owners without removing a newer control, and aliases Expo touch', () => {
  const form = createForm({ name: '' });
  const calls: string[] = [];
  let dispose!: () => void;
  const first = createRoot((cleanup) => {
    dispose = cleanup;
    return bindFormField(form.fields.name);
  });
  first.ref({
    focus: () => {
      calls.push('first');
    },
  });
  const second = bindFormField(form.fields.name);
  second.ref({
    focus: () => {
      calls.push('second');
    },
  });
  dispose();
  first.onValueChange('ignored');
  second.onTouch();
  assert.equal(form.fields.name.touched(), true);
  assert.equal(form.fields.name.focusBoundControl(), true);
  assert.deepEqual(calls, ['second']);
  assert.equal(form.value().name, '');
  form.dispose();
});

test('a model edit during submitting=false publication prevents stale success and keeps thrown handler errors', async () => {
  let observed = false;
  const form = createRoot(() => {
    const result = createForm({ name: 'ready' }, { name: { validate: formRequired() } });
    createRenderEffect(() => {
      if (result.submitting()) observed = true;
      else if (observed) result.fields.name.setValue('');
    });
    return result;
  });
  assert.equal(await form.submit(() => {}), false);
  assert.equal(form.invalid(), true);
  form.dispose();
  const throwing = createForm({ name: 'ready' });
  await assert.rejects(
    throwing.submit(() => {
      throw new Error('server rejected');
    }),
    /server rejected/,
  );
  assert.equal(throwing.submitting(), false);
  throwing.dispose();
});

test('failed initial schema construction cancels already-started async checks', () => {
  let signal!: AbortSignal;
  assert.throws(
    () =>
      createForm(
        { first: 'ready', second: '' },
        {
          first: {
            async: {
              validate(_value, context) {
                signal = context.signal;
                return new Promise(() => {});
              },
            },
          },
          second: {
            validate() {
              throw new Error('broken schema');
            },
          },
        },
      ),
    /broken schema/,
  );
  assert.equal(signal.aborted, true);
});

test('explicit async dependencies restart only on their changes and disabling a field cancels the request', async () => {
  const requests: {
    country: string;
    signal: AbortSignal;
    result: ReturnType<typeof deferred<undefined>>;
  }[] = [];
  const form = createForm(
    { code: '123', country: 'GB', other: '', disabled: false },
    {
      code: {
        disabled: ({ values }) => values.disabled,
        async: {
          deps: ({ values }) => values.country,
          validate(_value, { values, signal }) {
            const result = deferred<undefined>();
            requests.push({ country: values.country, signal, result });
            return result.promise;
          },
        },
      },
    },
  );
  form.fields.other.setValue('one');
  assert.equal(requests.length, 1);
  form.fields.country.setValue('US');
  assert.equal(requests.length, 2);
  assert.equal(requests[0]!.signal.aborted, true);
  assert.equal(requests[1]!.country, 'US');
  form.fields.disabled.setValue(true);
  assert.equal(requests[1]!.signal.aborted, true);
  assert.equal(form.pending(), false);
  requests[0]!.result.resolve(undefined);
  requests[1]!.result.resolve(undefined);
  await drain();
  assert.equal(form.fields.code.disabled(), true);
  form.dispose();
});

test('removing a dependant aborts its validation and releases its bound native control', async () => {
  let signal!: AbortSignal;
  const result = deferred<FormError>();
  const form = createForm(
    { rows: [{ name: 'Ada' }] },
    {
      rows: {
        each: {
          name: {
            async: {
              validate(_value, context) {
                signal = context.signal;
                return result.promise;
              },
            },
          },
        },
      },
    },
  );
  const row = form.fields.rows.items()[0]!;
  row.name.registerControl({
    focus() {
      throw new Error('removed control');
    },
  });
  form.fields.rows.setValue([]);
  assert.equal(signal.aborted, true);
  assert.equal(row.name.focusBoundControl(), false);
  assert.equal(form.pending(), false);
  result.resolve({ kind: 'late' });
  await drain();
  assert.deepEqual(form.errors(), []);
  form.dispose();
});

test('identical native refs registered by distinct owners keep independent releases', () => {
  const form = createForm({ name: '' });
  let focused = 0;
  const control = {
    focus() {
      focused++;
    },
  };
  const releaseFirst = form.fields.name.registerControl(control);
  const releaseSecond = form.fields.name.registerControl(control);
  releaseFirst();
  releaseFirst();
  assert.equal(form.fields.name.focusBoundControl(), true);
  assert.equal(focused, 1);
  releaseSecond();
  assert.equal(form.fields.name.focusBoundControl(), false);
  form.dispose();
});

test('compiled native controls preserve counters, touched/disabled props, focus and row native identity', async () => {
  registerPlatformComponents('ios');
  const fixture = formFixture();
  const commands: { node: FabricNode; name: string; args: readonly unknown[] }[] = [];
  const fabric = Object.assign(createFakeFabric(), {
    dispatchCommand(node: FabricNode, name: string, args: readonly unknown[]) {
      commands.push({ node, name, args });
    },
  });
  const clock = createClock();
  const root = createNativeRoot({ fabric, clock, rootTag: 1 });
  root.render(fixture.Scene);
  const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
    nodes.flatMap((node) => [node, ...flatten(node.children)]);
  const find = (id: string) => {
    const node = flatten(fabric.roots.get(1) ?? []).find((item) => item.props['testID'] === id);
    assert.ok(node, id);
    return node;
  };
  const form = fixture.form();
  const nameTag = find('name').tag;
  const beaTag = find('dependant-1').tag;
  fabric.emit(find('name'), 'topChange', { text: 'A', eventCount: 1 });
  fabric.emit(find('name'), 'topChange', { text: 'Ada', eventCount: 3 });
  fabric.emit(find('name'), 'topChange', { text: 'Ad', eventCount: 2 });
  clock.flushMicrotasks();
  assert.equal(find('name').props['text'], 'Ada');
  assert.equal(form.value().name, 'Ada');
  fabric.emit(find('name'), 'topBlur', {});
  assert.equal(form.fields.name.touched(), true);
  fabric.emit(find('sms'), 'topChange', { value: true });
  clock.flushMicrotasks();
  assert.equal(form.value().sms, false);
  assert.equal(find('sms').props['disabled'], true);
  form.setValue((data) => ({ ...data, country: 'US' }));
  form.fields.dependants.items()[1]!.name.setValue('Beatrice');
  form.fields.dependants.setValue((rows) => rows.slice(1));
  clock.flushMicrotasks();
  assert.equal(find('name').tag, nameTag);
  assert.equal(find('dependant-0').tag, beaTag);
  assert.equal(find('dependant-0').props['text'], 'Beatrice');
  fabric.emit(find('name'), 'topSubmitEditing', {});
  clock.flushMicrotasks();
  assert.equal(commands.at(-1)?.name, 'focus');
  assert.equal((commands.at(-1)?.node as FakeNode).tag, find('phone').tag);
  assert.equal(await form.submit(() => {}), false);
  clock.flushMicrotasks();
  assert.equal((commands.at(-1)?.node as FakeNode).tag, find('state').tag);
  root.dispose();
});

test('reset restores the creation (or given) value, untouches every field and cancels submit', async () => {
  const { form, requests } = usernameForm();
  form.fields.username.setValue('ada');
  form.fields.other.markTouched();
  form.fields.username.markTouched();
  const sent: unknown[] = [];
  const attempt = form.submit((value) => {
    sent.push(value);
  });
  form.reset();
  assert.equal(await attempt, false);
  assert.deepEqual(sent, []);
  assert.equal(form.submitting(), false);
  assert.deepEqual(form.value(), { username: '', other: '', hidden: false });
  assert.equal(form.fields.username.touched(), false);
  assert.equal(form.fields.other.touched(), false);
  assert.equal(form.fields.username.pending(), false);
  assert.ok(requests.every((request) => request.signal.aborted));
  // Errors are re-derived for the reset value: `reset()` leaves validity to the value.
  assert.deepEqual(form.fields.username.errors(), [{ kind: 'required' }]);

  form.fields.other.markTouched();
  form.reset({ username: '', other: 'kept', hidden: true });
  assert.deepEqual(form.value(), { username: '', other: 'kept', hidden: true });
  assert.equal(form.fields.other.touched(), false);
  assert.equal(form.fields.username.hidden(), true);
  form.fields.other.markTouched();
  form.fields.other.markUntouched();
  assert.equal(form.fields.other.touched(), false);
  form.dispose();
});
