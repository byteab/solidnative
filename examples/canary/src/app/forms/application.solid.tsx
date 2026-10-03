/** @jsxImportSource @solidnative/platform/solid */
import { createEffect, createSignal, onCleanup } from 'solid-js';
import {
  createForm,
  bindFormField,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type FormField,
  type TextInputProps,
} from '@solidnative/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { UiDatePicker, UiHost, UiPicker, type UiPickerOption } from '@solidnative/expo/solid';
import { For, Show, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader } from '@solidnative/router/solid';
import {
  Usernames,
  applicationSchema,
  emptyApplication,
  type Country,
} from './application-form.solid.ts';
import { FormRow } from './form-row.solid.tsx';
import styles from './application.native.css';

const countries: UiPickerOption[] = [
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'IE', label: 'Ireland' },
];
const states: UiPickerOption[] = ['', 'CA', 'NY', 'TX', 'WA'].map((value) => ({
  value,
  label: value || 'Choose',
}));
const frequencies: UiPickerOption[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function InputRow(props: {
  label: string;
  field: FormField<string>;
  hint?: string;
  input?: TextInputProps;
}) {
  return (
    <FormRow label={props.label} field={props.field} hint={props.hint}>
      <TextInput
        {...bindFormField(props.field)}
        class="field"
        accessibilityLabel={props.label}
        {...props.input}
      />
    </FormRow>
  );
}

function BirthRow(props: {
  label: string;
  field: FormField<Date | null>;
  accessibilityLabel?: string;
}) {
  return (
    <FormRow label={props.label} field={props.field}>
      <UiHost matchContents>
        <UiDatePicker
          {...bindFormField(props.field)}
          title="Born"
          accessibilityLabel={props.accessibilityLabel}
          displayedComponents={['date']}
          onTouch={() => props.field.markTouched()}
        />
      </UiHost>
    </FormRow>
  );
}

/** The complete original application form, including dynamic rows and server validation. */
export function ApplicationPage() {
  const form = createForm(emptyApplication(), applicationSchema(useService(Usernames)));
  const f = form.fields;
  const foreground = useService(SCREEN_IN_FRONT);
  const [sent, setSent] = createSignal(false);
  let active = true,
    revision = 0;
  let cancelDelay: (() => void) | undefined;
  createEffect(() => {
    if (!foreground()) {
      revision++;
      cancelDelay?.();
    }
  });
  onCleanup(() => {
    active = false;
    revision++;
    cancelDelay?.();
  });
  function sendDelay(signal: AbortSignal) {
    return new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', finish);
        if (cancelDelay === finish) cancelDelay = undefined;
        resolve();
      };
      const timer = setTimeout(finish, 400);
      cancelDelay = finish;
      signal.addEventListener('abort', finish, { once: true });
      if (signal.aborted || !active || !foreground()) finish();
    });
  }
  async function send() {
    if (!active || !foreground() || form.submitting()) return;
    const request = ++revision;
    setSent(false);
    if (!active || request !== revision) return;
    const ok = await form.submit(
      (_value, { signal }) => {
        if (active && foreground() && request === revision) return sendDelay(signal);
        return undefined;
      },
      { focusInvalid: false },
    );
    if (!active || !foreground() || request !== revision) return;
    if (ok) setSent(true);
    else form.firstInvalid()?.focusBoundControl();
  }
  const addDependant = () => f.dependants.setValue((items) => [...items, { name: '', born: null }]);
  const removeDependant = (index: number) =>
    f.dependants.setValue((items) => items.filter((_, at) => at !== index));
  const postcodeLabel = () => (form.value().country === 'US' ? 'ZIP code' : 'Postcode');
  return withNativeStyles(styles, () => (
    <>
      <NativeHeader title="Application" />
      <ScrollView
        class="screen"
        contentContainerStyle={{ padding: 20, gap: 14 }}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <Text class="section">About you</Text>
        <InputRow
          label="First name"
          field={f.firstName}
          input={{
            textContentType: 'givenName',
            autoComplete: 'given-name',
            returnKeyType: 'next',
            onSubmitEditing: () => f.lastName.focusBoundControl(),
          }}
        />
        <InputRow
          label="Last name"
          field={f.lastName}
          input={{
            textContentType: 'familyName',
            autoComplete: 'family-name',
            returnKeyType: 'next',
            onSubmitEditing: () => f.email.focusBoundControl(),
          }}
        />
        <InputRow
          label="Email"
          field={f.email}
          input={{
            keyboardType: 'email-address',
            textContentType: 'emailAddress',
            autoComplete: 'email',
            autoCapitalize: 'none',
            autoCorrect: false,
            returnKeyType: 'next',
            onSubmitEditing: () => f.phone.focusBoundControl(),
          }}
        />
        <InputRow
          label="Phone (optional)"
          field={f.phone}
          input={{
            accessibilityLabel: 'Phone',
            keyboardType: 'phone-pad',
            textContentType: 'telephoneNumber',
            autoComplete: 'tel',
            returnKeyType: 'next',
            onSubmitEditing: () => f.line1.focusBoundControl(),
          }}
        />
        <BirthRow label="Date of birth" field={f.born} accessibilityLabel="Date of birth" />

        <Text class="section">Address</Text>
        <FormRow label="Country" field={f.country}>
          <UiHost matchContents>
            <UiPicker
              {...bindFormField(f.country)}
              label="Country"
              pickerStyle="menu"
              options={countries}
              onValueChange={(value) => {
                if (countries.some((item) => item.value === value))
                  f.country.setValue(value as Country);
              }}
              onTouch={() => f.country.markTouched()}
            />
          </UiHost>
        </FormRow>
        <InputRow
          label="Address line 1"
          field={f.line1}
          input={{
            textContentType: 'streetAddressLine1',
            autoComplete: 'address-line1',
            returnKeyType: 'next',
            onSubmitEditing: () => f.line2.focusBoundControl(),
          }}
        />
        <InputRow
          label="Address line 2 (optional)"
          field={f.line2}
          input={{
            accessibilityLabel: 'Address line 2',
            textContentType: 'streetAddressLine2',
            autoComplete: 'address-line2',
            returnKeyType: 'next',
            onSubmitEditing: () => f.city.focusBoundControl(),
          }}
        />
        <InputRow
          label="Town or city"
          field={f.city}
          input={{
            textContentType: 'addressCity',
            autoComplete: 'address-level2',
            returnKeyType: 'next',
            onSubmitEditing: () => f.postcode.focusBoundControl(),
          }}
        />
        <Show when={!f.state.hidden()}>
          <FormRow label="State" field={f.state}>
            <UiHost matchContents>
              <UiPicker
                {...bindFormField(f.state)}
                label="State"
                pickerStyle="menu"
                options={states}
                onValueChange={(value) => {
                  if (typeof value === 'string') f.state.setValue(value);
                }}
                onTouch={() => f.state.markTouched()}
              />
            </UiHost>
          </FormRow>
        </Show>
        <InputRow
          label={postcodeLabel()}
          field={f.postcode}
          input={{
            get keyboardType() {
              return form.value().country === 'US' ? 'number-pad' : 'default';
            },
            textContentType: 'postalCode',
            autoComplete: 'postal-code',
            autoCapitalize: 'characters',
            returnKeyType: 'next',
            onSubmitEditing: () => f.username.focusBoundControl(),
          }}
        />

        <Text class="section">Account</Text>
        <InputRow
          label="Username"
          field={f.username}
          hint="Letters, numbers and underscores"
          input={{
            textContentType: 'username',
            autoComplete: 'username',
            autoCapitalize: 'none',
            autoCorrect: false,
            returnKeyType: 'next',
            onSubmitEditing: () => f.password.focusBoundControl(),
          }}
        />
        <InputRow
          label="Password"
          field={f.password}
          hint="At least 8 characters"
          input={{
            secureTextEntry: true,
            textContentType: 'newPassword',
            autoComplete: 'new-password',
            passwordRules: 'minlength: 8;',
            returnKeyType: 'next',
            onSubmitEditing: () => f.confirm.focusBoundControl(),
          }}
        />
        <InputRow
          label="Confirm password"
          field={f.confirm}
          input={{ secureTextEntry: true, textContentType: 'newPassword', returnKeyType: 'done' }}
        />

        <Text class="section">Preferences</Text>
        <View class="toggle-row">
          <Text class="body">Newsletter</Text>
          <Switch {...bindFormField(f.newsletter)} accessibilityLabel="Newsletter" />
        </View>
        <Show when={!f.frequency.hidden()}>
          <FormRow label="How often" field={f.frequency}>
            <UiHost matchContents>
              <UiPicker
                {...bindFormField(f.frequency)}
                label="How often"
                pickerStyle="segmented"
                options={frequencies}
                onValueChange={(value) => {
                  if (value === 'daily' || value === 'weekly' || value === 'monthly')
                    f.frequency.setValue(value);
                }}
                onTouch={() => f.frequency.markTouched()}
              />
            </UiHost>
          </FormRow>
        </Show>
        <View class="toggle-row">
          <View class="toggle-text">
            <Text class="body">Text messages</Text>
            <Show when={f.sms.disabled()}>
              <Text class="hint">Add a phone number to turn these on</Text>
            </Show>
          </View>
          <Switch {...bindFormField(f.sms)} accessibilityLabel="Text messages" />
        </View>

        <Text class="section">Dependants</Text>
        <For each={f.dependants.items()}>
          {(dependant, index) => (
            <View class="card dependant">
              <InputRow
                label={`Dependant ${index() + 1}`}
                field={dependant.name}
                input={{
                  get accessibilityLabel() {
                    return `Dependant ${index() + 1} name`;
                  },
                  textContentType: 'name',
                }}
              />
              <BirthRow label="Their date of birth" field={dependant.born} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove dependant ${index() + 1}`}
                onPress={() => removeDependant(index())}
              >
                <Text class="danger">Remove</Text>
              </Pressable>
            </View>
          )}
        </For>
        <Pressable class="card" accessibilityRole="button" onPress={addDependant}>
          <Text class="button-label">Add a dependant</Text>
        </Pressable>

        <Text class="section">About</Text>
        <InputRow
          label="A few words about you"
          field={f.bio}
          hint={`${form.value().bio.length} of 280`}
          input={{ class: 'field bio', accessibilityLabel: 'About you', multiline: true }}
        />
        <FormRow label="Terms" field={f.terms}>
          <View class="toggle-row">
            <Text class="body">I accept the terms</Text>
            <Switch {...bindFormField(f.terms)} accessibilityLabel="I accept the terms" />
          </View>
        </FormRow>
        <Pressable
          class="button"
          accessibilityRole="button"
          disabled={form.submitting()}
          onPress={() => {
            void send();
          }}
        >
          <Text class="button-label">{form.submitting() ? 'Sending' : 'Apply'}</Text>
        </Pressable>
        <Show when={sent()}>
          <Text class="body success" accessibilityRole="alert">
            Application sent.
          </Text>
        </Show>
      </ScrollView>
    </>
  ));
}
