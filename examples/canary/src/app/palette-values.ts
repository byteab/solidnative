/** Native bar and control colours, shared with the global CSS palette. */
export const palette = {
  light: {
    screen: '#f4f4f7',
    card: '#ffffff',
    textStrong: '#101014',
    text: '#3a3a44',
    textMuted: '#6c6c78',
    success: '#1c8038',
    accent: '#3b6ef5',
  },
  dark: {
    screen: '#101014',
    card: '#2a2a33',
    textStrong: '#ffffff',
    text: '#c8c8d0',
    textMuted: '#6c6c78',
    success: '#7fd18a',
    accent: '#3b6ef5',
  },
} satisfies Record<'light' | 'dark', Record<string, string>>;
