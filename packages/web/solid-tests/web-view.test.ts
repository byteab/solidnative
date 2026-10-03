import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createComputed, createSignal, onCleanup } from 'solid-js';
import { installJsdomEnvironment } from '../src/jsdom-env.ts';
import { mountInWebView } from '../src/solid/web-view.ts';
import { Note } from './note.dom.tsx';

async function boot(initial: unknown = { inputs: { label: 'Draft' } }) {
  const { document, window } = installJsdomEnvironment();
  const page = window as Window & {
    ReactNativeWebView: unknown;
    __solidNative: { receive(message: unknown): void };
  };
  const posted: Record<string, unknown>[] = [];
  page.ReactNativeWebView = {
    injectedObjectJson: () => (typeof initial === 'string' ? initial : JSON.stringify(initial)),
    postMessage: (data: string) => posted.push(JSON.parse(data)),
  };
  const ref = await mountInWebView(Note, {
    outputs: { textChange: 'onTextChange', sent: 'onSent' },
  }).mounted!;
  return { document, page, posted, ref };
}

test('DOM page preserves initial/partial reactive inputs, CSS, stable mount and output names', async (t) => {
  const { document, page, posted, ref } = await boot();
  t.after(ref.dispose);
  assert.equal(document.body.style.margin, '0px');
  const textarea = document.querySelector('textarea')!;
  assert.ok(ref.host.contains(textarea));
  assert.equal(document.querySelector('label')!.textContent, 'Draft');
  assert.match(ref.host.querySelector('style')!.textContent!, /resize: vertical/);
  assert.deepEqual(posted, [{ type: 'ready', outputs: ['textChange', 'sent'] }]);
  page.__solidNative.receive({ type: 'inputs', inputs: { label: 'Final', text: 'Hello' } });
  assert.equal(document.querySelector('label')!.textContent, 'Final');
  assert.equal(textarea.value, 'Hello');
  page.__solidNative.receive({ type: 'inputs', inputs: { label: 'Partial' } });
  assert.equal(textarea.value, 'Hello');
  assert.equal(document.querySelector('textarea'), textarea);
  document.querySelector<HTMLButtonElement>('#send')!.click();
  assert.deepEqual(posted.at(-1), { type: 'output', name: 'sent', value: 'Hello' });
  textarea.value = 'typed';
  textarea.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
  assert.deepEqual(posted.at(-1), { type: 'output', name: 'textChange', value: 'typed' });
});

test('malformed messages cannot replace callbacks; disposed receivers and callbacks stop publishing', async () => {
  const { document, page, posted, ref } = await boot('broken JSON');
  const receiver = page.__solidNative;
  for (const message of [null, [], 3, { type: 'inputs', inputs: [] }]) receiver.receive(message);
  receiver.receive({ type: 'inputs', inputs: { onSent: 'not a callback', label: 'live' } });
  document.querySelector<HTMLButtonElement>('#send')!.click();
  assert.equal(posted.at(-1)!['type'], 'output');
  const callback = ref.props.onSent!;
  ref.dispose();
  const count = posted.length;
  receiver.receive({ type: 'inputs', inputs: { label: 'late' } });
  callback('late');
  assert.equal(posted.length, count);
  assert.equal(page.__solidNative, undefined);
  assert.equal(document.querySelector('solid-native-web-root'), null);
  assert.equal(document.body.style.margin, '');
});

test('page errors are reported and pagehide releases ownership for a clean remount', async () => {
  const { page, posted, ref, document } = await boot();
  page.dispatchEvent(
    new document.defaultView!.ErrorEvent('error', { error: new Error('the note failed') }),
  );
  assert.match(String(posted.at(-1)!['message']), /the note failed/);
  assert.throws(() => mountInWebView(Note), /already owns/);
  page.dispatchEvent(new document.defaultView!.Event('pagehide'));
  ref.dispose();
  const next = await mountInWebView(Note).mounted!;
  next.dispose();
});

test('failed mount disposes computations and existing host contents are restored', () => {
  const { document } = installJsdomEnvironment();
  const host = document.querySelector<HTMLElement>('#app-root')!;
  const child = document.createTextNode('keep');
  host.append(child);
  const [value, setValue] = createSignal(0);
  let runs = 0,
    cleanups = 0;
  assert.throws(
    () =>
      mountInWebView(
        () => {
          createComputed(() => {
            value();
            runs++;
          });
          onCleanup(() => cleanups++);
          throw new Error('construction failed');
        },
        { host },
      ),
    /construction failed/,
  );
  setValue(1);
  assert.equal(runs, 1);
  assert.equal(cleanups, 1);
  assert.equal(host.firstChild, child);
});

test("a handler's own error is reported to the app, where someone will see it", async (t) => {
  // A web view's console is in Safari's inspector, not the terminal the app logs to.
  const { document, posted, ref } = await boot();
  t.after(ref.dispose);
  const original = console.error;
  console.error = () => {};
  try {
    document.querySelector<HTMLButtonElement>('#fail')!.click();
  } finally {
    console.error = original;
  }
  const error = posted.find((message) => message['type'] === 'error');
  assert.match(String(error?.['message']), /the note failed/);
});
