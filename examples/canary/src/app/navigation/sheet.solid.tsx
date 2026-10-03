/** @jsxImportSource @solid-native/platform/solid */
import {
  Pressable,
  SafeAreaProvider,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@solid-native/components/solid';
import { useNavigation } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';
import { withNativeStyles } from '@solid-native/platform/solid';
import styles from './sheet.native.css';

export function Sheet() {
  const nav = useNavigation();
  const bar = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  };
  const closeButton = { padding: 4, width: 60 };
  const title = { flex: 1, textAlign: 'center', marginRight: 60 };
  const action = { color: '#3b6ef5', fontSize: 16, fontWeight: '600' };
  const close = () => {
    void nav.back();
  };
  return withNativeStyles(styles, () => (
    <>
      <SafeAreaProvider reportInsets={false} class="screen">
        <SafeAreaView class="screen" edges={['top', 'bottom']}>
          <View class="bar" style={bar}>
            <Pressable
              style={closeButton}
              onPress={() => {
                close();
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={action}>Close</Text>
            </Pressable>
            <Text class="heading" style={title}>
              Presented
            </Text>
          </View>
          <ScrollView class="screen" contentContainerStyle={page.content}>
            <Text class="body">
              A presented screen is outside the navigation controller, so it has no native bar and
              no back button. Everything above the divider is this page's own.
            </Text>
            <Text class="hint">
              As a sheet it also drags to dismiss, and the dismissal reaches the router as a back
              rather than leaving the URL pointing at a screen that is gone. Full screen it does
              not, which is why Close is the only way out of that one.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </>
  ));
}
