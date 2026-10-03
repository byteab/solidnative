import type { Accessor } from 'solid-js';

export interface FormError {
  readonly kind: string;
  readonly message?: string;
}
export type FormResult = FormError | readonly FormError[] | undefined | void;
export interface FormValidationContext<T> {
  readonly values: T;
}
export type FormValidator<V, T = unknown> = (
  value: V,
  context: FormValidationContext<T>,
) => FormResult;
export interface FormAsyncValidator<V, T = unknown> {
  validate(
    value: V,
    context: FormValidationContext<T> & { signal: AbortSignal },
  ): Promise<FormResult>;
  debounceMs?: number;
  /** Declare cross-field dependencies; an unrelated edit does not restart a request. */
  deps?: (context: FormValidationContext<T>) => unknown;
  onError?: (error: unknown, context: FormValidationContext<T>) => FormResult;
}
export interface FormFieldSchema<V, T> {
  validate?: FormValidator<V, T> | readonly FormValidator<V, T>[];
  async?: FormAsyncValidator<V, T>;
  hidden?: (context: FormValidationContext<T>) => boolean;
  disabled?: (context: FormValidationContext<T>) => boolean;
}
export type FormSchema<T, Root = T> = [T] extends [readonly (infer Item)[]]
  ? { each?: FormSchema<Item, Root>; key?: (item: Item) => string | number }
  : [T] extends [Date | null | undefined]
    ? FormFieldSchema<T, Root>
    : [T] extends [object]
      ? { [K in keyof T]?: FormSchema<T[K], Root> }
      : FormFieldSchema<T, Root>;

export interface FormControlRef {
  focus(): void;
  isAttached?(): boolean;
}
export interface FormField<T> {
  readonly value: Accessor<T>;
  setValue(value: T | ((previous: T) => T)): void;
  readonly errors: Accessor<readonly FormError[]>;
  readonly pending: Accessor<boolean>;
  readonly invalid: Accessor<boolean>;
  readonly touched: Accessor<boolean>;
  readonly hidden: Accessor<boolean>;
  readonly disabled: Accessor<boolean>;
  markTouched(): void;
  markUntouched(): void;
  focusBoundControl(): boolean;
  registerControl(control: FormControlRef): () => void;
}
export interface FormArray<T> {
  readonly value: Accessor<readonly T[]>;
  setValue(value: readonly T[] | ((previous: readonly T[]) => readonly T[])): void;
  readonly items: Accessor<readonly FormFields<T>[]>;
}
export type FormFields<T> = [T] extends [readonly (infer Item)[]]
  ? FormArray<Item>
  : [T] extends [Date | null | undefined]
    ? FormField<T>
    : [T] extends [object]
      ? { readonly [K in keyof T]: FormFields<T[K]> }
      : FormField<T>;

export interface FormControlProps<T> {
  readonly value: T;
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly touched: boolean;
  onValueChange(value: T): void;
  onTouched(): void;
  /** Expo UI controls call onTouch; native TextInput/Switch call onTouched. */
  onTouch(): void;
  ref(control: FormControlRef): void;
}
export interface FormSubmitOptions {
  focusInvalid?: boolean;
}
export interface NativeForm<T> {
  readonly fields: FormFields<T>;
  readonly value: Accessor<T>;
  setValue(value: T | ((previous: T) => T)): void;
  readonly errors: Accessor<readonly FormError[]>;
  readonly invalid: Accessor<boolean>;
  readonly pending: Accessor<boolean>;
  readonly submitting: Accessor<boolean>;
  firstInvalid(): FormField<unknown> | undefined;
  markAllTouched(): void;
  /**
   * Back to the creation value (or `value`), every field untouched and any submit cancelled. Errors
   * are re-derived for that value, so an untouched-gated message disappears.
   */
  reset(value?: T): void;
  /** Edits/disposal cancel the attempt, even if the handler ignores its AbortSignal. */
  submit(
    handler: (value: T, context: { signal: AbortSignal }) => void | Promise<void>,
    options?: FormSubmitOptions,
  ): Promise<boolean>;
  dispose(): void;
}
