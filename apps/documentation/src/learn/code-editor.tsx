/** @jsxImportSource solid-js */
/**
 * The editor: CodeMirror, one state per file so each keeps its own undo history, with the
 * problems the preview found marked on the lines they came from.
 *
 * TypeScript with JSX for `.ts` and `.tsx` files, CSS for `.css` and `.native.css`.
 */
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { createEffect, onCleanup, untrack, type JSX } from 'solid-js';
import { languageOf } from './file-name.ts';
import type { Problem } from './protocol.ts';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'learn-code-editor': HTMLAttributes<HTMLElement>;
    }
  }
}

/** Colours from the site's own `--code-*` tokens, which follow its light and dark themes. */
const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword], color: 'var(--code-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--code-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--code-comment)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--code-type)' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--code-function)',
  },
  { tag: [tags.tagName, tags.angleBracket], color: 'var(--code-tag)' },
  { tag: [tags.attributeName, tags.propertyName], color: 'var(--code-attribute)' },
  { tag: [tags.meta, tags.processingInstruction], color: 'var(--code-keyword)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'var(--surface-code)' },
  '.cm-scroller': { fontFamily: 'var(--font-docs-mono)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--fg-primary)', color: 'var(--fg-primary)' },
  '.cm-gutters': {
    backgroundColor: 'var(--surface-code)',
    color: 'var(--fg-quaternary)',
    border: 'none',
  },
  // Translucent on the line itself: CodeMirror draws the selection behind the text, so an opaque
  // active line hid any selection made within the line being edited.
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--fg-primary) 4%, transparent)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface-raised)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--brand) 30%, transparent) !important',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--fg-primary)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--surface-page)',
    border: '1px solid var(--border-default)',
    color: 'var(--fg-primary)',
  },
});

const SHARED: Extension[] = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  drawSelection(),
  history(),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  indentUnit.of('  '),
  EditorState.tabSize.of(2),
  keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
  syntaxHighlighting(highlight),
  lintGutter(),
  theme,
];

/** A problem as CodeMirror marks it: the rest of the line from its column. */
export function diagnosticFor(state: EditorState, problem: Problem): Diagnostic | undefined {
  if (!problem.line || problem.line > state.doc.lines) return undefined;
  const line = state.doc.line(problem.line);
  const from = Math.min(line.from + (problem.column ?? 0), line.to);
  return {
    from,
    to: Math.max(from, line.to),
    severity: problem.kind === 'css' ? 'warning' : 'error',
    message: problem.message,
  };
}

const LANGUAGES = {
  tsx: javascript({ jsx: true, typescript: true }),
  css: css(),
};

/** What the lesson page can ask of the editor. */
export interface CodeEditorApi {
  /** Put the cursor on a line of the file on screen. */
  goTo(line: number, column?: number): void;
}

export interface CodeEditorProps {
  /** Every file, by name. A change from outside, such as a reset, replaces the file's text. */
  readonly files: Readonly<Record<string, string>>;
  readonly file: string;
  readonly problems?: readonly Problem[];
  readonly onEdited?: (edit: { file: string; text: string }) => void;
  readonly ref?: (api: CodeEditorApi) => void;
}

export function CodeEditor(props: CodeEditorProps): JSX.Element {
  const host = (
    <learn-code-editor class="block h-full min-h-0 flex-1 overflow-hidden" />
  ) as HTMLElement;
  const states = new Map<string, EditorState>();
  let showing = '';

  const view = new EditorView({
    parent: host,
    dispatch: (transaction, view) => {
      view.update([transaction]);
      states.set(showing, view.state);
      if (transaction.docChanged) {
        props.onEdited?.({ file: showing, text: view.state.doc.toString() });
      }
    },
  });

  function stateFor(file: string, text: string): EditorState {
    const existing = states.get(file);
    if (existing && existing.doc.toString() === text) return existing;
    const state = EditorState.create({
      doc: text,
      extensions: [...SHARED, LANGUAGES[languageOf(file)]],
    });
    states.set(file, state);
    return state;
  }

  function show(file: string, files: Readonly<Record<string, string>>): void {
    const text = files[file] ?? '';
    const current = file === showing ? view.state : undefined;
    if (current && current.doc.toString() === text) return;
    showing = file;
    view.setState(stateFor(file, text));
    untrack(() => mark(props.problems ?? [], file));
  }

  function mark(problems: readonly Problem[], file: string): void {
    const diagnostics = problems
      .filter((problem) => problem.file === file)
      .map((problem) => diagnosticFor(view.state, problem))
      .filter((diagnostic) => diagnostic !== undefined);
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }

  createEffect(() => show(props.file, props.files));
  createEffect(() => mark(props.problems ?? [], props.file));
  onCleanup(() => view.destroy());

  props.ref?.({
    goTo(line, column = 0) {
      const doc = view.state.doc;
      if (line < 1 || line > doc.lines) return;
      const at = Math.min(doc.line(line).from + column, doc.line(line).to);
      view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
      view.focus();
    },
  });

  return host;
}
