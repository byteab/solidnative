/** @jsxImportSource @solidnative/platform/solid */
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import {
  KeyboardDock,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputRef,
} from '@solidnative/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import {
  For,
  Show,
  setNativeStyleHost,
  useHostAdapter,
  withNativeStyles,
} from '@solidnative/platform/solid';
import { NativeHeader, NativeHeaderItem, useRoute } from '@solidnative/router/solid';
import {
  Notes,
  inline,
  shortcut,
  wrapped,
  type Block,
  type BlockKind,
} from './notes-model.solid.ts';
import sheet from './note-editor.native.css';
const KINDS: readonly { kind: BlockKind; glyph: string; name: string }[] = [
  { kind: 'heading', glyph: 'H', name: 'Heading' },
  { kind: 'bullet', glyph: '•', name: 'Bullet list' },
  { kind: 'check', glyph: '☑︎', name: 'Checklist' },
  { kind: 'quote', glyph: '❝', name: 'Quote' },
];
export function NoteEditor() {
  const route = useRoute(),
    notes = useService(Notes),
    front = useService(SCREEN_IN_FRONT),
    host = useHostAdapter();
  const id = () => String(route.inputs['id']);
  const note = createMemo(() => notes.get(id()));
  const [reading, setReading] = createSignal(false),
    [focused, setFocused] = createSignal<string | null>(null);
  const focusedBlock = createMemo(() => note()?.blocks.find((block) => block.id === focused()));
  const fields = new Map<string, TextInputRef>();
  let selection = { start: 0, end: 0 },
    active = true,
    epoch = 0,
    cancelFocus: (() => void) | undefined;
  const invalidate = () => {
    epoch++;
    cancelFocus?.();
    cancelFocus = undefined;
  };
  onCleanup(() => {
    active = false;
    invalidate();
    fields.clear();
  });
  createEffect(() => {
    front();
    reading();
    invalidate();
  });
  function replace(blockId: string, change: Partial<Block>) {
    notes.update(id(), (current) => ({
      blocks: current.blocks.map((block) =>
        block.id === blockId ? { ...block, ...change } : block,
      ),
    }));
  }
  function edit(block: Block, text: string) {
    const typed = shortcut(text),
      applies = typed && (block.kind === 'paragraph' || typed.kind === block.kind);
    replace(block.id, applies ? typed : { text });
  }
  function focus(blockId: string) {
    invalidate();
    const request = epoch;
    cancelFocus = host.afterCommit(() => {
      cancelFocus = undefined;
      if (active && front() && !reading() && request === epoch) fields.get(blockId)?.focus();
    });
  }
  function split(block: Block) {
    if (!block.text && block.kind !== 'paragraph') {
      replace(block.id, { kind: 'paragraph' });
      return;
    }
    const made = notes.split(id(), block.id);
    if (made) focus(made.id);
  }
  function key(block: Block, index: number, value: string) {
    if (value !== 'Backspace' || block.text || index === 0) return;
    const before = note()?.blocks[index - 1];
    notes.remove(id(), block.id);
    if (before) focus(before.id);
  }
  function setKind(kind: BlockKind) {
    const block = focusedBlock();
    if (block) replace(block.id, { kind: block.kind === kind ? 'paragraph' : kind });
  }
  function mark(around: string) {
    const block = focusedBlock();
    if (block) replace(block.id, { text: wrapped(block.text, selection, around).text });
  }
  const accessibleKind = (kind: BlockKind) =>
    KINDS.find((one) => one.kind === kind)?.name ?? 'Paragraph';
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title={reading() ? note()?.title || 'Note' : ''}>
        <NativeHeaderItem type="right">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reading() ? 'Edit' : 'Done'}
            onPress={() => setReading(!reading())}
          >
            <Text class="mode">{reading() ? 'Edit' : 'Done'}</Text>
          </Pressable>
        </NativeHeaderItem>
      </NativeHeader>
      <Show when={note()}>
        {(current) => (
          <View class="screen">
            <ScrollView
              class="page"
              contentInsetAdjustmentBehavior="automatic"
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
            >
              <Show
                when={reading()}
                fallback={
                  <>
                    <TextInput
                      class="title-field"
                      placeholder="Title"
                      accessibilityLabel="Title"
                      value={current().title}
                      onValueChange={(title) => notes.update(id(), () => ({ title }))}
                    />
                    <For each={current().blocks.map((block) => block.id)}>
                      {(blockId, index) => {
                        const block = () => current().blocks.find((block) => block.id === blockId)!;
                        onCleanup(() => fields.delete(blockId));
                        return (
                          <View class={`block ${block().kind}${block().done ? ' done' : ''}`}>
                            <Show when={block().kind === 'bullet'}>
                              <Text class="marker">•</Text>
                            </Show>
                            <Show when={block().kind === 'check'}>
                              <Pressable
                                class="box"
                                accessibilityRole="checkbox"
                                accessibilityLabel={block().text || 'Item'}
                                accessibilityState={{ checked: !!block().done }}
                                onPress={() => replace(blockId, { done: !block().done })}
                              >
                                <Text class="marker">{block().done ? '☑︎' : '☐'}</Text>
                              </Pressable>
                            </Show>
                            <TextInput
                              class="text"
                              ref={(ref) => fields.set(blockId, ref)}
                              multiline
                              scrollEnabled={false}
                              submitBehavior="submit"
                              placeholder={index() === 0 && !block().text ? 'Start writing' : ''}
                              accessibilityLabel={`${accessibleKind(block().kind)} ${index() + 1}`}
                              value={block().text}
                              onValueChange={(text) => edit(block(), text)}
                              onSubmitEditing={() => split(block())}
                              onKeyPress={(event) => key(block(), index(), event.nativeEvent.key)}
                              onFocus={() => setFocused(blockId)}
                              onSelectionChange={(event) => {
                                const value = event.nativeEvent.selection;
                                selection = { start: value.start, end: value.end ?? value.start };
                              }}
                            />
                          </View>
                        );
                      }}
                    </For>
                  </>
                }
              >
                <Text class="read-title" accessibilityRole="header">
                  {current().title || 'Untitled'}
                </Text>
                <For each={current().blocks}>
                  {(block) => (
                    <View class={`read-block ${block.kind}${block.done ? ' done' : ''}`}>
                      <Show when={block.kind === 'bullet'}>
                        <Text class="marker">•</Text>
                      </Show>
                      <Show when={block.kind === 'check'}>
                        <Text class="marker">{block.done ? '☑︎' : '☐'}</Text>
                      </Show>
                      <Text class="read-text">
                        <For each={inline(block.text)}>
                          {(span) => (
                            <Text
                              class={[
                                span.bold && 'bold',
                                span.italic && 'italic',
                                span.code && 'code',
                                span.strike && 'strike',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {span.text}
                            </Text>
                          )}
                        </For>
                      </Text>
                    </View>
                  )}
                </For>
              </Show>
            </ScrollView>
            <Show when={!reading()}>
              <KeyboardDock class="dock">
                <View class="toolbar" accessibilityRole="toolbar">
                  <For each={KINDS}>
                    {(one) => (
                      <Pressable
                        class={`tool${focusedBlock()?.kind === one.kind ? ' on' : ''}`}
                        accessibilityRole="button"
                        accessibilityLabel={one.name}
                        accessibilityState={{ selected: focusedBlock()?.kind === one.kind }}
                        onPress={() => setKind(one.kind)}
                      >
                        <Text class="tool-glyph">{one.glyph}</Text>
                      </Pressable>
                    )}
                  </For>
                  <View class="rule" />
                  <Pressable
                    class="tool"
                    accessibilityRole="button"
                    accessibilityLabel="Bold"
                    onPress={() => mark('**')}
                  >
                    <Text class="tool-glyph bold">B</Text>
                  </Pressable>
                  <Pressable
                    class="tool"
                    accessibilityRole="button"
                    accessibilityLabel="Italic"
                    onPress={() => mark('*')}
                  >
                    <Text class="tool-glyph italic">I</Text>
                  </Pressable>
                </View>
              </KeyboardDock>
            </Show>
          </View>
        )}
      </Show>
    </view>
  ));
}
