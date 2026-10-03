/** @jsxImportSource solid-js */
/**
 * An export's API, as read out of its own source.
 *
 * Nothing here is written by hand. `build/api.ts` reads every package's Solid entry at build time
 * and this renders what it found: a component's props and events with their types and doc
 * comments, a function's signature, a class's or service's members. A page asks for it with
 * `<!-- api: Button -->`.
 *
 * The upshot is that the reference cannot describe an API that no longer exists. The cost is that
 * an undocumented prop shows up here as an undocumented prop, which is the right pressure to apply
 * and the reason nothing invents a description to fill the gap.
 */
import { createMemo, For, Show } from 'solid-js';
import type { ApiEntry, ApiMember, ApiMethod } from '../build/api.ts';
import { findApi } from './doc-usage.tsx';
import './api-reference.css';

/** The member kinds, in the order a reader wants them. */
const GROUPS: readonly { kind: ApiMember['kind']; label: string }[] = [
  { kind: 'prop', label: 'Props' },
  { kind: 'event', label: 'Events' },
  { kind: 'property', label: 'Properties' },
];

/**
 * The first paragraph of a doc comment.
 *
 * These comments are written to be read in the editor and often run for pages. A table wants the
 * sentence that says what the prop is; anything longer belongs in the page's prose.
 */
function summary(doc: string | undefined): string {
  return (
    doc
      ?.split(/\n\s*\n/)[0]
      ?.replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

/** The summary, with its `code` spans rendered as code rather than as backticks. */
function Prose(props: { doc: string | undefined }) {
  return (
    <For each={summary(props.doc).split('`')}>
      {(text, index) => (index() % 2 === 1 ? <code>{text}</code> : text)}
    </For>
  );
}

function MemberRow(props: { member: ApiMember }) {
  return (
    <div class="api-row">
      <div class="api-cell-name">
        <code>{props.member.name}</code>
        <Show when={props.member.required}>
          <span class="api-required">required</span>
        </Show>
      </div>
      <div class="api-cell-type">
        <code>{props.member.type}</code>
      </div>
      <p class="api-cell-doc">
        <Prose doc={props.member.doc} />
      </p>
    </div>
  );
}

/** A signature is a line of its own: squeezed into a column it ran over its doc. */
function MethodRow(props: { method: ApiMethod }) {
  return (
    <div class="api-row api-row-method">
      <div class="api-cell-name">
        <code>{props.method.signature}</code>
      </div>
      <Show when={props.method.doc}>
        <p class="api-cell-doc">
          <Prose doc={props.method.doc} />
        </p>
      </Show>
    </div>
  );
}

function Reference(props: { entry: ApiEntry }) {
  const groups = createMemo(() =>
    GROUPS.map((group) => ({
      label: group.label,
      members: props.entry.members.filter((member) => member.kind === group.kind),
    })).filter((group) => group.members.length > 0),
  );
  return (
    <div class="api">
      <div class="api-head">
        <code class="api-name">
          {props.entry.kind === 'component' ? `<${props.entry.name}>` : props.entry.name}
        </code>
        <span class="api-kind">{props.entry.kind}</span>
        <code class="api-package">{props.entry.package}</code>
      </div>
      {/* The line to copy: which name, and from where, which the package name alone does not say. */}
      <div class="api-import">
        <code>{`import { ${props.entry.name} } from '${props.entry.importPath}';`}</code>
      </div>
      <Show when={summary(props.entry.doc)}>
        <p class="api-summary">
          <Prose doc={props.entry.doc} />
        </p>
      </Show>

      <Show when={props.entry.signature}>
        {(signature) => (
          <>
            <h4 class="api-group">Signature</h4>
            <div class="api-table">
              <div class="api-row api-row-method">
                <div class="api-cell-name">
                  <code>{signature()}</code>
                </div>
              </div>
            </div>
          </>
        )}
      </Show>

      <For each={groups()}>
        {(group) => (
          <>
            <h4 class="api-group">{group.label}</h4>
            <div class="api-table">
              <For each={group.members}>{(member) => <MemberRow member={member} />}</For>
            </div>
          </>
        )}
      </For>

      <Show when={props.entry.methods.length}>
        <h4 class="api-group">Methods</h4>
        <div class="api-table">
          <For each={props.entry.methods}>{(method) => <MethodRow method={method} />}</For>
        </div>
      </Show>

      <Show when={!groups().length && !props.entry.methods.length && !props.entry.signature}>
        <p class="api-empty">No public members.</p>
      </Show>
    </div>
  );
}

export function ApiReference(props: {
  /** `Button`, or `@solid-native/components#Switch` where two packages share a name. */
  reference: string;
}) {
  const entry = createMemo(() => findApi(props.reference));
  return (
    <api-reference>
      {/*
        Loud rather than blank. A reference to an export that has been renamed is the exact drift
        this whole mechanism exists to catch, so it says so on the page.
      */}
      <Show
        when={entry()}
        fallback={
          <p class="api-missing">
            No declaration named <code>{props.reference}</code>.
          </p>
        }
      >
        {(found) => <Reference entry={found()} />}
      </Show>
    </api-reference>
  );
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      /** This component's host tag, which CSS and prerender find it by. */
      'api-reference': HTMLAttributes<HTMLElement>;
    }
  }
}
