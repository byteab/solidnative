import { createServiceToken } from '@solidnative/device/solid';
import {
  formRequired,
  formEmail,
  formMinLength,
  formMaxLength,
  formPattern,
  type FormSchema,
} from '@solidnative/components/solid';

export type Country = 'GB' | 'US' | 'IE';

export interface Dependant {
  name: string;
  born: Date | null;
}

/** A membership application, in the order the screen asks for it. */
export interface Application {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  born: Date | null;
  country: Country;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postcode: string;
  username: string;
  password: string;
  confirm: string;
  newsletter: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  sms: boolean;
  dependants: Dependant[];
  bio: string;
  terms: boolean;
}

export const emptyApplication = (): Application => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  born: null,
  country: 'GB',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postcode: '',
  username: '',
  password: '',
  confirm: '',
  newsletter: false,
  frequency: 'weekly',
  sms: false,
  dependants: [],
  bio: '',
  terms: false,
});

const POSTCODES: Record<Country, RegExp> = {
  GB: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
  US: /^\d{5}(-\d{4})?$/,
  IE: /^[A-Z]\d{2} ?[A-Z\d]{4}$/i,
};

/** Years between a date and today. */
function ageOn(born: Date, today = new Date()): number {
  let years = today.getFullYear() - born.getFullYear();
  const birthday = new Date(today.getFullYear(), born.getMonth(), born.getDate());
  if (today < birthday) years--;
  return years;
}

/** The same simulated server, with cancellation and listener ownership made explicit. */
export class UsernameChecks {
  latency = 600;
  readonly taken = new Set(['ada', 'grace', 'admin', 'root']);
  checks = 0;

  isFree(name: string, signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) return Promise.reject(new Error('aborted'));
    this.checks++;
    return new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        reject(new Error('aborted'));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve(!this.taken.has(name.toLowerCase()));
      }, this.latency);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
}
export const Usernames = createServiceToken('canary.usernames', () => new UsernameChecks());

/** All original application rules, including optional, conditional and repeated fields. */
export function applicationSchema(usernames: UsernameChecks): FormSchema<Application> {
  return {
    firstName: { validate: formRequired({ message: 'Enter your first name' }) },
    lastName: { validate: formRequired({ message: 'Enter your last name' }) },
    email: {
      validate: [
        formRequired({ message: 'Enter your email address' }),
        formEmail({ message: 'That is not an email address' }),
      ],
    },
    phone: { validate: formPattern(/^\+?[\d ]{7,15}$/, { message: 'Enter a phone number' }) },
    born: {
      validate: [
        formRequired({ message: 'Enter your date of birth' }),
        (born) =>
          born && ageOn(born) < 18
            ? { kind: 'underage', message: 'You must be 18 or over' }
            : undefined,
      ],
    },
    country: {},
    line1: { validate: formRequired({ message: 'Enter the first line of your address' }) },
    line2: {},
    city: { validate: formRequired({ message: 'Enter your town or city' }) },
    state: {
      hidden: ({ values }) => values.country !== 'US',
      validate: (value, { values }) =>
        values.country === 'US' && !value
          ? { kind: 'required', message: 'Choose a state' }
          : undefined,
    },
    postcode: {
      validate: [
        formRequired({ message: 'Enter your postcode' }),
        (value, { values }) =>
          !value.trim() || POSTCODES[values.country].test(value.trim())
            ? undefined
            : { kind: 'postcode', message: 'That postcode is not valid for this country' },
      ],
    },
    username: {
      validate: [
        formRequired({ message: 'Choose a username' }),
        formMinLength(3, { message: 'At least 3 characters' }),
        formPattern(/^[a-z0-9_]*$/i, { message: 'Letters, numbers and underscores only' }),
      ],
      async: {
        debounceMs: 300,
        validate: async (name, { signal }) =>
          (await usernames.isFree(name, signal))
            ? undefined
            : { kind: 'taken', message: 'That username is taken' },
        onError: () => ({ kind: 'unchecked', message: 'Could not check the username' }),
      },
    },
    password: {
      validate: [
        formRequired({ message: 'Choose a password' }),
        formMinLength(8, { message: 'At least 8 characters' }),
      ],
    },
    confirm: {
      validate: (value, { values }) =>
        value === values.password
          ? undefined
          : { kind: 'mismatch', message: 'The passwords do not match' },
    },
    newsletter: {},
    frequency: { hidden: ({ values }) => !values.newsletter },
    sms: { disabled: ({ values }) => !values.phone.trim() },
    dependants: {
      each: {
        name: { validate: formRequired({ message: 'Enter their name' }) },
        born: { validate: formRequired({ message: 'Enter their date of birth' }) },
      },
    },
    bio: { validate: formMaxLength(280, { message: 'At most 280 characters' }) },
    terms: {
      validate: (value) =>
        value ? undefined : { kind: 'terms', message: 'Accept the terms to continue' },
    },
  };
}
