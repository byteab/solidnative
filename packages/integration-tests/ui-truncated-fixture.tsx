/** @jsxImportSource @solidnative/platform/solid */
import { Text } from '@solidnative/components';
import { withNativeStyles } from '@solidnative/platform/solid';
import sheet from './ui-truncated.native.css';

export function Truncated() {
  return (
    <>
      <Text nativeID="default" numberOfLines={1}>
        a long line
      </Text>
      <Text nativeID="head" numberOfLines={1} ellipsizeMode="head">
        a long line
      </Text>
    </>
  );
}

export function TruncatedByCss() {
  return withNativeStyles(sheet, () => (
    <>
      <Text nativeID="truncate" class="truncate">
        a long line
      </Text>
      <Text nativeID="clamp" class="clamp">
        a long paragraph
      </Text>
      <Text nativeID="clip" class="truncate clip">
        a long line
      </Text>
      <Text nativeID="bound" class="clamp" numberOfLines={3}>
        a long paragraph
      </Text>
      <Text nativeID="unclamped" class="clamp none">
        a long paragraph
      </Text>
    </>
  ));
}
