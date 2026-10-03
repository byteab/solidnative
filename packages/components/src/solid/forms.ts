import { batch, createSignal, getOwner, onCleanup, untrack } from 'solid-js';
import { createFieldRuntime, type FieldRuntime } from './forms-field.ts';
import type {
  FormControlProps,
  FormField,
  FormFields,
  FormFieldSchema,
  FormSchema,
  FormSubmitOptions,
  NativeForm,
} from './forms-types.ts';

type Path = readonly (string | number)[];
interface Tree {
  readonly fields: unknown;
  refresh(
    value: unknown,
    values: unknown,
    aliases: Map<unknown, unknown>,
    current: () => boolean,
  ): void;
  leaves(): FieldRuntime[];
  dispose(): void;
}
interface ArraySchema {
  each?: unknown;
  key?: (value: unknown) => string | number;
}
type Write = (path: Path, value: unknown) => void;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

function replaceAt(
  value: unknown,
  path: Path,
  next: unknown,
  aliases: Map<unknown, unknown>,
): unknown {
  if (!path.length) return next;
  const [key, ...rest] = path;
  const source = value as Record<string | number, unknown>;
  const copy = Array.isArray(value) ? [...value] : { ...source };
  (copy as Record<string | number, unknown>)[key!] = replaceAt(source[key!], rest, next, aliases);
  aliases.set(copy, value);
  return copy;
}

function createArray(
  initial: readonly unknown[],
  schema: ArraySchema,
  path: () => Path,
  write: Write,
): Tree {
  type Row = { last: unknown; index: number; tree: Tree };
  let active = true;
  let rows: Row[] = [];
  const [items, setItems] = createSignal<readonly unknown[]>([]);
  const [value, setValue] = createSignal(initial);
  const makeRow = (item: unknown, index: number): Row => {
    const row = { last: item, index } as Row;
    row.tree = createTree(item, schema.each, () => [...path(), row.index], write);
    return row;
  };
  const identity = (item: unknown) => (schema.key ? schema.key(item) : item);
  function reconcile(next: readonly unknown[], aliases: Map<unknown, unknown>) {
    const available = new Map<unknown, Row[]>();
    for (const row of rows) {
      const key = identity(row.last);
      available.set(key, [...(available.get(key) ?? []), row]);
    }
    const replacement = next.map((item, index) => {
      const key = identity(schema.key ? item : (aliases.get(item) ?? item));
      const row = available.get(key)?.shift() ?? makeRow(item, index);
      row.last = item;
      row.index = index;
      return row;
    });
    const removed = [...available.values()].flat();
    rows = replacement;
    setValue(next);
    setItems((previous) => {
      const nextItems = rows.map((row) => row.tree.fields);
      return previous.length === nextItems.length &&
        previous.every((item, index) => item === nextItems[index])
        ? previous
        : nextItems;
    });
    return removed;
  }
  rows = initial.map(makeRow);
  setItems(rows.map((row) => row.tree.fields));
  return {
    fields: {
      value,
      items,
      setValue(next: readonly unknown[] | ((previous: readonly unknown[]) => readonly unknown[])) {
        if (active) write(path(), next);
      },
    },
    refresh(next, values, aliases, current) {
      if (!active || !current()) return;
      const removed = reconcile(next as readonly unknown[], aliases);
      for (const row of removed) row.tree.dispose();
      for (const row of rows) {
        if (!active || !current()) return;
        row.tree.refresh(row.last, values, aliases, current);
      }
    },
    leaves: () => {
      items();
      return rows.flatMap((row) => row.tree.leaves());
    },
    dispose() {
      if (!active) return;
      active = false;
      for (const row of rows) row.tree.dispose();
    },
  };
}

function createTree(initial: unknown, schema: unknown, path: () => Path, write: Write): Tree {
  if (Array.isArray(initial))
    return createArray(initial, (schema ?? {}) as ArraySchema, path, write);
  if (isRecord(initial)) {
    const rules = (schema ?? {}) as Record<string, unknown>;
    const children = Object.entries(initial).map(
      ([key, value]) =>
        [key, createTree(value, rules[key], () => [...path(), key], write)] as const,
    );
    return {
      fields: Object.fromEntries(children.map(([key, tree]) => [key, tree.fields])),
      refresh(next, values, aliases, current) {
        for (const [key, tree] of children) {
          if (!current()) return;
          tree.refresh((next as Record<string, unknown>)[key], values, aliases, current);
        }
      },
      leaves: () => children.flatMap(([, tree]) => tree.leaves()),
      dispose: () => {
        for (const [, tree] of children) tree.dispose();
      },
    };
  }
  const leaf = createFieldRuntime(
    initial,
    (schema ?? {}) as FormFieldSchema<unknown, unknown>,
    (next) => write(path(), next),
  );
  return {
    fields: leaf.field,
    refresh: (next, values, _aliases, current) => leaf.refresh(next, values, current),
    leaves: () => [leaf],
    dispose: leaf.dispose,
  };
}

function checkKeys(value: unknown, schema: unknown): void {
  if (Array.isArray(value)) {
    const rules = (schema ?? {}) as ArraySchema;
    const keys = rules.key ? value.map(rules.key) : [];
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate form array key');
    for (const item of value) checkKeys(item, rules.each);
  } else if (isRecord(value)) {
    const rules = (schema ?? {}) as Record<string, unknown>;
    for (const [key, item] of Object.entries(value)) checkKeys(item, rules[key]);
  }
}

/** Immutable model updates preserve unaffected field and dynamic-row owners. */
export function createForm<T>(initial: T, schema?: FormSchema<T>): NativeForm<T> {
  checkKeys(initial, schema);
  const [value, publish] = createSignal(initial);
  const [submitting, setSubmitting] = createSignal(false);
  let active = true;
  let revision = 0;
  let editing = false;
  let submission: AbortController | undefined;
  let submitEpoch = 0;
  const tree = createTree(
    initial,
    schema,
    () => [],
    (path, next) => {
      if (!active) return;
      const token = revision;
      const previous = path.reduce<unknown>(
        (item, key) => (item as Record<string | number, unknown>)[key],
        untrack(value),
      );
      const result = typeof next === 'function' ? next(previous) : next;
      if (!active || revision !== token) return;
      const aliases = new Map<unknown, unknown>();
      update(replaceAt(untrack(value), path, result, aliases) as T, aliases);
    },
  );
  const fields = () => tree.leaves().map((leaf) => leaf.field);
  const firstInvalid = () =>
    fields().find((field) => !field.hidden() && !field.disabled() && field.invalid());
  const markAllTouched = () => {
    const token = revision;
    for (const field of fields()) {
      if (!active || revision !== token) return;
      if (!field.hidden() && !field.disabled()) field.markTouched();
    }
  };
  function cancelSubmit() {
    const previous = submission;
    submission = undefined;
    setSubmitting(false);
    previous?.abort();
  }
  function update(next: T, aliases = new Map<unknown, unknown>()) {
    if (!active || Object.is(next, untrack(value))) return;
    checkKeys(next, schema);
    const token = ++revision;
    const current = () => active && revision === token;
    const previousEditing = editing;
    editing = true;
    try {
      batch(() => {
        publish(() => next);
        cancelSubmit();
        if (current()) tree.refresh(next, next, aliases, current);
      });
    } finally {
      editing = previousEditing;
    }
  }
  async function submit(
    handler: (value: T, context: { signal: AbortSignal }) => void | Promise<void>,
    options: FormSubmitOptions = {},
  ): Promise<boolean> {
    if (!active || editing || submission) return false;
    const controller = new AbortController();
    submission = controller;
    const epoch = ++submitEpoch;
    const token = revision;
    const current = () => active && submission === controller && revision === token;
    const aborted = new Promise<false>((resolve) => {
      controller.signal.addEventListener('abort', () => resolve(false), { once: true });
    });
    async function attempt() {
      setSubmitting(true);
      if (!current()) return false;
      markAllTouched();
      if (!current()) return false;
      await Promise.all(tree.leaves().map((leaf) => leaf.wait()));
      if (!current()) return false;
      const invalid = firstInvalid();
      if (invalid) {
        if (options.focusInvalid !== false) invalid.focusBoundControl();
        return false;
      }
      await handler(untrack(value), { signal: controller.signal });
      return current();
    }
    let ok: boolean;
    try {
      ok = await Promise.race([attempt(), aborted]);
    } finally {
      if (submission === controller) {
        submission = undefined;
        setSubmitting(false);
      }
    }
    return ok && active && revision === token && submitEpoch === epoch;
  }
  const dispose = () => {
    if (!active) return;
    active = false;
    revision++;
    batch(() => {
      cancelSubmit();
      tree.dispose();
    });
  };
  if (getOwner()) onCleanup(dispose);
  try {
    batch(() => tree.refresh(initial, initial, new Map(), () => active));
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    fields: tree.fields as FormFields<T>,
    value,
    setValue: (next) => {
      if (!active) return;
      const token = revision;
      const result = typeof next === 'function' ? (next as (value: T) => T)(untrack(value)) : next;
      if (active && revision === token) update(result);
    },
    errors: () => fields().flatMap((field) => field.errors()),
    invalid: () => !!firstInvalid(),
    pending: () => fields().some((field) => field.pending()),
    submitting,
    firstInvalid,
    markAllTouched,
    reset(next = initial) {
      if (!active) return;
      batch(() => {
        cancelSubmit();
        update(next);
        if (active) for (const field of untrack(fields)) field.markUntouched();
      });
    },
    submit,
    dispose,
  };
}

/** Spread once in an owned component; getters preserve controlled-value authority. */
export function bindFormField<T>(field: FormField<T>): FormControlProps<T> {
  let release: (() => void) | undefined;
  let active = true;
  if (getOwner())
    onCleanup(() => {
      active = false;
      release?.();
    });
  return {
    get value() {
      return field.value();
    },
    get disabled() {
      return field.disabled();
    },
    get invalid() {
      return field.invalid();
    },
    get touched() {
      return field.touched();
    },
    onValueChange: (value) => {
      if (active) field.setValue(value);
    },
    onTouched: () => {
      if (active) field.markTouched();
    },
    onTouch: () => {
      if (active) field.markTouched();
    },
    ref(control) {
      release?.();
      if (active) release = field.registerControl(control);
    },
  };
}
