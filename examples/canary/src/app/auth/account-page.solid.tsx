/** @jsxImportSource @solid-native/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { Show } from '@solid-native/platform/solid';
import { Pressable, ScrollView, Text } from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { NativeHeader, useNavigation, useRoute } from '@solid-native/router/solid';
import { Session } from './session.solid.ts';

/** Account and the settings sheet share the app's transactional session. */
export function AccountPage() {
  const session = useService(Session);
  const navigation = useNavigation();
  const route = useRoute();
  const settings = () => route.inputs['settings'] === true;
  const [working, setWorking] = createSignal(false);
  const [problem, setProblem] = createSignal<string | null>(null);
  let active = true;
  onCleanup(() => {
    active = false;
  });
  async function perform(action: () => Promise<boolean>) {
    if (!active || working()) return;
    setWorking(true);
    setProblem(null);
    try {
      if (!(await action()) && active) setProblem('The next screen could not open. Try again.');
    } catch {
      if (active) setProblem('The next screen could not open. Try again.');
    } finally {
      if (active) setWorking(false);
    }
  }
  return (
    <>
      <NativeHeader title={settings() ? 'Settings' : 'Account'} />
      <ScrollView class="screen" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Show
          when={session.signedIn()}
          fallback={
            <>
              <Text class="body">{session.notice() ?? 'You are signed out.'}</Text>
              <Pressable
                class="button"
                accessibilityRole="button"
                disabled={working()}
                onPress={() => {
                  void perform(session.retryEnd);
                }}
              >
                <Text class="button-label">Return to sign in</Text>
              </Pressable>
            </>
          }
        >
          <Text class="body">Signed in as {session.user()?.email}</Text>
          <Show
            when={!settings()}
            fallback={
              <Pressable
                class="card"
                accessibilityRole="button"
                disabled={working()}
                onPress={() => {
                  void perform(session.expire);
                }}
              >
                <Text class="button-label">Let the session expire</Text>
              </Pressable>
            }
          >
            <Pressable
              class="button"
              accessibilityRole="button"
              disabled={working()}
              onPress={() => {
                void perform(() => navigation.present('/account/settings', { as: 'formSheet' }));
              }}
            >
              <Text class="button-label">Settings</Text>
            </Pressable>
            <Pressable
              class="card"
              accessibilityRole="button"
              disabled={working()}
              onPress={() => {
                void perform(() => navigation.push('/account/orders'));
              }}
            >
              <Text class="button-label">Orders</Text>
            </Pressable>
          </Show>
          <Pressable
            class="card"
            accessibilityRole="button"
            disabled={working()}
            onPress={() => {
              void perform(session.signOut);
            }}
          >
            <Text class="danger">Sign out</Text>
          </Pressable>
        </Show>
        <Show when={problem()}>
          {(message) => (
            <Text class="danger" accessibilityRole="alert">
              {message()}
            </Text>
          )}
        </Show>
      </ScrollView>
    </>
  );
}
