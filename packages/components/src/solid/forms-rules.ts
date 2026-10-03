import type { FormError, FormValidator } from './forms-types.ts';

interface Message {
  message?: string;
}
const empty = (value: unknown) => value === null || value === undefined || value === '';
const error = (kind: string, options: Message): FormError => ({ kind, ...options });

export function formRequired(options: Message = {}): FormValidator<unknown> {
  return (value) =>
    empty(value) || value === false || (Array.isArray(value) && !value.length)
      ? error('required', options)
      : undefined;
}
export function formMinLength(length: number, options: Message = {}): FormValidator<string> {
  return (value) =>
    value.length && value.length < length ? error('minLength', options) : undefined;
}
export function formMaxLength(length: number, options: Message = {}): FormValidator<string> {
  return (value) => (value.length > length ? error('maxLength', options) : undefined);
}
export function formPattern(pattern: RegExp, options: Message = {}): FormValidator<string> {
  // Stateful /g and /y expressions must not alternate validity on the same input.
  const expression = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''));
  return (value) => (value && !expression.test(value) ? error('pattern', options) : undefined);
}
export function formEmail(options: Message = {}): FormValidator<string> {
  // Match the legacy form contract: local <=64, total <=254, dot-separated local
  // atoms and hostname labels; a single hostname (e.g. localhost) is accepted.
  const expression =
    /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return (value) => (value && !expression.test(value) ? error('email', options) : undefined);
}
