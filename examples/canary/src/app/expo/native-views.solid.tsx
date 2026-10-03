/** @jsxImportSource @solid-native/platform/solid */
import { createRenderEffect, createSignal, onCleanup } from 'solid-js';
import { ScrollView, Text, View } from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import {
  ExpoGlass,
  ExpoGlassContainer,
  ExpoSymbol,
  liquidGlassAvailable,
} from '@solid-native/expo/solid';
import {
  AppleAuthenticationScope,
  AppleSignIn,
  AppleSignInButton,
} from '@solid-native/expo/solid/apple-sign-in';
import { withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';
import sheet from './native-views.native.css';

export function NativeViewsPage() {
  const apple = useService(AppleSignIn),
    front = useService(SCREEN_IN_FRONT);
  const glassNote = liquidGlassAvailable()
    ? 'Rendered with Liquid Glass. Glass views within 16 points of each other merge.'
    : 'Liquid Glass is not available here, so the glass views render as plain views.';
  const [status, setStatus] = createSignal('Checking whether Sign in with Apple is available.');
  let active = true,
    revision = 0;
  createRenderEffect(() => {
    if (!front()) revision++;
  });
  onCleanup(() => {
    active = false;
    revision++;
  });
  const current = (token: number) => active && front() && token === revision;
  const initial = revision;
  void apple
    .available()
    .then((available) => {
      if (current(initial)) setStatus(available ? 'Available.' : 'Not available on this device.');
    })
    .catch((error) => {
      if (current(initial)) setStatus(`Failed: ${String(error)}`);
    });
  const signIn = async () => {
    if (!active || !front()) return;
    const token = ++revision;
    setStatus('Signing in.');
    if (!current(token)) return;
    try {
      const credential = await apple.signIn({
        requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
      });
      if (current(token)) setStatus(credential ? `Signed in as ${credential.user}.` : 'Cancelled.');
    } catch (error) {
      if (current(token)) setStatus(`Failed: ${String((error as Error)?.message ?? error)}`);
    }
  };
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Native views" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="heading">Liquid Glass</Text>
        <Text class="body">{glassNote}</Text>
        <View class="backdrop">
          <ExpoGlassContainer class="row" spacing={16}>
            <ExpoGlass class="orb" isInteractive accessibilityLabel="Glass heart">
              <ExpoSymbol name="heart.fill" size={26} tintColor="#ff2d55" />
            </ExpoGlass>
            <ExpoGlass class="orb" glassEffectStyle="clear" accessibilityLabel="Clear glass star">
              <ExpoSymbol name="star.fill" size={26} tintColor="#ffcc00" />
            </ExpoGlass>
            <ExpoGlass class="orb" tintColor="#0a84ff55" accessibilityLabel="Tinted glass bolt">
              <ExpoSymbol name="bolt.fill" size={26} tintColor="#ffffff" />
            </ExpoGlass>
          </ExpoGlassContainer>
        </View>
        <Text class="heading">SF Symbols</Text>
        <View class="row">
          <ExpoSymbol name="cloud.sun.fill" type="multicolor" size={44} />
          <ExpoSymbol
            name="cloud.sun.rain.fill"
            type="palette"
            colors={['#8e8e93', '#ffcc00', '#0a84ff']}
            size={44}
          />
          <ExpoSymbol
            name="bell.fill"
            size={44}
            tintColor="#ff9500"
            animationSpec={{ effect: { type: 'bounce' }, repeating: true }}
          />
          <ExpoSymbol name="gearshape.fill" size={44} weight="ultraLight" tintColor="#8e8e93" />
        </View>
        <Text class="heading">Sign in with Apple</Text>
        <Text class="body" accessibilityLabel="Apple sign-in status">
          {status()}
        </Text>
        <AppleSignInButton
          class="apple"
          buttonType="continue"
          buttonStyle="black"
          cornerRadius={12}
          accessibilityLabel="Continue with Apple"
          onButtonPress={() => {
            void signIn();
          }}
        />
      </ScrollView>
    </>
  ));
}
