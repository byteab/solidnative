/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { ExpoGlass, ExpoGlassContainer, ExpoSymbol } from '@solidnative/expo';
import { AppleSignInButton } from '@solidnative/expo/apple-sign-in';

/** Liquid Glass, SF Symbols and the Sign in with Apple button, as an app's screens use them. */
export function expoViewsFixture() {
  const [presses, setPresses] = createSignal(0);
  const unset: number | undefined = undefined;
  const View = () => (
    <>
      <ExpoGlassContainer nativeID="container" spacing={12}>
        <ExpoGlass nativeID="glass" glassEffectStyle="clear" tintColor="#ff000033" isInteractive />
      </ExpoGlassContainer>
      <ExpoGlass nativeID="plain" />
      <ExpoSymbol nativeID="heart" name="heart.fill" size={32} tintColor="red" weight="bold" />
      <ExpoSymbol
        nativeID="palette"
        name="cloud.sun.fill"
        type="palette"
        colors={['#fff', '#fc0']}
        animationSpec={{ effect: { type: 'bounce' } }}
      />
      <ExpoSymbol nativeID="default" name="star" />
      <ExpoSymbol nativeID="unsized" name="star" size={unset} colors="red" />
      <AppleSignInButton nativeID="plain-apple" />
      <AppleSignInButton
        nativeID="apple"
        buttonType="continue"
        buttonStyle="black"
        cornerRadius={8}
        onButtonPress={() => setPresses(presses() + 1)}
      />
    </>
  );
  return { View, presses };
}
