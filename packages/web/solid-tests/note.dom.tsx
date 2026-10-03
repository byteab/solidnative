/** @jsxImportSource solid-js */
import { createSignal } from 'solid-js';

export interface NoteProps {
  label?: string;
  text?: string;
  onTextChange?: (value: string) => void;
  onSent?: (value: string) => void;
}

export function Note(props: NoteProps) {
  const [draft, setDraft] = createSignal<string>();
  const text = () => draft() ?? props.text ?? '';
  return (
    <>
      <style>{'textarea { resize: vertical; }'}</style>
      <label id="label">{props.label}</label>
      <textarea
        id="text"
        value={text()}
        onInput={(event) => {
          setDraft(event.currentTarget.value);
          props.onTextChange?.(event.currentTarget.value);
        }}
      />
      <button id="send" onClick={() => props.onSent?.(text())}>
        Send
      </button>
      <button
        id="fail"
        onClick={() => {
          throw new Error('the note failed');
        }}
      >
        Fail
      </button>
    </>
  );
}
