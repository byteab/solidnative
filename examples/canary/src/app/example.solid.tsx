/** @jsxImportSource @solid-native/platform/solid */
import { createMemo } from 'solid-js';
import { Text, View } from '@solid-native/components/solid';
import { Show, withNativeStyles, type HostChild } from '@solid-native/platform/solid';
import sheet from './example.native.css';

const prose = (value: string) => value.replace(/\s+/g, ' ').trim();
export interface ExampleProps {
  title: string;
  note?: string;
  code?: string;
  children?: HostChild;
}

export function Example(props: ExampleProps) {
  // Projected controls retain their caller's styles and ownership.
  const content = createMemo(() => props.children);
  return withNativeStyles(sheet, () => (
    <View style={{ gap: 6, paddingVertical: 10 }}>
      <Text class="strong">{props.title}</Text>
      <Show when={props.note}>
        <Text class="hint">{prose(props.note ?? '')}</Text>
      </Show>
      <View class="stage">{content()}</View>
      <Show when={props.code}>
        <View style={{ backgroundColor: '#08080c', borderRadius: 8, padding: 10 }}>
          <Text style={{ color: '#8fb8ff', fontSize: 12, fontFamily: 'Menlo' }}>{props.code}</Text>
        </View>
      </Show>
    </View>
  ));
}

export function Section(props: Omit<ExampleProps, 'code'>) {
  return (
    <View style={{ gap: 4, paddingTop: 18 }}>
      <Text class="heading">{props.title}</Text>
      <Show when={props.note}>
        <Text class="body">{prose(props.note ?? '')}</Text>
      </Show>
      {props.children}
    </View>
  );
}
