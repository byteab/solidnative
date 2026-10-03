import type { StyleSheet } from '@solidnative/fabric';
import globalStyles from './global-styles.native.css';

/** Preserve application rules before Tailwind utilities in one native global cascade. */
export function canaryStyles(tailwind: StyleSheet): StyleSheet {
  const offset = globalStyles.rules.reduce((last, rule) => Math.max(last, rule.order + 1), 0);
  return {
    rules: [
      ...globalStyles.rules,
      ...tailwind.rules.map((rule) => ({ ...rule, order: rule.order + offset })),
    ],
    keyframes: { ...globalStyles.keyframes, ...tailwind.keyframes },
    ...(globalStyles.structural || tailwind.structural ? { structural: true as const } : {}),
  };
}
