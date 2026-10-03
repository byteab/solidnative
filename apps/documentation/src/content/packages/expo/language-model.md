---
title: On-device AI
summary: The language model the phone already has, as a service - Apple Foundation Models and Gemini Nano.
---

# On-device AI

`LanguageModel` wraps [`expo-local-llm`](https://github.com/GijungKim/expo-local-llm): the
model the OS already ships - Apple's Foundation Models (behind Apple Intelligence) on iOS, Gemini
Nano on Android. Nothing is bundled, there is no API key, and nothing leaves the device.

`generate()` returns the whole answer, `generateObject()` an answer shaped by a schema, and
`stream()` an answer the screen shows as it is written.

## Requirements

| Platform | What it needs                                                                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS      | iOS 26+ on Apple Intelligence hardware (iPhone 15 Pro and later, M-series iPads and Macs), with Apple Intelligence on and its model downloaded. The simulator works when its Mac has Apple Intelligence on. |
| Android  | A phone that ships Gemini Nano (`expo-local-llm` names Pixel 8+ and Galaxy S25+); the model may need downloading first. Not buildable yet: see below.                                                       |

Everything else - an older iPhone, iOS 25, most Android phones - reports the model unavailable,
with the reason. Expect that to be most users for a while.

## Install

```sh
npx expo install expo-local-llm
```

No config plugin, no permission. It is native code, so it needs a development build
(`npx expo run:ios`, or EAS), not Expo Go, and a rebuild after installing. Its iOS code needs
iOS 16.4+, Expo SDK 57's default deployment target; if you lowered yours, raise it with
`expo-build-properties`.

```ts
import { LanguageModel } from '@solidnative/expo/solid/language-model';
```

### Android does not build yet

`expo-local-llm` 0.6's Android code depends on `com.google.ai.edge.localagent:localagent`, which
is not on Google's Maven or Maven Central yet, so Android builds fail to resolve it. Until then,
exclude the module from Android in `package.json`:

```json
{
  "expo": {
    "autolinking": {
      "android": { "exclude": ["expo-local-llm"] }
    }
  }
}
```

The same code runs on both: the service only uses the module on iOS, so Android reports
`notInstalled` either way for now.

## Streaming an answer onto the screen

`stream()` returns a `LanguageModelStream`: the text so far (an accessor), a status, an error and
`cancel()`. Keep it in a signal and the JSX follows the model as it writes.

```tsx
import { createSignal, onCleanup } from 'solid-js';
import { Pressable, Text, TextInput } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { Show } from '@solidnative/platform/solid';
import { LanguageModel, type LanguageModelStream } from '@solidnative/expo/solid/language-model';

export function Ask() {
  const model = useService(LanguageModel);
  const [prompt, setPrompt] = createSignal('');
  const [answer, setAnswer] = createSignal<LanguageModelStream | null>(null);
  onCleanup(() => answer()?.cancel());

  const unavailable = () =>
    model.availability() === 'notEnabled'
      ? 'Switch on Apple Intelligence in Settings to use this.'
      : 'Not available on this device.';
  const ask = () =>
    setAnswer(model.stream(prompt(), { instructions: 'Answer in two sentences or fewer.' }));

  return (
    <Show when={model.available()} fallback={<Text>{unavailable()}</Text>}>
      <TextInput value={prompt()} onValueChange={setPrompt} placeholder="Ask something" />
      <Pressable onPress={ask}>
        <Text>Ask</Text>
      </Pressable>
      <Show when={answer()}>
        {(stream) => (
          <>
            <Text>{stream().text()}</Text>
            <Show when={stream().status() === 'streaming'}>
              <Pressable onPress={() => stream().cancel()}>
                <Text>Stop</Text>
              </Pressable>
            </Show>
            <Show when={stream().error()}>{(error) => <Text>{error()}</Text>}</Show>
          </>
        )}
      </Show>
    </Show>
  );
}
```

`status` is `'streaming'`, then `'done'`, `'cancelled'` or `'failed'`; a cancelled stream keeps
its text. `result` is a promise of the final text that rejects on failure, never as an unhandled
rejection. `stream()` never throws: an unavailable model gives an already-failed stream with the
reason as its error.

One stream runs at a time; starting one cancels the last. Disposing the owner cancels a stream,
but one started from an event handler like `onPress` has no owner, so cancel it in `onCleanup` (as
above). Disposing the service's scope cancels any stream still running.

## The whole answer at once

```ts
const summary = await model.generate(notes, {
  instructions: 'Summarise these notes as three bullet points.',
  temperature: 0.3,
});
```

The options, for all three calls:

- **`instructions`** - system instructions, kept apart from the prompt on iOS; Android prepends
  them to it.
- **`temperature`**, **`topK`** - sampling. Lower is more predictable.
- **`maxTokens`** - caps the answer's length. Android caps it at 256 regardless.

## A structured answer

`generateObject()` takes a schema, one field per property, and resolves to the parsed object:

```ts
const triage = await model.generateObject<{ topic: string; urgent: boolean }>(
  message,
  {
    topic: { type: 'string', enum: ['billing', 'delivery', 'other'] },
    urgent: { type: 'boolean', description: 'Whether the customer needs an answer today' },
  },
  { instructions: 'Classify this customer message.' },
);
```

Fields are `string` (optionally with `enum`), `number`, `integer`, `boolean`, `array` with `items`,
and `object` with `properties`. iOS constrains decoding to the schema, so the answer always fits;
Android only describes it in the prompt, so validate the result. A malformed schema rejects before
reaching the model, naming the wrong field paths.

## Availability

`availability` is an accessor of the platform's answer; `available` is whether it is
`'available'`. Otherwise the value says why:

| Value              | Meaning                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `available`        | Ready to answer.                                                                          |
| `notEligible`      | This device or OS version cannot run the model.                                           |
| `notEnabled`       | The device can, but Apple Intelligence is switched off in Settings.                       |
| `notReady`         | The system is still preparing the model, usually downloading it after it was switched on. |
| `downloadRequired` | Android: Gemini Nano has to be downloaded. Call `download()`.                             |
| `downloading`      | Android: it is downloading. `downloadProgress` goes from 0 to 1.                          |
| `unknown`          | The platform gave a reason `expo-local-llm` does not name.                                |
| `notInstalled`     | No module to ask: Android, the web, or a test with no fake (see below).                   |

iOS updates it when the app returns to the foreground (e.g. after enabling Apple Intelligence in
Settings), but not when the model finishes preparing while the app is open: `refresh()` asks again
and returns the answer. Every call re-checks before starting, so a stale accessor never sends a
prompt to a missing model.

On iOS, an `expo-local-llm` missing from the build (never installed, or unlinked as in Expo Go)
throws a `MissingModuleError` on first use; see
[Using a module](/packages/expo/using-a-module#what-happens-without-the-module-installed).

A call while unavailable is refused with a `LanguageModelUnavailableError` whose `reason` is one of
the values above: `generate()` and `generateObject()` reject, a stream fails.

## Fallbacks

Treat the model as an enhancement: most phones cannot run it, and where they can it may be off or
downloading.

- Hide or disable the feature when `available()` is false.
- Say what fixes it: `notEnabled` is Settings, `notReady` and `downloading` are waiting,
  `notEligible` is nothing.
- If it must work everywhere, fall back to a server - and tell the person their text is leaving
  the phone.

## Privacy

Prompt, instructions and answer stay on the device: nothing goes to Apple, Google or anyone else,
no account or key, and it works offline. Use it for personal text - notes, messages, journals -
that should not go to a server.

## Limits

- **A small model.** A few billion parameters: good at summarizing, rewriting, classifying and
  extracting, weak at facts and reasoning. Not a source of truth.
- **Short context.** About 4,000 tokens on iOS, prompt and answer together; longer fails. Android
  answers cap at 256 tokens.
- **Guardrails.** Apple's model refuses some prompts, such as interpreting personal health data;
  a refusal arrives as an error.
- **No memory.** Each call is a fresh session; put what the model needs in the prompt.
- **Not wrapped.** `expo-local-llm`'s multi-turn sessions and tool calling (iOS only).
- **Testing.** `provideService(LanguageModel.SOURCE, () => fake)` in a `ServiceScope`, with a fake
  implementing `NativeLanguageModel`.
- **Android is less proven.** It builds on a beta Google SDK and, by `expo-local-llm`'s own
  account, is not yet validated on a device.

## Reference

`LanguageModel` is exported from `@solidnative/expo/solid/language-model`.

<!-- api: LanguageModel -->
