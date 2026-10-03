/** @jsxImportSource @solid-native/platform/solid */
import { ScrollView, Text, View } from '@solid-native/components/solid';
import { ColorScheme, useService } from '@solid-native/device/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { palette } from '../palette-values.ts';
import { page } from '../screen-styles.ts';
import sheet from './text.native.css';

/** Native nested text stays a span and inherits its parent's metrics. */
export function TextNesting() {
  const scheme = useService(ColorScheme);
  const s16 = () => ({ color: palette[scheme.current()].textStrong, fontSize: 16 });
  const s16bold = () => ({
    color: palette[scheme.current()].success,
    fontSize: 16,
    fontWeight: '700',
  });
  const s12 = () => ({ color: palette[scheme.current()].success, fontSize: 12 });
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Text nesting" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <View class="probe">
          <Text>
            1 no styles: AAA <Text>BBB</Text>
          </Text>
          <Text style={s16()}>
            2 outer only: AAA <Text>BBB</Text>
          </Text>
          <Text style={s16()}>
            3 both same: AAA <Text style={s16()}>BBB</Text>
          </Text>
          <Text style={s16()}>4 control single run: AAA BBB</Text>
          <Text style={s16()}>
            5 child bold: AAA <Text style={s16bold()}>BBB</Text>
          </Text>
          <Text style={s16()}>
            6 child smaller: AAA <Text style={s12()}>BBB</Text>
          </Text>
        </View>
        <Text class="hint">
          Every BBB must sit on the same baseline as its AAA and inherit its size unless overridden.
        </Text>
      </ScrollView>
    </>
  ));
}
