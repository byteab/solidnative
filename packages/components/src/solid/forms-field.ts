import { batch, createSignal, untrack } from 'solid-js';
import type { FormError, FormField, FormFieldSchema, FormResult } from './forms-types.ts';

export interface FieldRuntime {
  readonly field: FormField<unknown>;
  refresh(value: unknown, values: unknown, current: () => boolean): void;
  wait(): Promise<void>;
  dispose(): void;
}
const errorsOf = (result: FormResult): readonly FormError[] =>
  result ? (Array.isArray(result) ? result : [result as FormError]) : [];
const equalErrors = (left: readonly FormError[], right: readonly FormError[]) =>
  left.length === right.length &&
  left.every(
    (error, index) => error.kind === right[index]?.kind && error.message === right[index]?.message,
  );

type Schema = FormFieldSchema<unknown, unknown>;
function synchronousErrors(schema: Schema, next: unknown, values: unknown, current: () => boolean) {
  const validators = schema.validate ? [schema.validate].flat() : [];
  const errors: FormError[] = [];
  for (const validate of validators) {
    errors.push(...errorsOf(validate(next, { values })));
    if (!current()) break;
  }
  return errors;
}
function evaluateSchema(schema: Schema, next: unknown, values: unknown, current: () => boolean) {
  const context = { values };
  const hidden = schema.hidden?.(context) ?? false;
  if (!current()) return;
  const disabled = schema.disabled?.(context) ?? false;
  if (!current()) return;
  const errors = hidden || disabled ? [] : synchronousErrors(schema, next, values, current);
  return { hidden, disabled, errors };
}
function canValidateAsync(schema: Schema, state: NonNullable<ReturnType<typeof evaluateSchema>>) {
  return !!schema.async && !state.hidden && !state.disabled && !state.errors.length;
}
function dependencies(schema: Schema, canValidate: boolean, values: unknown) {
  return canValidate ? schema.async?.deps?.({ values }) : undefined;
}

/** One leaf owns its debounce, request identity and native-control registrations. */
export function createFieldRuntime(
  initial: unknown,
  schema: FormFieldSchema<unknown, unknown>,
  write: (value: unknown) => void,
): FieldRuntime {
  const [value, setValue] = createSignal(initial);
  const [errors, setErrors] = createSignal<readonly FormError[]>([], { equals: equalErrors });
  const [hidden, setHidden] = createSignal(false);
  const [disabled, setDisabled] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const [touched, setTouched] = createSignal(false);
  const controls = new Set<{ control: Parameters<FormField<unknown>['registerControl']>[0] }>();
  let active = true;
  let generation = 0;
  let request: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = Promise.resolve();
  let settle: (() => void) | undefined;
  let lastValue: unknown;
  let lastDeps: unknown;
  let eligible = false;
  let asyncErrors: readonly FormError[] = [];
  const changed = (next: unknown, deps: unknown, canValidate: boolean) =>
    canValidate !== eligible || !Object.is(lastValue, next) || !Object.is(lastDeps, deps);

  function cancel() {
    generation++;
    const previous = request;
    request = undefined;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    settle?.();
    settle = undefined;
    previous?.abort();
  }

  function start(next: unknown, values: unknown, current: () => boolean) {
    const validation = schema.async!;
    const controller = new AbortController();
    request = controller;
    const token = generation;
    const valid = () => active && request === controller && generation === token;
    settled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const finish = (result: FormResult) => {
      if (!valid()) return;
      asyncErrors = errorsOf(result);
      // Finish the request before publishing: observers may start another request.
      request = undefined;
      const resolve = settle;
      settle = undefined;
      batch(() => {
        setErrors(asyncErrors);
        setPending(false);
      });
      resolve?.();
    };
    const run = () => {
      timer = undefined;
      if (!valid()) return;
      let result: Promise<FormResult>;
      try {
        result = validation.validate(next, { values, signal: controller.signal });
      } catch (error) {
        result = Promise.reject(error);
      }
      void Promise.resolve(result).then(finish, (error: unknown) => {
        if (!valid()) return;
        let result: FormResult;
        try {
          result = validation.onError
            ? validation.onError(error, { values })
            : {
                kind: 'async',
                message: 'Could not validate this field',
              };
        } catch {
          result = { kind: 'async', message: 'Could not validate this field' };
        }
        if (valid()) finish(result);
      });
    };
    setPending(true);
    if (!current() || !valid()) return;
    const delay = Math.max(0, validation.debounceMs ?? 0);
    if (delay > 0) timer = setTimeout(run, delay);
    else run();
  }

  function refresh(next: unknown, values: unknown, current: () => boolean) {
    if (!active || !current()) return;
    const state = evaluateSchema(schema, next, values, current);
    if (!state || !current()) return;
    const canValidate = canValidateAsync(schema, state);
    const deps = dependencies(schema, canValidate, values);
    if (!current()) return;
    const restart = changed(next, deps, canValidate);
    eligible = canValidate;
    lastValue = next;
    lastDeps = deps;
    if (restart) {
      asyncErrors = [];
      cancel();
      if (!current() || !active) return;
    }
    batch(() => {
      setValue(() => next);
      setHidden(state.hidden);
      setDisabled(state.disabled);
      setErrors([...state.errors, ...asyncErrors]);
      if (!canValidate) setPending(false);
      if (restart && canValidate) start(next, values, current);
    });
  }

  const field: FormField<unknown> = {
    value,
    errors,
    hidden,
    disabled,
    pending,
    touched,
    invalid: () => errors().length > 0,
    setValue(next) {
      if (!active || untrack(hidden) || untrack(disabled)) return;
      write(next);
    },
    markTouched: () => {
      if (active) setTouched(true);
    },
    markUntouched: () => {
      if (active) setTouched(false);
    },
    registerControl(control) {
      const registration = { control };
      if (active) controls.add(registration);
      return () => {
        controls.delete(registration);
      };
    },
    focusBoundControl() {
      if (!active || hidden() || disabled()) return false;
      const registration = [...controls].find(({ control }) => control.isAttached?.() ?? true);
      if (!registration || !active) return false;
      const { control } = registration;
      control.focus();
      return true;
    },
  };
  return {
    field,
    refresh,
    wait: () => settled,
    dispose() {
      if (!active) return;
      active = false;
      controls.clear();
      cancel();
      setPending(false);
    },
  };
}
