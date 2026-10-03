/** @jsxImportSource @solid-native/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { Show } from '@solid-native/platform/solid';
import { Pressable, ScrollView, Text, TextInput } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { NativeHeader, useNavigation } from '@solid-native/router/solid';
import { Session } from './session.solid.ts';

/** The actual email/password step, with explicit controlled validation and owned async work. */
export function LoginPage() {
  const session = useService(Session);
  const navigation = useNavigation();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [emailTouched, setEmailTouched] = createSignal(false);
  const [passwordTouched, setPasswordTouched] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [locked, setLocked] = createSignal(false);
  const [problem, setProblem] = createSignal<string | null>(null);
  const emailInvalid = () =>
    !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(
      email(),
    );
  const validation = new AbortController();
  let active = true;
  onCleanup(() => {
    active = false;
    validation.abort();
  });
  function validate() {
    setProblem(null);
    setEmailTouched(true);
    setPasswordTouched(true);
    if (emailInvalid() || !password()) {
      setProblem('Enter an email address and a password.');
      return false;
    }
    return true;
  }
  async function applyAnswer(answer: Awaited<ReturnType<Session['checkPassword']>>) {
    if (!active || answer === 'cancelled') return;
    if (answer === 'ok') {
      session.clearNotice();
      if (!active) return;
      if (!(await navigation.push('/auth/code')) && active)
        setProblem('The next screen could not open. Try again.');
    } else if (answer === 'locked') {
      setLocked(true);
      setProblem('Too many attempts. Try again later.');
    } else setProblem('That password is not right.');
  }
  async function signIn() {
    if (!active || submitting() || locked()) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const answer = await session.checkPassword(email(), password(), validation.signal);
      await applyAnswer(answer);
    } catch {
      if (active) setProblem('Sign in could not finish. Try again.');
    } finally {
      if (active) setSubmitting(false);
    }
  }
  return (
    <>
      <NativeHeader title="Sign in" />
      <ScrollView
        class="screen"
        contentContainerStyle={{ padding: 20, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <Show when={session.notice()}>
          {(notice) => (
            <Text class="body" accessibilityRole="alert">
              {notice()}
            </Text>
          )}
        </Show>
        <TextInput
          class="field"
          accessibilityLabel="Email"
          placeholder="Email"
          value={email()}
          onValueChange={setEmail}
          invalid={emailInvalid()}
          touched={emailTouched()}
          onBlur={() => setEmailTouched(true)}
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="username"
          autoComplete="email"
        />
        <TextInput
          class="field"
          accessibilityLabel="Password"
          placeholder="Password"
          value={password()}
          onValueChange={setPassword}
          invalid={!password()}
          touched={passwordTouched()}
          onBlur={() => setPasswordTouched(true)}
          secureTextEntry
          textContentType="password"
          autoComplete="current-password"
          onSubmitEditing={() => {
            void signIn();
          }}
        />
        <Show when={problem()}>
          {(message) => (
            <Text class="danger" accessibilityRole="alert">
              {message()}
            </Text>
          )}
        </Show>
        <Pressable
          class="button"
          accessibilityRole="button"
          disabled={submitting() || locked()}
          onPress={() => {
            void signIn();
          }}
        >
          <Text class="button-label">{submitting() ? 'Signing in' : 'Sign in'}</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
