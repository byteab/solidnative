/** @jsxImportSource @solidnative/platform/solid */
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  bindFormField,
  createForm,
  formRequired,
} from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { Haptics } from '@solidnative/expo/solid/haptics';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solidnative/platform/solid';
import { useNavigation } from '@solidnative/router/solid';
import { Ledger, money, toPence } from '../payments/ledger.solid.ts';
import sheet from './send.native.css';

const QUICK_AMOUNTS = ['10', '20', '50'];

/**
 * Sending money: a form over native text fields, presented as a modal.
 *
 * Styled with component CSS rather than Tailwind, to show the other half of the styling story:
 * custom properties on :host, attribute selectors, :active with a transition, and a
 * prefers-color-scheme query, all compiled at build time.
 */
export function Send() {
  const ledger = useService(Ledger);
  const haptics = useService(Haptics);
  const navigation = useNavigation();
  const form = createForm(
    { to: '', amount: '', note: '' },
    {
      to: { validate: formRequired({ message: 'Who is it for?' }) },
      amount: {
        validate: [
          formRequired({ message: 'Enter an amount' }),
          (value) => {
            if (!value) return undefined;
            const pence = toPence(value);
            if (!(pence > 0)) return { kind: 'amount', message: 'Enter an amount' };
            if (pence > ledger.balance()) return { kind: 'balance', message: 'More than you have' };
            return undefined;
          },
        ],
      },
    },
  );
  const amount = form.fields.amount;
  const error = () => (amount.touched() ? amount.errors()[0]?.message : undefined);
  const label = () => {
    const pence = toPence(amount.value());
    return Number.isNaN(pence) || pence === 0 ? 'Send' : `Send ${money(pence)}`;
  };
  const choose = (quick: string) => {
    amount.setValue(quick);
    haptics.select();
  };
  const submit = () => {
    if (form.invalid()) {
      haptics.notify('error');
      return;
    }
    const { to, amount, note } = form.value();
    ledger.send(to.trim(), toPence(amount), note.trim());
    haptics.notify('success');
    void navigation.back();
  };
  return withNativeStyles(sheet, () => (
    <view ref={(node) => setNativeStyleHost(node, sheet)}>
      <SafeAreaView class="screen" edges={['top', 'bottom']}>
        <View class="bar">
          <Pressable accessibilityRole="button" onPress={() => void navigation.back()}>
            <Text class="link">Cancel</Text>
          </Pressable>
          <Text class="title">Send money</Text>
          <View class="spacer" />
        </View>

        <ScrollView class="fill" keyboardShouldPersistTaps="handled">
          <View class="body">
            <Text class="label">To</Text>
            <TextInput
              {...bindFormField(form.fields.to)}
              class="field"
              placeholder="Name"
              accessibilityLabel="Recipient"
              autoCapitalize="words"
            />

            <Text class="label">Amount</Text>
            <TextInput
              {...bindFormField(amount)}
              class="field amount"
              placeholder="£0.00"
              accessibilityLabel="Amount"
              keyboardType="decimal-pad"
            />
            <Show when={error()}>{(message) => <Text class="error">{message()}</Text>}</Show>

            <View class="chips">
              <For each={QUICK_AMOUNTS}>
                {(quick) => (
                  <Pressable
                    class="chip"
                    accessibilityRole="button"
                    data-selected={amount.value() === quick ? '' : undefined}
                    onPress={() => choose(quick)}
                  >
                    <Text class="chip-label">£{quick}</Text>
                  </Pressable>
                )}
              </For>
            </View>

            <Text class="label">Note</Text>
            <TextInput
              {...bindFormField(form.fields.note)}
              class="field"
              placeholder="What it is for"
              accessibilityLabel="Note"
            />

            <Text class="hint">Available: {money(ledger.balance())}</Text>
          </View>
        </ScrollView>

        <Pressable
          class="submit"
          accessibilityRole="button"
          accessibilityState={{ disabled: form.invalid() }}
          data-disabled={form.invalid() ? '' : undefined}
          onPress={submit}
        >
          <Text class="submit-label">{label()}</Text>
        </Pressable>
      </SafeAreaView>
    </view>
  ));
}
