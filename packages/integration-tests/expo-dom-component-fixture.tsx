/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { provideService, withServiceScope } from '@solid-native/device/solid';
import { DomComponent } from '@solid-native/expo/dom-component';

type DomSource = ReturnType<(typeof DomComponent.SOURCE)['create']>;

/** A note editor in a DOM component, under a scope that provides `source` as its module. */
export function expoDomComponentFixture(source: DomSource) {
  /** What `import note from './web/note.ts'` gives native code; see dom-component-metro.test.ts. */
  const note = { domComponent: 'note.ts?file=file:///app/web/note.ts' };
  const [label, setLabel] = createSignal('Draft');
  const sent: unknown[] = [];
  const [outputs, setOutputs] = createSignal<Record<string, (value: never) => void>>({
    sent: (value: unknown) => sent.push(value),
  });
  const View = () =>
    withServiceScope([provideService(DomComponent.SOURCE, () => source)], () => (
      <DomComponent src={note} class="flex-1" inputs={{ label: label() }} outputs={outputs()} />
    ));
  return { View, setLabel, sent, setOutputs };
}
