/** @jsxImportSource @solidnative/platform/solid */
import { createMemo } from 'solid-js';
import {
  UiButton,
  UiHost,
  UiList,
  UiSlot,
  UiSwipeActions,
  UiText,
  UiVStack,
  type UiModifier,
} from '@solidnative/expo/solid';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { For } from '@solidnative/platform/solid';
import type { Mail } from './inbox-model.solid.ts';
const modifier = (type: string, params: Record<string, unknown>): UiModifier => ({
  $type: type,
  ...params,
});
const font = (weight: 'regular' | 'semibold', size: number) => modifier('font', { weight, size });
const oneLine = modifier('lineLimit', { limit: 1 });
const trailing = { edge: 'trailing', allowsFullSwipe: true };
const listModifiers = [modifier('listStyle', { style: 'plain' })],
  rowModifiers = [modifier('buttonStyle', { style: 'plain' })];
const from = [font('regular', 16), oneLine],
  unreadFrom = [font('semibold', 16), oneLine],
  subject = [font('regular', 15), oneLine];
const preview = [
  font('regular', 14),
  modifier('foregroundStyle', { style: { type: 'hierarchical', hierarchical: 'secondary' } }),
  modifier('lineLimit', { limit: 2 }),
];
const archiveModifiers = [modifier('tint', { color: '#8e5cf6' })];
export function InboxNativeList(props: {
  mails: readonly Mail[];
  size: { width: number; height: number | undefined };
  onOpen: (mail: Mail) => void;
  onArchive: (mail: Mail) => void;
  onRemove: (mail: Mail) => void;
}) {
  const front = useService(SCREEN_IN_FRONT);
  const ids = createMemo(() => props.mails.map((mail) => mail.id));
  return (
    <UiHost style={props.size}>
      <UiList modifiers={listModifiers}>
        <For each={ids()}>
          {(id) => {
            const mail = () => props.mails.find((value) => value.id === id)!;
            return (
              <UiSwipeActions>
                <UiButton
                  modifiers={rowModifiers}
                  onButtonPress={() => front() && props.onOpen(mail())}
                >
                  <UiVStack alignment="leading" spacing={2}>
                    <UiText text={mail().from} modifiers={mail().unread ? unreadFrom : from} />
                    <UiText text={mail().subject} modifiers={subject} />
                    <UiText text={mail().preview} modifiers={preview} />
                  </UiVStack>
                </UiButton>
                <UiSlot name="actions" extraProps={trailing}>
                  <UiButton
                    label="Delete"
                    systemImage="trash"
                    role="destructive"
                    onButtonPress={() => front() && props.onRemove(mail())}
                  />
                  <UiButton
                    label="Archive"
                    systemImage="archivebox"
                    modifiers={archiveModifiers}
                    onButtonPress={() => front() && props.onArchive(mail())}
                  />
                </UiSlot>
              </UiSwipeActions>
            );
          }}
        </For>
      </UiList>
    </UiHost>
  );
}
